// src/pages/Shipping.jsx
import React from "react";

export default function Shipping() {
  return (
    <div className="container py-12">
      <h1 className="text-2xl font-bold mb-4">Shipping</h1>
      <p className="mb-4">
        This placeholder Shipping page should be replaced with your shipping
        policy (locations served, delivery time estimates, carriers, charges).
      </p>

      <section className="prose max-w-none">
        <h2>Delivery Areas</h2>
        <p>Mention the cities/countries you ship to and any restrictions.</p>

        <h2>Estimated Delivery Times</h2>
        <p>Typical delivery windows and handling time.</p>
      </section>
    </div>
  );
}
