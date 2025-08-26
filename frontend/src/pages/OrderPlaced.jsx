// src/pages/OrderPlaced.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { INR } from "../utils";

export default function OrderPlaced() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [order, setOrder] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        setLoading(true);
        const r = await fetch(`/api/orders/${id}`);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Failed to load order");
        setOrder(j);
      } catch (e) {
        setErr(e.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="container py-10">Loading order…</div>;
  if (err) return <div className="container py-10 text-red-600">{err}</div>;
  if (!order) return null;

  return (
    <div className="container py-8">
      <div className="card p-5">
        <h1 className="text-2xl font-semibold">Thank you! 🎉</h1>
        <p className="mt-1 text-stone-700">
          Your order <span className="font-mono">{order.id}</span> is{" "}
          <span className="font-semibold">{order.status}</span>.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="font-semibold mb-2">Items</div>
            <ul className="space-y-2">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between">
                  <span>
                    {it.product?.name || it.productId} × {it.quantity}
                  </span>
                  <span className="font-medium">
                    {INR.format((it.price * it.quantity) / 100)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="font-medium">Total</span>
              <span className="text-lg font-semibold">
                {INR.format(order.total / 100)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="font-semibold mb-2">Shipping</div>
            {order.address ? (
              <pre className="whitespace-pre-wrap text-sm text-stone-700">
                {order.address}
              </pre>
            ) : (
              <div className="text-sm text-stone-500">No address provided.</div>
            )}
            <div className="mt-3 text-sm text-stone-700">
              <div>Email: {order.email || "—"}</div>
              <div>Phone: {order.phone || "—"}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Link to="/" className="btn btn-primary">Continue shopping</Link>
          <Link to="/account" className="btn btn-outline">Go to Account</Link>
        </div>
      </div>
    </div>
  );
}
