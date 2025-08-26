// src/pages/Account.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../auth';
import { INR } from '../utils';

function Section({ title, children, right }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function Account() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [me, setMe] = useState(null);

  // tabs: 'profile' | 'addresses' | 'orders'
  const [tab, setTab] = useState('profile');

  // profile edit state
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // addresses
  const emptyAddr = {
    id: '',
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    isDefault: false,
  };
  const [addresses, setAddresses] = useState([]);
  const [addrEditingId, setAddrEditingId] = useState('');
  const [addrForm, setAddrForm] = useState(emptyAddr);
  const [addrErr, setAddrErr] = useState('');

  // orders
  const [orders, setOrders] = useState([]);
  const [ordersErr, setOrdersErr] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const m = await api('/api/me');
        setMe(m);
        setName(m.name || '');
        setPhone(m.phone || '');
        const list = await api('/api/addresses');
        setAddresses(list);
      } catch (e) {
        if (String(e.message || '').toLowerCase().includes('unauthorized')) {
          nav('/login');
          return;
        }
        setErr(e.message || 'Request failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  useEffect(() => {
    if (tab !== 'orders') return;
    (async () => {
      try {
        setOrdersErr('');
        setOrdersLoading(true);
        const list = await api('/api/my/orders');
        setOrders(list);
      } catch (e) {
        setOrdersErr(e.message || 'Failed to load orders');
      } finally {
        setOrdersLoading(false);
      }
    })();
  }, [tab]);

  function logout() {
    setToken('');
    nav('/login');
  }

  async function saveProfile() {
    try {
      setErr('');
      const updated = await api('/api/me', {
        method: 'PUT',
        body: JSON.stringify({ name, phone }),
      });
      setMe((m) => ({ ...m, name: updated.name, phone: updated.phone }));
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    }
  }

  // ---------- Addresses ----------
  function beginNewAddr() {
    setAddrErr('');
    setAddrForm({ ...emptyAddr, fullName: me?.name || '' });
    setAddrEditingId('new');
  }
  function beginEditAddr(a) {
    setAddrErr('');
    setAddrForm({ ...a });
    setAddrEditingId(a.id);
  }
  function cancelAddr() {
    setAddrEditingId('');
    setAddrForm(emptyAddr);
    setAddrErr('');
  }
  async function saveAddr() {
    try {
      setAddrErr('');
      const payload = { ...addrForm, isDefault: !!addrForm.isDefault };
      let saved;
      if (addrEditingId === 'new') {
        saved = await api('/api/addresses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setAddresses((list) => [saved, ...list]);
      } else {
        saved = await api(`/api/addresses/${addrEditingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setAddresses((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      }
      if (saved.isDefault) {
        const list = await api('/api/addresses');
        setAddresses(list);
      }
      cancelAddr();
    } catch (e) {
      setAddrErr(e.message);
    }
  }
  async function removeAddr(id) {
    if (!confirm('Delete this address?')) return;
    await api(`/api/addresses/${id}`, { method: 'DELETE' });
    setAddresses((list) => list.filter((x) => x.id !== id));
  }
  async function makeDefault(a) {
    await api(`/api/addresses/${a.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...a, isDefault: true }),
    });
    const list = await api('/api/addresses');
    setAddresses(list);
  }

  if (loading) return <div className="container py-10">Loading...</div>;
  if (err) return <div className="container py-10 text-red-600">{err}</div>;
  if (!me) return null;

  return (
    <div className="container py-8 space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        <button className={'btn ' + (tab === 'profile' ? 'btn-primary' : 'btn-outline')} onClick={() => setTab('profile')}>
          Profile
        </button>
        <button className={'btn ' + (tab === 'addresses' ? 'btn-primary' : 'btn-outline')} onClick={() => setTab('addresses')}>
          Addresses
        </button>
        <button className={'btn ' + (tab === 'orders' ? 'btn-primary' : 'btn-outline')} onClick={() => setTab('orders')}>
          Orders
        </button>
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <Section
          title="Profile"
          right={
            <div className="flex gap-2">
              {!editing ? (
                <>
                  <button className="btn btn-outline" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button className="btn btn-primary" onClick={logout}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setEditing(false);
                      setName(me.name || '');
                      setPhone(me.phone || '');
                    }}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={saveProfile}>
                    Save
                  </button>
                </>
              )}
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-stone-600">Name</label>
              <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} readOnly={!editing} />
            </div>
            <div>
              <label className="text-sm text-stone-600">Email</label>
              <input className="input mt-1 bg-stone-100" readOnly value={me.email || ''} />
            </div>
            <div>
              <label className="text-sm text-stone-600">Phone</label>
              <input className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} readOnly={!editing} />
            </div>
          </div>
        </Section>
      )}

      {/* Addresses */}
      {tab === 'addresses' && (
        <Section
          title="Addresses"
          right={
            addrEditingId ? null : (
              <button className="btn btn-primary" onClick={beginNewAddr}>
                Add Address
              </button>
            )
          }
        >
          {addrEditingId && (
            <div className="mb-4 rounded-xl border p-4 bg-amber-50/40">
              {addrErr && <div className="mb-2 text-red-600">{addrErr}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-stone-600">Full name</label>
                  <input className="input mt-1" value={addrForm.fullName} onChange={(e) => setAddrForm((f) => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-stone-600">Phone</label>
                  <input className="input mt-1" value={addrForm.phone} onChange={(e) => setAddrForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm text-stone-600">Address line 1</label>
                  <input className="input mt-1" value={addrForm.line1} onChange={(e) => setAddrForm((f) => ({ ...f, line1: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm text-stone-600">Address line 2</label>
                  <input className="input mt-1" value={addrForm.line2 || ''} onChange={(e) => setAddrForm((f) => ({ ...f, line2: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-stone-600">City</label>
                  <input className="input mt-1" value={addrForm.city} onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-stone-600">State</label>
                  <input className="input mt-1" value={addrForm.state} onChange={(e) => setAddrForm((f) => ({ ...f, state: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-stone-600">Pincode</label>
                  <input className="input mt-1" value={addrForm.pincode} onChange={(e) => setAddrForm((f) => ({ ...f, pincode: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-stone-600">Country</label>
                  <input className="input mt-1" value={addrForm.country} onChange={(e) => setAddrForm((f) => ({ ...f, country: e.target.value }))} />
                </div>
                <label className="mt-2 inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!addrForm.isDefault}
                    onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  />
                  <span className="text-sm">Set as default</span>
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-outline" onClick={cancelAddr}>Cancel</button>
                <button className="btn btn-primary" onClick={saveAddr}>Save Address</button>
              </div>
            </div>
          )}

          {addresses.length === 0 ? (
            <div className="text-stone-600">No addresses yet.</div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {addresses.map((a) => (
                <li key={a.id} className="rounded-xl border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-medium">
                      {a.fullName} <span className="text-stone-500">({a.phone})</span>
                    </div>
                    {a.isDefault ? (
                      <span className="badge">Default</span>
                    ) : (
                      <button className="text-sm text-amber-700 underline" onClick={() => makeDefault(a)}>
                        Make default
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-stone-700">
                    <div>{a.line1}</div>
                    {a.line2 ? <div>{a.line2}</div> : null}
                    <div>{a.city}, {a.state} {a.pincode}</div>
                    <div>{a.country}</div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className="btn btn-outline" onClick={() => beginEditAddr(a)}>Edit</button>
                    <button className="btn btn-outline" onClick={() => removeAddr(a.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* Orders */}
      {tab === 'orders' && (
        <Section title="My Orders">
          {ordersLoading ? (
            <div>Loading orders…</div>
          ) : ordersErr ? (
            <div className="text-red-600">{ordersErr}</div>
          ) : orders.length === 0 ? (
            <div className="text-stone-600">You have no orders yet.</div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">Order #{o.id}</div>
                      <div className="text-xs text-stone-500">
                        {new Date(o.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="font-semibold">{INR.format(o.total / 100)}</div>
                  </div>
                  <div className="mt-2">
                    <span className="badge">{o.status}</span>
                  </div>
                  <ul className="mt-2 text-sm text-stone-700 space-y-1">
                    {o.items.map((it) => (
                      <li key={it.id}>
                        {it.product?.name || it.productId} × {it.quantity} —{" "}
                        {INR.format((it.price * it.quantity) / 100)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
