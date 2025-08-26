// src/lib/checkout.js
// Order creation → (auto-load Razorpay SDK) → Razorpay modal → backend verify

import { getToken } from "../auth"; // <-- pull bearer token to authorize order creation

let rzpLoadPromise = null;

async function ensureRazorpayLoaded() {
  if (typeof window === "undefined") throw new Error("Window not available");
  if (window.Razorpay) return;

  if (!rzpLoadPromise) {
    rzpLoadPromise = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = "https://checkout.razorpay.com/v1/checkout.js";
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
      document.head.appendChild(el);
    });
  }
  await rzpLoadPromise;
}

export function mapCartToOrderItems(cart = []) {
  return cart
    .map((row) => {
      const productId = row?.id ?? row?.slug;
      const quantity = Number(row?.qty ?? 1) || 1;
      return productId ? { productId: String(productId), quantity } : null;
    })
    .filter(Boolean);
}

export async function checkoutItems({
  items,                 // [{productId, quantity}]
  email = "",
  phone = "",
  address = "",
  prefill = {},          // { name, email, contact }
  notes = {},            // sent to Razorpay
  onPaid,                // async (orderId) => {}
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Your cart is empty.");
  }

  const token =
    (typeof getToken === "function" && getToken()) ||
    (typeof window !== "undefined" && localStorage.getItem("elaksi_token")) ||
    "";

  // 1) Create order on backend (validates stock & totals)
  const r = await fetch("/api/checkout/order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}), // <-- include bearer
    },
    body: JSON.stringify({ items, email, phone, address }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) {
    throw new Error(data?.error || `Order create failed (${r.status})`);
  }

  // 2) Make sure Razorpay SDK is present (auto-load if needed)
  await ensureRazorpayLoaded();

  const { keyId, amount, razorpayOrderId, orderId } = data;

  // 3) Open Razorpay & 4) Verify on success
  return await new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: keyId,
      amount,
      currency: "INR",
      name: "ELAKSI ATELIER",
      description: "Online purchase",
      order_id: razorpayOrderId,
      notes,
      prefill: {
        email: prefill.email ?? email ?? "",
        contact: prefill.contact ?? phone ?? "",
        name: prefill.name ?? "",
      },
      handler: async (resp) => {
        try {
          const vr = await fetch("/api/checkout/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          const vdata = await vr.json().catch(() => ({}));
          if (!vr.ok || !vdata?.ok) {
            reject(new Error(vdata?.error || "Payment verification failed"));
            return;
          }
          if (typeof onPaid === "function") {
            await onPaid(vdata.orderId || orderId);
          }
          resolve(vdata.orderId || orderId);
        } catch (e) {
          reject(e);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
      theme: { color: "#D97706" },
    });

    rzp.open();
  });
}
