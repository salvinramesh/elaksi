// src/server.js
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import Razorpay from "razorpay";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

/* ---------------------------
   Config & helpers
---------------------------- */
const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-please";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// —— URL normalization helpers ——
function toPublicUploadUrl(u) {
  if (!u) return u;
  return String(u).replace(/^\/api\/uploads\//, "/uploads/");
}
function normalizeProductRow(p) {
  if (!p) return p;
  return {
    ...p,
    imageUrl: toPublicUploadUrl(p.imageUrl),
    images: Array.isArray(p.images)
      ? p.images.map((im) => ({ ...im, url: toPublicUploadUrl(im.url) }))
      : p.images,
  };
}

function signToken(payload, expiresIn = "30d") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
function tryGetUserId(req) {
  const h = req.header("authorization") || req.header("Authorization");
  if (!h) return null;
  const [type, token] = h.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  try {
    const dec = jwt.verify(token, JWT_SECRET);
    return dec?.uid || null;
  } catch {
    return null;
  }
}
function isAdmin(req) {
  const h = req.header("x-admin-token") || req.header("X-Admin-Token");
  return !!h && !!process.env.ADMIN_TOKEN && h === process.env.ADMIN_TOKEN;
}
function requireAuth(req, res, next) {
  const uid = tryGetUserId(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  req.userId = uid;
  next();
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  next();
}

/* ---------------------------
   Middleware
---------------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: false,
  })
);

/* ---------------------------
   Static uploads
---------------------------- */
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^\w.-]+/g, "_");
    cb(null, `${ts}_${safe}`);
  },
});
const uploadAny = multer({ storage }); // accept any field name

// Serve uploads from BOTH paths (back-compat + proxy-friendly)
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/api/uploads", express.static(UPLOAD_DIR));

/* ---------------------------
   Health
---------------------------- */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ---------------------------
   ADMIN verify
---------------------------- */
app.get("/api/admin/verify", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false });
  res.json({ ok: true });
});

/* ---------------------------
   AUTH
---------------------------- */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body || {};
    if (!name || !email || !password)
      return res.status(400).json({ error: "name, email, password required" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, phone: phone || null, passwordHash },
    });

    const token = signToken({ uid: user.id });
    res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    });
  } catch (e) {
    console.error("register failed", e);
    res.status(500).json({ error: "register failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email & password required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken({ uid: user.id });
    res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    });
  } catch (e) {
    console.error("login failed", e);
    res.status(500).json({ error: "login failed" });
  }
});

app.get("/api/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { addresses: { orderBy: { isDefault: "desc" } } },
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    addresses: user.addresses,
  });
});

/* ---------------------------
   Addresses (Account)
---------------------------- */
app.get("/api/addresses", requireAuth, async (req, res) => {
  const rows = await prisma.address.findMany({
    where: { userId: req.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  res.json(rows);
});

app.post("/api/addresses", requireAuth, async (req, res) => {
  const data = req.body || {};
  const created = await prisma.address.create({
    data: { ...data, userId: req.userId, isDefault: !!data.isDefault },
  });
  if (created.isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.userId, id: { not: created.id } },
      data: { isDefault: false },
    });
  }
  res.json(created);
});

app.put("/api/addresses/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  const data = req.body || {};
  const updated = await prisma.address.update({
    where: { id },
    data: { ...data, isDefault: !!data.isDefault },
  });
  if (updated.isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.userId, id: { not: id } },
      data: { isDefault: false },
    });
  }
  res.json(updated);
});

app.delete("/api/addresses/:id", requireAuth, async (req, res) => {
  await prisma.address.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ---------------------------
   Collections
---------------------------- */
app.get("/api/collections", async (_req, res) => {
  const rows = await prisma.collection.findMany({ orderBy: { name: "asc" } });
  res.json(rows);
});

app.post("/api/collections", requireAdmin, async (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: "name and slug required" });
  const row = await prisma.collection.create({ data: { name, slug } });
  res.json(row);
});

app.put("/api/collections/:id", requireAdmin, async (req, res) => {
  const { name, slug } = req.body || {};
  const row = await prisma.collection.update({
    where: { id: req.params.id },
    data: { name, slug },
  });
  res.json(row);
});

app.delete("/api/collections/:id", requireAdmin, async (req, res) => {
  await prisma.collection.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ---------------------------
   Products (+ images)
---------------------------- */
app.get("/api/products", async (req, res) => {
  const { q, collectionId } = req.query;

  const where = {
    AND: [
      q
        ? {
            OR: [
              { name: { contains: String(q), mode: "insensitive" } },
              { description: { contains: String(q), mode: "insensitive" } },
              { slug: { contains: String(q), mode: "insensitive" } },
            ],
          }
        : {},
      collectionId ? { collectionId: String(collectionId) } : {},
    ],
  };

  const rows = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { images: { orderBy: { position: "asc" } } },
  });

  res.json(rows.map(normalizeProductRow));
});

// by slug or id
app.get("/api/products/:idOrSlug", async (req, res) => {
  const { idOrSlug } = req.params;
  const common = { include: { images: { orderBy: { position: "asc" } } } };
  let row = await prisma.product.findUnique({ where: { slug: idOrSlug }, ...common });
  if (!row) row = await prisma.product.findUnique({ where: { id: idOrSlug }, ...common });
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(normalizeProductRow(row));
});

app.get("/api/products/id/:id", async (req, res) => {
  const row = await prisma.product.findUnique({
    where: { id: String(req.params.id) },
    include: { images: { orderBy: { position: "asc" } } },
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(normalizeProductRow(row));
});

app.post("/api/products", requireAdmin, async (req, res) => {
  const {
    name, slug, description, price, compareAt, imageUrl, inventory, tagsCsv, tags, collectionId,
  } = req.body || {};

  if (!name || !slug || typeof price !== "number")
    return res.status(400).json({ error: "name, slug, price required" });

  const tagsCsvNorm =
    typeof tagsCsv === "string" ? tagsCsv
    : Array.isArray(tags) ? tags.join(",")
    : (tags || null);

  const row = await prisma.product.create({
    data: {
      name,
      slug,
      description: description || "",
      price,
      compareAt: compareAt || null,
      imageUrl: toPublicUploadUrl(imageUrl || null),
      inventory: typeof inventory === "number" ? inventory : 0,
      tagsCsv: tagsCsvNorm || null,
      collectionId: collectionId || null,
    },
    include: { images: { orderBy: { position: "asc" } } },
  });
  res.json(normalizeProductRow(row));
});

app.put("/api/products/:id", requireAdmin, async (req, res) => {
  const {
    name, slug, description, price, compareAt, imageUrl, inventory, tagsCsv, tags, collectionId,
  } = req.body || {};

  const tagsCsvNorm =
    typeof tagsCsv === "string" ? tagsCsv
    : Array.isArray(tags) ? tags.join(",")
    : (tags || null);

  const row = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      name,
      slug,
      description,
      price,
      compareAt,
      imageUrl: toPublicUploadUrl(imageUrl || null),
      inventory,
      tagsCsv: tagsCsvNorm || null,
      collectionId: collectionId || null,
    },
    include: { images: { orderBy: { position: "asc" } } },
  });
  res.json(normalizeProductRow(row));
});

/** DELETE product
 *  - Normal delete: blocks with 409 if product is referenced by orders
 *  - Force delete (?force=1): removes ProductImage + OrderItem rows, then deletes Product (for test cleanup)
 */
app.delete("/api/products/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const force = String(req.query.force || "") === "1";

  try {
    if (!force) {
      // Guard: if referenced by orders, block
      const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
      if (orderItemCount > 0) {
        return res.status(409).json({
          ok: false,
          error:
            "Product cannot be deleted because it appears in one or more orders. Set inventory to 0 or hide it, or re-try with ?force=1 to remove related order items.",
        });
      }

      // remove images first (FK)
      await prisma.productImage.deleteMany({ where: { productId: id } });
      await prisma.product.delete({ where: { id } });
      return res.json({ ok: true, forced: false });
    }

    // Force delete: transactionally clean up dependents
    await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.orderItem.deleteMany({ where: { productId: id } }); // ⚠ removes order lines
      await tx.product.delete({ where: { id } });
    });

    return res.json({ ok: true, forced: true });
  } catch (e) {
    if (e?.code === "P2003") {
      return res.status(409).json({
        ok: false,
        error:
          "Product is referenced by other records. Try again with ?force=1 if you intend to remove related order items.",
      });
    }
    console.error("delete product failed:", e?.message || e);
    res.status(500).json({ ok: false, error: "Delete failed" });
  }
});

/* ---------------------------
   Image upload (admin)
---------------------------- */
app.post("/api/upload", requireAdmin, uploadAny.any(), (req, res) => {
  let file = null;
  if (Array.isArray(req.files) && req.files.length) file = req.files[0];
  if (!file && req.file) file = req.file;
  if (!file) return res.status(400).json({ error: "file required" });

  // Always return PUBLIC path (works in storefront and admin)
  const url = `/uploads/${file.filename}`;
  res.json({ ok: true, url });
});

app.post("/api/products/:id/images", requireAdmin, uploadAny.any(), async (req, res) => {
  const pid = String(req.params.id);
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return res.status(400).json({ error: "files required" });

  const existing = await prisma.productImage.findMany({
    where: { productId: pid },
    orderBy: { position: "desc" },
    take: 1,
  });
  let startPos = existing.length ? existing[0].position + 1 : 0;

  const created = [];
  for (const f of files) {
    const url = `/uploads/${f.filename}`; // store public path
    const row = await prisma.productImage.create({
      data: { productId: pid, url, position: startPos++ },
    });
    created.push(row);
  }
  // normalize on the way out too (future-proof)
  res.json({ ok: true, images: created.map((im) => ({ ...im, url: toPublicUploadUrl(im.url) })) });
});

app.delete("/api/products/:pid/images/:imgId", requireAdmin, async (req, res) => {
  await prisma.productImage.delete({ where: { id: String(req.params.imgId) } });
  res.json({ ok: true });
});

/* ---------------------------
   Razorpay
---------------------------- */
const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

app.get("/api/razorpay/key", (_req, res) => {
  if (!process.env.RAZORPAY_KEY_ID) return res.status(500).json({ ok: false, error: "Razorpay key missing" });
  res.json({ ok: true, keyId: process.env.RAZORPAY_KEY_ID });
});

// Orders & Checkout
app.post("/api/checkout/order", requireAuth, async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ ok: false, error: "Razorpay keys not configured" });
    }

    const { email, phone, address, items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: "No items" });
    }

    const idsOrSlugs = items.map((i) => String(i.productId));
    const products = await prisma.product.findMany({
      where: { OR: [{ id: { in: idsOrSlugs } }, { slug: { in: idsOrSlugs } }] },
    });

    let total = 0;
    for (const it of items) {
      const p = products.find((x) => x.id === it.productId || x.slug === it.productId);
      if (!p) return res.status(400).json({ ok: false, error: "Invalid product" });
      const qty = Number(it.quantity || 1);
      if (p.inventory < qty) {
        return res.status(409).json({ ok: false, error: `"${p.name}" only has ${p.inventory} left` });
      }
      total += p.price * qty;
    }

    if (!Number.isInteger(total) || total < 100) {
      return res.status(400).json({ ok: false, error: "Amount must be at least ₹1 (100 paise)" });
    }

    const order = await prisma.order.create({
      data: {
        userId: req.userId, // ✅ enforced
        email: String(email || ""),
        phone: String(phone || ""),
        address: String(address || ""),
        total,
        status: "PLACED",
        items: {
          create: items.map((it) => {
            const p = products.find((x) => x.id === it.productId || x.slug === it.productId);
            return { productId: p.id, quantity: Number(it.quantity || 1), price: p.price };
          }),
        },
      },
      include: { items: true },
    });

    const rOrder = await rzp.orders.create({
      amount: total,
      currency: "INR",
      receipt: order.id,
    });

    res.json({
      ok: true,
      amount: total,
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: rOrder.id,
      orderId: order.id,
    });
  } catch (e) {
    console.error("checkout create failed", e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || "checkout create failed" });
  }
});

app.post("/api/checkout/verify", async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, error: "Missing payment fields" });
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(payload)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ ok: false, error: "Invalid signature" });
    }

    const rOrder = await rzp.orders.fetch(String(razorpay_order_id));
    const orderId = rOrder.receipt;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new Error("Order missing");

      for (const it of order.items) {
        const prod = await tx.product.findUnique({ where: { id: it.productId } });
        if (!prod || prod.inventory < it.quantity) {
          throw new Error(`"${prod?.name || it.productId}" is out of stock`);
        }
      }

      for (const it of order.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { inventory: { decrement: it.quantity } },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
      });
    });

    res.json({ ok: true, orderId });
  } catch (e) {
    console.error("verify failed", e?.message || e);
    const msg = e?.error?.description || e?.message || "verify failed";
    res.status(500).json({ ok: false, error: msg });
  }
});

/* ---------------------------
   Order details & status changes
---------------------------- */
app.get("/api/orders/:id", async (req, res) => {
  const o = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!o) return res.status(404).json({ error: "Not found" });
  res.json(o);
});

app.post("/api/orders/:id/ship", requireAdmin, async (req, res) => {
  const o = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: "SHIPPED" },
  });
  res.json(o);
});
app.post("/api/orders/:id/deliver", requireAdmin, async (req, res) => {
  const o = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: "DELIVERED" },
  });
  res.json(o);
});

/* ---------------------------
   Start
---------------------------- */
app.listen(PORT, () => {
  console.log(`ELAKSI backend running on http://localhost:${PORT}`);
});
