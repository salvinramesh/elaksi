// src/Layout.jsx
import React, { useEffect, useMemo } from "react";
import { Outlet, Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import CartDrawer from "./components/CartDrawer";
import { getToken } from "./auth";
import { useCart } from "./store/cart";

const CART_KEY = "elaksi_cart";
const SESSION_CLEAR_FLAG = "cart:clear";

function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter(i => i && i.id && (i.qty || 1) > 0 && Number.isFinite(i.price) && i.price > 0)
    .map(i => ({
      id: String(i.id),
      quantity: Math.max(1, parseInt(i.qty || 1, 10)),
    }));
}

export default function Layout() {
  const { items, open, setOpen, setItems, count, clear } = useCart();

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const cartCount = useMemo(() => count, [count]);

  async function handleCheckout() {
    try {
      const payloadItems = normalizeItems(items);
      if (payloadItems.length === 0) {
        alert("Your cart has no valid items to checkout.");
        return;
      }

      const headers = { "Content-Type": "application/json" };
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/checkout/order", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "guest@example.com",
          phone: "",
          address: "Guest checkout",
          items: payloadItems,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        console.error("Order create failed:", data);
        alert(data?.error || `Failed to start payment (${res.status})`);
        return;
      }

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: "INR",
        name: "ELAKSI ATELIER",
        description: "Cart checkout",
        order_id: data.razorpayOrderId,
        prefill: { name: "Guest", email: "guest@example.com", contact: "" },
        theme: { color: "#f59e0b" },
        handler: async (response) => {
          try {
            const verify = await fetch("/api/checkout/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const vr = await verify.json();
            if (verify.ok && vr.ok) {
              localStorage.setItem(CART_KEY, "[]");
              clear();
              setOpen(false);
              sessionStorage.setItem(SESSION_CLEAR_FLAG, "1");
              alert("Payment success!");
              // window.location.href = `/order/${vr.orderId}`;
            } else {
              console.error("Verify failed:", vr);
              alert(vr?.error || "Payment verification failed");
            }
          } catch (e) {
            console.error("Verify exception:", e);
            alert("Payment verification failed");
          }
        },
        modal: { ondismiss: () => console.log("Razorpay modal closed") },
      });

      rzp.open();
    } catch (e) {
      console.error("Checkout exception:", e);
      alert("Payment could not be started");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white text-stone-800">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur">
        <div className="container flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-3">
            <img src="/images/logo.png" alt="ELAKSI ATELIER" className="h-7 w-auto" />
            <span className="text-lg font-semibold tracking-wide">ELAKSI ATELIER</span>
            <span className="badge ml-2">Imitation Jewelry</span>
          </Link>

          <div className="flex items-center gap-3">
            {getToken() ? (
              <Link to="/account" className="btn btn-outline">Account</Link>
            ) : (
              <Link to="/login" className="btn btn-outline">Login</Link>
            )}
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
              <ShoppingCart className="h-4 w-4" /> Cart ({cartCount})
            </button>
          </div>
        </div>
      </header>

      {/* Routed content */}
      <main className="container py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t bg-white/60">
        <div className="container py-6 text-sm text-stone-600">
          <p>© {new Date().getFullYear()} ELAKSI ATELIER. All rights reserved.</p>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        setItems={setItems}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
