// src/components/CartDrawer.jsx
import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { INR } from "../utils";
import { checkoutItems, mapCartToOrderItems } from "../lib/checkout";

export default function CartDrawer({ open, onClose, items, setItems /* onCheckout (optional) */ }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.reduce(
    (s, i) => s + Number(i.price || 0) * Number(i.qty || 1),
    0
  );

  const orderItems = useMemo(() => mapCartToOrderItems(safeItems), [safeItems]);

  function setQty(id, qty) {
    const q = Math.max(1, Math.min(Number.isFinite(qty) ? qty : 1, 99)); // simple client cap
    setItems((list) => list.map((i) => (i.id === id ? { ...i, qty: q } : i)));
  }

  async function handleCheckout() {
    setErr("");
    if (orderItems.length === 0) {
      setErr("Your cart has no valid items to checkout.");
      return;
    }
    try {
      setBusy(true);
      await checkoutItems({
        items: orderItems,
        // If you have user/addr info, you can pass email/phone/address here
        onPaid: async (orderId) => {
          // clear cart & go to order page
          setItems([]);
          onClose?.();
          navigate(`/order/${orderId}`);
        },
      });
    } catch (e) {
      setErr(e?.message || "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transform transition-transform
        ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">Your Cart</h3>
          <button className="btn btn-outline" onClick={onClose} aria-label="Close cart">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {safeItems.length === 0 ? (
            <div className="text-stone-500">Your cart is empty.</div>
          ) : (
            safeItems.map((i) => (
              <div key={i.id} className="flex gap-3">
                <img
                  src={i.imageUrl}
                  alt={i.name}
                  className="h-16 w-16 rounded object-cover border"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="flex-1">
                  <div className="font-medium line-clamp-1">{i.name}</div>
                  <div className="text-sm text-stone-600">
                    {INR.format(Number(i.price || 0) / 100)}
                  </div>
                  <Qty id={i.id} value={Number(i.qty || 1)} onChange={setQty} />
                </div>
                <button
                  className="text-stone-500 hover:text-stone-800"
                  onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}
                  aria-label={`Remove ${i.name}`}
                >
                  Remove
                </button>
              </div>
            ))
          )}

          {err && <div className="text-sm text-red-600">{err}</div>}
        </div>

        <div className="border-t p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total</span>
            <span className="font-semibold">{INR.format(total / 100)}</span>
          </div>
          <button
            className="btn btn-primary w-full"
            onClick={handleCheckout}
            disabled={safeItems.length === 0 || busy}
          >
            {busy ? "Processing…" : "Checkout"}
          </button>
          <button
            className="btn btn-outline w-full"
            onClick={() => {
              onClose?.();
              navigate("/");
            }}
          >
            Continue shopping
          </button>
        </div>
      </aside>
    </div>
  );
}

function Qty({ id, value, onChange }) {
  return (
    <div className="mt-1 inline-flex items-center gap-2">
      <button
        className="btn btn-outline"
        onClick={() => onChange(id, value - 1)}
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="min-w-[2rem] text-center">{value}</span>
      <button
        className="btn btn-outline"
        onClick={() => onChange(id, value + 1)}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
