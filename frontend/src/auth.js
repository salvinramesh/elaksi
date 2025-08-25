// src/auth.js
export const TOKEN_KEY = 'elaksi_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function notifyAuthChange() {
  // single event we can listen for anywhere
  window.dispatchEvent(new Event('elaksi-auth'));
}

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
  notifyAuthChange(); // <- tell the app something changed
}

// Generic JSON API helper with Bearer token
export async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    let msg = 'Request failed';
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}
