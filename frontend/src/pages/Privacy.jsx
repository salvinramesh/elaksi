// src/pages/Privacy.jsx
import React from "react";

export default function Privacy() {
  return (
    <div className="container py-12">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p className="mb-4">
        This is a placeholder Privacy Policy. Replace with your actual privacy
        policy describing what data you collect, how you use it, and user rights.
      </p>

      <section className="prose max-w-none">
        <h2>Data Collected</h2>
        <p>Explain personal data, transactional data, cookies, analytics, etc.</p>

        <h2>How We Use Data</h2>
        <p>Describe purposes like order processing, marketing (if any), and security.</p>
      </section>
    </div>
  );
}
