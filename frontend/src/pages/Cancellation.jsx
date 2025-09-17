// src/pages/Cancellation.jsx
import React from "react";

export default function Cancellation() {
  return (
    <div className="container py-12">
      <h1 className="text-2xl font-bold mb-4">Cancellation & Refunds</h1>
      <p className="mb-4">
        Welcome — this is a placeholder Cancellation & Refunds page. Replace this
        content with your actual policy text so payment gateways (like Razorpay)
        can verify the page.
      </p>

      <section className="prose max-w-none">
        <h2>Order Cancellation</h2>
        <p>
          Describe when customers can cancel, any time limits, and how to contact
          you for cancellation.
        </p>

        <h2>Refunds</h2>
        <p>
          Explain refund eligibility, processing timeframes, and refund method
          (original payment method, store credit, etc.).
        </p>
      </section>
    </div>
  );
}
