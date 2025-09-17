// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";                           // ✅ IMPORTANT: loads Tailwind

import Layout from "./Layout.jsx";

// Pages
import Home from "./pages/Home.jsx";
import ProductPage from "./pages/ProductPage.jsx";
import Admin from "./pages/Admin.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Account from "./pages/Account.jsx";
import OrderPlaced from "./pages/OrderPlaced.jsx";

// Policy pages (new)
import Cancellation from "./pages/Cancellation.jsx";
import Terms from "./pages/Terms.jsx";
import Shipping from "./pages/Shipping.jsx";
import Privacy from "./pages/Privacy.jsx";
import Contact from "./pages/Contact.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Layout is the parent route for all pages */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<Account />} />

          {/* Order page */}
          <Route path="/order/:id" element={<OrderPlaced />} />

          {/* --- Policy pages (MUST be added here so Layout's Links can match) --- */}
          <Route path="/cancellation" element={<Cancellation />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/shipping" element={<Shipping />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<Contact />} />

          {/* Wildcard LAST — keep this as the final child */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
