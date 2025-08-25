// src/App.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Routes, Route, Navigate } from 'react-router-dom';
import { ShoppingCart, Search } from 'lucide-react';
import CartDrawer from './components/CartDrawer';
import { INR } from './utils';
import { getToken } from './auth';

// Pages
import ProductPage from './pages/ProductPage.jsx';
import Admin from './pages/Admin.jsx';
import Register from './pages/Register.jsx';
import Account from './pages/Account.jsx';
import Login from './pages/Login.jsx';

const CART_KEY = 'elaksi_cart';
const SESSION_CLEAR_FLAG = 'cart:clear';
const SESSION_OPEN_FLAG = 'cart:open';
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#FFF4E0" offset="0"/>
    <stop stop-color="#FBE0A6" offset="1"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
        font-family="ui-sans-serif, system-ui" font-size="36" fill="#7c5a00" opacity="0.7">ELAKSI ATELIER</text>
</svg>`);

/* -------------------------
   Helpers
--------------------------*/
async function resolveProductId(idOrSlug) {
  // Try as ID
  let r = await fetch(`/api/products/${encodeURIComponent(idOrSlug)}`);
  if (r.ok) {
    const p = await r.json();
    return p?.id || null;
  }
  // If failed as ID, try as slug (same endpoint supports slug)
  r = await fetch(`/api/products/${encodeURIComponent(idOrSlug)}`);
  if (r.ok) {
    const p = await r.json();
    return p?.id || null;
  }
  return null;
}

// Normalize one cart item; returns null if cannot be fixed
async function normalizeCartItem(item) {
  if (!item) return null;
  const qty = Math.max(1, parseInt(item.qty || 1, 10));
  const candidate = String(item.id || '').trim() || String(item.slug || '').trim();
  if (!candidate) return null;

  // Try to resolve to a valid product id (handles old carts where id=slug)
  const realId = await resolveProductId(candidate);
  if (!realId) return null;

  return {
    id: realId,
    slug: item.slug || '',
    name: item.name || '',
    qty,
    price: Number.isFinite(item.price) ? item.price : 0,
    imageUrl: item.imageUrl || PLACEHOLDER,
  };
}

// Normalizes entire cart in storage and state
async function normalizeCartState(setCart) {
  const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  const fixed = [];
  for (const it of raw) {
    const n = await normalizeCartItem(it);
    if (n) fixed.push(n);
  }
  localStorage.setItem(CART_KEY, JSON.stringify(fixed));
  setCart(fixed);
  return fixed;
}

/* -------------------------
   App
--------------------------*/
export default function App() {
  // data
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);

  // filters
  const [q, setQ] = useState('');
  const [activeCollection, setActiveCollection] = useState('all');

  // cart
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem(CART_KEY) || '[]'));

  // clear-after-payment safety
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_CLEAR_FLAG) === '1') {
      localStorage.setItem(CART_KEY, '[]');
      setCart([]);
      sessionStorage.removeItem(SESSION_CLEAR_FLAG);
    }
  }, []);

  // Normalize cart once on app mount (fix any old slug-based items)
  useEffect(() => {
    (async () => {
      await normalizeCartState(setCart);
    })();
  }, []);

  // auto-open after product add
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_OPEN_FLAG) === '1') {
      sessionStorage.removeItem(SESSION_OPEN_FLAG);
      setCart(JSON.parse(localStorage.getItem(CART_KEY) || '[]'));
      setCartOpen(true);
    }
  }, []);

  // persist cart
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);

  // cross-tab/component sync
  useEffect(() => {
    const sync = () => setCart(JSON.parse(localStorage.getItem(CART_KEY) || '[]'));
    window.addEventListener('cart:update', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('cart:update', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // fetch data
  useEffect(() => { fetch('/api/collections').then(r => r.json()).then(setCollections); }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (activeCollection !== 'all') params.set('collectionId', activeCollection);
    fetch('/api/products?' + params.toString()).then(r => r.json()).then(setProducts);
  }, [q, activeCollection]);

  function addToCart(p) {
    setCart(list => {
      const found = list.find(i => i.id === p.id);
      if (found) return list.map(i => i.id === p.id ? { ...i, qty: (i.qty || 1) + 1 } : i);
      return [...list, {
        id: p.id, slug: p.slug, name: p.name, qty: 1,
        price: p.price, imageUrl: p.imageUrl || p.images?.[0]?.url || PLACEHOLDER
      }];
    });
    setCartOpen(true);
    window.dispatchEvent(new Event('cart:update'));
  }

  const cartCount = useMemo(() => cart.reduce((s, i) => s + (i.qty || 1), 0), [cart]);

  // checkout from cart
  async function handleCheckout() {
    try {
      // 1) Normalize cart right now (fix any old/stale items)
      const normalized = await normalizeCartState(setCart);
      const items = normalized
        .filter(i => i && i.id && (i.qty || 1) > 0)
        .map(i => ({ productId: i.id, quantity: i.qty || 1 }));

      if (items.length === 0) {
        alert('Your cart has no valid items to checkout.');
        return;
      }

      // 2) Create backend order
      const headers = { 'Content-Type': 'application/json' };
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/checkout/order', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: 'guest@example.com',
          phone: '',
          address: 'Guest checkout',
          items
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        console.error('Order create failed:', data);
        alert(data?.error || `Failed to start payment (${res.status})`);
        return;
      }

      // 3) Load Razorpay once
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      // 4) Open Razorpay
      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: 'INR',
        name: 'ELAKSI ATELIER',
        description: 'Cart checkout',
        order_id: data.razorpayOrderId,
        prefill: { name: 'Guest', email: 'guest@example.com', contact: '' },
        theme: { color: '#f59e0b' },
        handler: async (response) => {
          try {
            const verify = await fetch('/api/checkout/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const vr = await verify.json();
            if (verify.ok && vr.ok) {
              localStorage.setItem(CART_KEY, '[]');
              setCart([]);
              setCartOpen(false);
              sessionStorage.setItem(SESSION_CLEAR_FLAG, '1');
              alert('Payment success!');
              // location.href = `/order/${vr.orderId}`;
            } else {
              console.error('Verify failed:', vr);
              alert(vr?.error || 'Payment verification failed');
            }
          } catch (e) {
            console.error('Verify exception:', e);
            alert('Payment verification failed');
          }
        },
        modal: { ondismiss: () => console.log('Razorpay modal closed') }
      });

      rzp.open();
    } catch (e) {
      console.error('Checkout exception:', e);
      alert('Payment could not be started');
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
            <Link to="/login" className="btn btn-outline">Login</Link>
            <button className="btn btn-primary" onClick={() => setCartOpen(true)}>
              <ShoppingCart className="h-4 w-4" /> Cart ({cartCount})
            </button>
          </div>
        </div>
      </header>

      {/* Routes */}
      <main className="container py-6">
        <Routes>
          <Route path="/" element={
            <HomeView
              collections={collections}
              products={products}
              q={q}
              setQ={setQ}
              activeCollection={activeCollection}
              setActiveCollection={setActiveCollection}
              addToCart={addToCart}
            />
          } />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="mt-12 border-t bg-white/60">
        <div className="container py-6 text-sm text-stone-600">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} ELAKSI ATELIER. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Cart drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        setItems={(fnOrArr) => {
          setCart(prev => (typeof fnOrArr === 'function' ? fnOrArr(prev) : fnOrArr));
          window.dispatchEvent(new Event('cart:update'));
        }}
        onCheckout={handleCheckout}
      />
    </div>
  );
}

function HomeView({
  collections, products, q, setQ, activeCollection, setActiveCollection, addToCart
}) {
  return (
    <>
      <Hero />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <input
              className="input pl-9"
              placeholder="Search jewelry"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
          </div>
          <select
            className="input w-56"
            value={activeCollection}
            onChange={(e)=>setActiveCollection(e.target.value)}
          >
            <option value="all">All Collections</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="text-sm text-stone-600">Free shipping in India over ₹150</div>
      </div>

      <section id="new" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.length === 0 ? (
          <div className="col-span-full text-center text-stone-500 border rounded-xl p-10">
            No products yet. Please add items in <code>/admin</code>.
          </div>
        ) : products.map(p => {
          const out = (p.inventory ?? 0) <= 0;
          return (
            <div key={p.id} className="card overflow-hidden transition hover:shadow-md">
              <Link to={`/product/${p.slug}`} className="block relative">
                <img
                  src={p.imageUrl || p.images?.[0]?.url || PLACEHOLDER}
                  alt={p.name}
                  className="aspect-square w-full object-cover"
                  onError={(e)=>{ e.currentTarget.src = PLACEHOLDER; }}
                />
                {p.collectionId && (
                  <span className="badge absolute left-2 top-2">
                    {collections.find(c=>c.id===p.collectionId)?.name}
                  </span>
                )}
                {out && (
                  <span className="absolute right-2 top-2 rounded-full bg-stone-800/90 px-3 py-1 text-xs text-white">
                    Out of stock
                  </span>
                )}
              </Link>
              <div className="p-3">
                <div className="font-semibold line-clamp-1">{p.name}</div>
                <div className="text-sm text-stone-600 line-clamp-2">{p.description}</div>
                <div className="mt-2 flex items-center justify-between">
                  <Price price={p.price} compareAt={p.compareAt} />
                  <button className="btn btn-primary" onClick={()=>addToCart(p)} disabled={out}>
                    {out ? 'Sold out' : 'Add'}
                  </button>
                </div>
                {!out && typeof p.inventory === 'number' && p.inventory <= 2 && (
                  <div className="mt-1 text-xs text-amber-700">Hurry! Only {p.inventory} left</div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

function Hero() {
  return (
    <section
      className="relative h-[520px] md:h-[600px] rounded-2xl overflow-hidden flex items-center justify-center text-center"
      style={{
        backgroundImage: "url('/images/brand-hero.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-white/40" />
      <div className="relative z-10 flex flex-col items-center justify-center px-4">
        <img src="/images/logo.png" alt="ELAKSI ATELIER" className="h-20 md:h-28 mb-4" />
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-stone-900 drop-shadow">
          ELAKSI ATELIER
        </h1>
        <p className="mt-3 md:mt-4 text-base md:text-lg text-stone-800 max-w-2xl drop-shadow">
          Handpicked imitation jewelry crafted for everyday radiance and bridal grandeur.
        </p>
        <div className="mt-6 flex gap-4 flex-wrap justify-center">
          <a href="#new" className="btn btn-primary">Shop New Arrivals</a>
          <a href="#collections" className="btn btn-outline">Explore Collections</a>
        </div>
      </div>
    </section>
  );
}

function Price({ price, compareAt }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-semibold">{INR.format((price||0)/100)}</span>
      {compareAt && compareAt > price
        ? <span className="text-sm text-stone-500 line-through">{INR.format(compareAt/100)}</span>
        : null}
    </div>
  );
}
