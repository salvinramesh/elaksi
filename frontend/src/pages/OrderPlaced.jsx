import React from "react";
import { Link, useParams } from "react-router-dom";

const steps = ["PLACED", "PAID", "SHIPPED", "DELIVERED"];

export default function OrderPlaced() {
  const { id } = useParams();
  const [order, setOrder] = React.useState(null);

  React.useEffect(() => {
    fetch(`/api/orders/${id}`).then(r => r.json()).then(setOrder);
  }, [id]);

  if (!order) return <div>Loading your order…</div>;

  const current = steps.indexOf(order.status);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Thank you! 🎉</h1>
      <p className="text-stone-700 mt-1">Your order <span className="font-mono">{order.id}</span> has been placed.</p>

      <div className="mt-6 space-y-3">
        {steps.map((s, idx) => (
          <div key={s} className={`p-3 rounded border ${idx <= current ? "border-amber-400 bg-amber-50" : "border-stone-200"}`}>
            <div className="font-medium">{s}</div>
            <div className="text-sm text-stone-600">
              {idx === 0 && "We’ve received your order."}
              {idx === 1 && "Payment verified."}
              {idx === 2 && "Packed and handed to courier."}
              {idx === 3 && "Delivered to your address."}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn btn-primary">Continue shopping</Link>
        <a className="btn btn-outline" href={`mailto:support@elaksi.in?subject=Order%20${order.id}`}>Need help?</a>
      </div>
    </div>
  );
}
