// src/pages/Contact.jsx
import React from "react";

export default function Contact() {
  return (
    <div className="container py-12">
      <h1 className="text-2xl font-bold mb-4">Contact Us</h1>
      <p className="mb-4">
        Provide contact information here — email, phone, store address, or a
        contact form. This placeholder helps Razorpay verify the presence of a contact page.
      </p>

      <section className="prose max-w-none">
        <h2>Customer Support</h2>
        <p>Email: <a href="mailto:hello@yourdomain.com">hello@yourdomain.com</a></p>
        <p>Phone: +91-XXXXXXXXXX</p>

        <h2>Business Address</h2>
        <p>Replace this with your shop's street address.</p>
      </section>
    </div>
  );
}
