// src/pages/OrderPlaced.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { INR } from "../utils";

export default function OrderPlaced() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const r = await fetch(`/api/orders/${id}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load order");
        setOrder(j);
      } catch (e) {
        setErr(e?.message || "Failed to load order");
      }
    })();
  }, [id]);

  if (err) return <div className="container py-10 text-red-600">{err}</div>;
  if (!order) return <div className="container py-10">Loading…</div>;

  return (
    <div className="container py-10">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Order confirmed 🎉</h1>
        <p className="mt-1 text-stone-600">Thank you! Your order has been placed.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="font-medium">Order ID</div>
            <div className="text-stone-700 break-all">{order.id}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="font-medium">Status</div>
            <div className="badge mt-1">{order.status}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="font-medium">Total</div>
            <div className="text-stone-800 font-semibold">{INR.format(order.total / 100)}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="font-medium">When</div>
            <div className="text-stone-700">{new Date(order.createdAt).toLocaleString()}</div>
          </div>
        </div>

        <h2 className="mt-6 text-lg font-semibold">Items</h2>
        <ul className="mt-2 divide-y rounded-xl border">
          {order.items.map((it) => (
            <li key={it.id} className="p-3 flex items-center justify-between">
              <div className="text-stone-800">
                <div className="font-medium">{it.product?.name || it.productId}</div>
                <div className="text-sm text-stone-600">Qty: {it.quantity}</div>
              </div>
              <div className="font-semibold">
                {INR.format((it.price * it.quantity) / 100)}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-2">
          <Link to="/" className="btn btn-outline">Continue shopping</Link>
          <Link to="/account" className="btn btn-primary">View my orders</Link>
        </div>
      </div>
    </div>
  );
}
