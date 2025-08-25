import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { INR } from '../utils';

const CART_KEY = 'elaksi_cart';
const SESSION_CLEAR_FLAG = 'cart:clear';
const SESSION_OPEN_FLAG = 'cart:open';
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#FFF4E0" offset="0"/>
    <stop stop-color="#FBE0A6" offset="1"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
        font-family="ui-sans-serif, system-ui" font-size="28" fill="#7c5a00" opacity="0.7">ELAKSI ATELIER</text>
</svg>`);

export default function ProductPage() {
  const { slug } = useParams();
  const [p, setP] = useState(null);
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setErr('');
        const r = await fetch('/api/products/' + slug);
        if (!r.ok) throw new Error('Not found');
        setP(await r.json());
      } catch (e) {
        setErr(e.message || 'Failed to load');
      }
    })();
  }, [slug]);

  const images = useMemo(() => {
    if (!p) return [];
    return [p.imageUrl, ...(p.images || []).map(i => i.url)].filter(Boolean);
  }, [p]);

  const outOfStock = useMemo(() => (p?.inventory ?? 0) <= 0, [p]);

  function addToCart() {
    if (!p || outOfStock) return;
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    const ex = cart.find(i => i.id === p.id);
    const q = Number(qty) || 1;
    if (ex) ex.qty = (ex.qty || 1) + q;
    else cart.push({ id: p.id, slug: p.slug, name: p.name, qty: q, price: p.price, imageUrl: images[0] || PLACEHOLDER });
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event('cart:update'));
    sessionStorage.setItem(SESSION_OPEN_FLAG, '1');
    alert('Added to cart');
  }

  async function buyNow() {
    try {
      if (!p || outOfStock) return;
      const body = {
        email: 'guest@example.com',
        phone: '',
        address: 'Guest checkout',
        items: [{ productId: p.id, quantity: Number(qty) || 1 }],
      };
      const res = await fetch('/api/checkout/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        console.error('Order create failed:', data);
        alert(data?.error || 'Failed to start payment');
        return;
      }

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: 'INR',
        name: 'ELAKSI ATELIER',
        description: p.name,
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
              sessionStorage.setItem(SESSION_CLEAR_FLAG, '1');
              window.dispatchEvent(new Event('cart:update'));
              alert('Payment success!');
              // location.href = `/order/${vr.orderId}`; // tracking page (optional)
            } else {
              console.error('Verify failed:', vr);
              alert(vr?.error || 'Payment verification failed');
            }
          } catch (e) {
            console.error('Verify exception:', e);
            alert('Payment verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            // Optional: let the user know they closed the payment window
            console.log('Razorpay modal closed');
          }
        }
      });

      rzp.open();
    } catch (e) {
      console.error('buyNow exception:', e);
      alert('Payment could not be started');
    }
  }

  if (err) return <div className="container py-8 text-red-600">{err}</div>;
  if (!p) return <div className="container py-8">Loading…</div>;

  return (
    <div className="container py-8">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border">
            {outOfStock && (
              <span className="absolute left-2 top-2 z-10 rounded-full bg-stone-800/90 px-3 py-1 text-xs text-white">
                Out of stock
              </span>
            )}
            <img
              src={images[active] || PLACEHOLDER}
              className="h-full w-full object-cover"
              onError={(e)=>{ e.currentTarget.src = PLACEHOLDER; }}
              alt={p.name}
            />
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.map((u, i) => (
                <button
                  key={i}
                  className={'aspect-square rounded-lg overflow-hidden border ' + (i===active?'ring-2 ring-amber-500':'')}
                  onClick={()=>setActive(i)}
                  aria-label={`View image ${i+1}`}
                >
                  <img src={u} className="h-full w-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <p className="mt-1 text-stone-600">{p.description}</p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-bold">{INR.format(((p.price||0)/100))}</span>
            {!!p.compareAt && p.compareAt > p.price &&
              <span className="text-stone-500 line-through">{INR.format(p.compareAt/100)}</span>}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <input
              type="number"
              className="input w-24"
              value={qty}
              min={1}
              onChange={(e)=>setQty(Math.max(1, parseInt(e.target.value||'1',10)))}
              disabled={outOfStock}
            />
            <button className="btn btn-primary" onClick={addToCart} disabled={outOfStock}>
              {outOfStock ? 'Sold out' : 'Add to Cart'}
            </button>
            <button className="btn btn-outline" onClick={buyNow} disabled={outOfStock}>
              {outOfStock ? 'Sold out' : 'Buy Now'}
            </button>
          </div>

          <div className="mt-2 text-sm text-stone-600">Free shipping in India over ₹150</div>
        </div>
      </div>
    </div>
  );
}
