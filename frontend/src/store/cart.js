// src/store/cart.js
import { useEffect, useState } from 'react';

const CART_KEY = 'elaksi_cart';

let state = {
  items: JSON.parse(localStorage.getItem(CART_KEY) || '[]'),
  open: false,
};

const listeners = new Set();

function notify() {
  localStorage.setItem(CART_KEY, JSON.stringify(state.items));
  listeners.forEach((fn) => fn(state));
}

export const cartStore = {
  subscribe(fn) {
    listeners.add(fn);
    fn(state);
    return () => listeners.delete(fn);
  },
  get() {
    return state;
  },

  setOpen(v) {
    state = { ...state, open: v };
    notify();
  },

  setItems(updater) {
    const next = typeof updater === 'function' ? updater(state.items) : updater;
    state = { ...state, items: next };
    notify();
    window.dispatchEvent(new Event('cart:update'));
  },

  add(product, qty = 1) {
    const list = [...state.items];
    const found = list.find((i) => i.id === product.id);
    if (found) {
      found.qty = (found.qty || 1) + qty;
    } else {
      list.push({
        id: product.id,
        slug: product.slug,
        name: product.name,
        qty,
        price: product.price,
        imageUrl:
          product.imageUrl ||
          product.images?.[0]?.url ||
          'data:image/svg+xml;utf8,' +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="100%" height="100%" fill="#FFF4E0"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="28" fill="#7c5a00" opacity="0.7">ELAKSI ATELIER</text></svg>`
            ),
      });
    }
    state = { ...state, items: list };
    notify();
    window.dispatchEvent(new Event('cart:update'));
  },

  clear() {
    state = { ...state, items: [] };
    notify();
    window.dispatchEvent(new Event('cart:update'));
  },
};

// cross-tab sync
window.addEventListener('storage', (e) => {
  if (e.key === CART_KEY) {
    try {
      const items = JSON.parse(e.newValue || '[]');
      state = { ...state, items };
      notify();
    } catch {}
  }
});

// manual broadcasts
window.addEventListener('cart:update', () => {
  const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  state = { ...state, items };
  notify();
});

// React hook
export function useCart() {
  const [snap, setSnap] = useState(cartStore.get());
  useEffect(() => cartStore.subscribe(setSnap), []);
  const count = snap.items.reduce((s, i) => s + (i.qty || 1), 0);
  return {
    items: snap.items,
    open: snap.open,
    setOpen: cartStore.setOpen,
    setItems: cartStore.setItems,
    add: cartStore.add,
    clear: cartStore.clear,
    count,
  };
}
