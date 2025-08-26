// src/pages/Admin.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Upload, LogOut, Shield, Truck, PackageCheck } from 'lucide-react'
import { INR } from '../utils'

const ADMIN_TOKEN_KEY = 'elaksi_admin_token'

// Normalize any old `/api/uploads/...` to `/uploads/...`
function fixUrl(u) {
  if (!u) return ''
  try {
    // only rewrite same-origin app-relative paths
    if (u.startsWith('/api/uploads/')) return u.replace(/^\/api\//, '/')
    return u
  } catch {
    return u
  }
}

function Price({ price, compareAt }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-semibold">{INR.format((price || 0) / 100)}</span>
      {compareAt && compareAt > price ? (
        <span className="text-sm text-stone-500 line-through">{INR.format(compareAt / 100)}</span>
      ) : null}
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()

  const [storedToken, setStoredToken] = useState(localStorage.getItem(ADMIN_TOKEN_KEY) || '')
  const [inputToken, setInputToken] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const [collections, setCollections] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([]) // <-- NEW
  const [form, setForm] = useState({})
  const [tab, setTab] = useState('products')
  const [uploadPreview, setUploadPreview] = useState('')

  useEffect(() => {
    async function verify() {
      if (!storedToken) {
        setLoggedIn(false)
        return
      }
      setVerifying(true)
      const ok = await verifyToken(storedToken)
      setLoggedIn(ok)
      if (!ok) {
        localStorage.removeItem(ADMIN_TOKEN_KEY)
        setStoredToken('')
      }
      setVerifying(false)
    }
    verify()
  }, [storedToken])

  async function verifyToken(token) {
    try {
      const res = await fetch('/api/admin/verify', { headers: { 'x-admin-token': token } })
      return res.ok
    } catch {
      return false
    }
  }

  async function handleLogin() {
    const trimmed = (inputToken || '').trim()
    if (!trimmed) return alert('Please paste your ADMIN_TOKEN')
    setVerifying(true)
    const ok = await verifyToken(trimmed)
    setVerifying(false)
    if (!ok) return alert('Invalid token')
    localStorage.setItem(ADMIN_TOKEN_KEY, trimmed)
    setStoredToken(trimmed)
    setInputToken('')
    setLoggedIn(true)
  }

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    setStoredToken('')
    setLoggedIn(false)
    setForm({})
  }

  function adminHeadersJSON() {
    return { 'x-admin-token': storedToken, 'Content-Type': 'application/json' }
  }

  function reload() {
    fetch('/api/collections')
      .then((r) => r.json())
      .then(setCollections)
    fetch('/api/products')
      .then((r) => r.json())
      .then((rows) => {
        // normalize any legacy image URLs on load so list thumbnails work
        const normalized = rows.map((p) => ({
          ...p,
          imageUrl: fixUrl(p.imageUrl),
          images: Array.isArray(p.images) ? p.images.map((im) => ({ ...im, url: fixUrl(im.url) })) : [],
        }))
        setProducts(normalized)
      })

    // NEW: load recent orders for admin
    fetch('/api/admin/orders', { headers: { 'x-admin-token': storedToken } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrders)
      .catch(() => {})
  }
  useEffect(() => {
    if (loggedIn) reload()
  }, [loggedIn])

  // Optional: light polling so you notice new payments while on admin
  useEffect(() => {
    if (!loggedIn) return
    const t = setInterval(() => {
      if (tab === 'orders') {
        fetch('/api/admin/orders', { headers: { 'x-admin-token': storedToken } })
          .then((r) => (r.ok ? r.json() : []))
          .then(setOrders)
          .catch(() => {})
      }
    }, 30000)
    return () => clearInterval(t)
  }, [loggedIn, tab, storedToken])

  function normalizeProductBody(f) {
    const body = {
      name: f.name || '',
      slug: f.slug || '',
      description: f.description || '',
      price:
        typeof f.price === 'number'
          ? f.price
          : Math.round(parseFloat(f.price || '0') * 100),
      compareAt: f.compareAt
        ? typeof f.compareAt === 'number'
          ? f.compareAt
          : Math.round(parseFloat(f.compareAt || '0') * 100)
        : null,
      imageUrl: fixUrl(f.imageUrl || ''), // ensure /uploads/ form
      inventory: parseInt(f.inventory || 0, 10),
      // send tags as array; backend accepts tags or tagsCsv
      tags: Array.isArray(f.tags)
        ? f.tags
        : String(f.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
      collectionId: f.collectionId || null,
    }
    if (f._fromList) {
      body.price = f.price ?? 0
      body.compareAt = f.compareAt ?? null
    }
    return body
  }

  async function createProduct(f) {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: adminHeadersJSON(),
      body: JSON.stringify(normalizeProductBody(f)),
    })
    if (!res.ok) return alert('Create failed: ' + res.status)
    alert('Product created')
    setForm({})
    reload()
  }
  async function updateProduct(id, f) {
    const res = await fetch('/api/products/' + id, {
      method: 'PUT',
      headers: adminHeadersJSON(),
      body: JSON.stringify(normalizeProductBody(f)),
    })
    if (!res.ok) return alert('Update failed: ' + res.status)
    alert('Product updated')
    setForm({})
    reload()
  }

  async function deleteProduct(id) {
    if (!confirm('Delete product?')) return
    // try a normal delete first
    let res = await fetch('/api/products/' + id, {
      method: 'DELETE',
      headers: { 'x-admin-token': storedToken },
    })

    if (res.ok) {
      alert('Product deleted')
      reload()
      return
    }

    if (res.status === 409) {
      const msg = await res.json().catch(() => ({}))
      const go = confirm(
        (msg?.error || 'Product is referenced by orders.') +
          '\n\nForce delete? This will remove order items for this product (test data cleanup only).'
      )
      if (!go) return
      res = await fetch('/api/products/' + id + '?force=1', {
        method: 'DELETE',
        headers: { 'x-admin-token': storedToken },
      })
      if (res.ok) {
        alert('Product force-deleted')
        reload()
        return
      }
    }

    alert('Delete failed: ' + res.status)
  }

  // Collections CRUD
  async function createCollection(f) {
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: adminHeadersJSON(),
      body: JSON.stringify({ name: f.name || '', slug: f.slug || '' }),
    })
    if (!res.ok) return alert('Create failed: ' + res.status)
    alert('Collection created')
    setForm({})
    reload()
  }
  async function updateCollection(id, f) {
    const res = await fetch('/api/collections/' + id, {
      method: 'PUT',
      headers: adminHeadersJSON(),
      body: JSON.stringify({ name: f.name || '', slug: f.slug || '' }),
    })
    if (!res.ok) return alert('Update failed: ' + res.status)
    alert('Collection updated')
    setForm({})
    reload()
  }
  async function deleteCollection(id) {
    if (!confirm('Delete collection?')) return
    const res = await fetch('/api/collections/' + id, {
      method: 'DELETE',
      headers: { 'x-admin-token': storedToken },
    })
    if (!res.ok) return alert('Delete failed: ' + res.status)
    alert('Collection deleted')
    reload()
  }

  async function uploadImage(file) {
    const fd = new FormData()
    // backend accepts any field name; use "file"
    fd.append('file', file)
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-token': storedToken },
      body: fd,
    })
    if (!res.ok) {
      alert('Upload failed: ' + res.status)
      return
    }
    const data = await res.json()
    const normalized = fixUrl(data.url)
    setUploadPreview(normalized)
    setForm((f) => ({ ...f, imageUrl: normalized }))
    alert('Image uploaded')
  }

  // ------- Orders actions -------
  async function markShipped(id) {
    const r = await fetch(`/api/orders/${id}/ship`, {
      method: 'POST',
      headers: { 'x-admin-token': storedToken },
    })
    if (!r.ok) return alert('Failed to mark shipped')
    reload()
  }
  async function markDelivered(id) {
    const r = await fetch(`/api/orders/${id}/deliver`, {
      method: 'POST',
      headers: { 'x-admin-token': storedToken },
    })
    if (!r.ok) return alert('Failed to mark delivered')
    reload()
  }

  return !loggedIn ? (
    <div className="min-h-screen grid place-items-center bg-amber-50">
      <div className="card p-6 w-full max-w-md">
        <h1 className="text-xl font-semibold mb-1">ELAKSI ATELIER Admin</h1>
        <p className="text-sm text-stone-600 mb-4">
          Paste the <code>ADMIN_TOKEN</code> from your backend <code>.env</code>.
        </p>
        <input
          className="input mb-3"
          type="password"
          placeholder="ADMIN_TOKEN"
          value={inputToken}
          onChange={(e) => setInputToken(e.target.value)}
        />
        <button className="btn btn-primary w-full" onClick={handleLogin} disabled={verifying}>
          {verifying ? 'Verifying…' : 'Log in'}
        </button>
      </div>
    </div>
  ) : (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur">
        <div className="container flex items-center justify-between py-4">
          <div className="text-lg font-semibold">ELAKSI ATELIER Admin</div>
          <div className="flex items-center gap-2">
            <button className="btn btn-outline" onClick={() => navigate('/')}>
              Go to Store
            </button>
            <button className="btn" onClick={logout}>
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <div className="mt-2 flex gap-2">
          <button
            className={'btn ' + (tab === 'products' ? 'btn-primary' : 'btn-outline')}
            onClick={() => setTab('products')}
          >
            Products
          </button>
        <button
            className={'btn ' + (tab === 'collections' ? 'btn-primary' : 'btn-outline')}
            onClick={() => setTab('collections')}
          >
            Collections
          </button>
          <button
            className={'btn ' + (tab === 'orders' ? 'btn-primary' : 'btn-outline')}
            onClick={() => setTab('orders')}
          >
            Orders
          </button>
        </div>

        {tab === 'products' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 card p-3 space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-3 border rounded-xl p-2">
                  <img
                    src={fixUrl(p.imageUrl || p.images?.[0]?.url)}
                    className="h-14 w-14 rounded-lg object-cover bg-stone-100"
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.opacity = 0.4
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-stone-500">{p.slug}</div>
                  </div>
                  <Price price={p.price} compareAt={p.compareAt} />
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      setForm({
                        ...p,
                        _fromList: true,
                        imageUrl: fixUrl(p.imageUrl),
                        images: (p.images || []).map((im) => ({ ...im, url: fixUrl(im.url) })),
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="btn" onClick={() => deleteProduct(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="card p-3 space-y-2">
              <div className="text-sm font-semibold">Create / Edit Product</div>
              <input
                className="input"
                placeholder="Name"
                value={form.name || ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Slug (unique)"
                value={form.slug || ''}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
              <textarea
                className="input"
                placeholder="Description"
                value={form.description || ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              ></textarea>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input"
                  type="number"
                  placeholder="Price (₹)"
                  value={form._fromList ? (form.price || 0) / 100 : form.price || ''}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="Compare At (₹)"
                  value={form._fromList ? (form.compareAt || 0) / 100 : form.compareAt || ''}
                  onChange={(e) => setForm((f) => ({ ...f, compareAt: e.target.value }))}
                />
              </div>
              <input
                className="input"
                type="number"
                placeholder="Inventory"
                value={form.inventory || 0}
                onChange={(e) => setForm((f) => ({ ...f, inventory: e.target.value }))}
              />
              <select
                className="input"
                value={form.collectionId || ''}
                onChange={(e) => setForm((f) => ({ ...f, collectionId: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Tags (comma separated)"
                value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags || ''}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />

              <input
                className="input"
                placeholder="Cover Image URL"
                value={fixUrl(form.imageUrl) || ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    imageUrl: fixUrl(e.target.value),
                  }))
                }
              />
              <div>
                <label className="btn btn-outline">
                  <Upload className="h-4 w-4" /> Upload Cover
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0])}
                  />
                </label>
                {uploadPreview && (
                  <img src={fixUrl(uploadPreview)} className="mt-2 h-20 rounded object-cover" alt="" />
                )}
              </div>

              <div className="mt-2">
                <label className="btn btn-outline mr-2">
                  <Upload className="h-4 w-4" /> Upload Images
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || [])
                      if (!form.id) return alert('Save product first, then add images')
                      const fd = new FormData()
                      files.forEach((f) => fd.append('files', f))
                      const res = await fetch(`/api/products/${form.id}/images`, {
                        method: 'POST',
                        headers: { 'x-admin-token': storedToken },
                        body: fd,
                      })
                      if (!res.ok) return alert('Upload failed: ' + res.status)
                      alert('Images uploaded')
                      const fresh = await fetch('/api/products/id/' + form.id).then((r) => r.json())
                      // normalize URLs coming back
                      fresh.images = (fresh.images || []).map((im) => ({ ...im, url: fixUrl(im.url) }))
                      setForm((prev) => ({ ...prev, images: fresh.images }))
                    }}
                  />
                </label>
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {(form.images || [])
                    .sort((a, b) => a.position - b.position)
                    .map((img) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={fixUrl(img.url)}
                          className="h-16 w-16 rounded object-cover border bg-stone-100"
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.opacity = 0.4
                          }}
                        />
                        <button
                          className="absolute -top-2 -right-2 hidden group-hover:block btn"
                          onClick={async () => {
                            if (!confirm('Delete image?')) return
                            await fetch(`/api/products/${form.id}/images/${img.id}`, {
                              method: 'DELETE',
                              headers: { 'x-admin-token': storedToken },
                            })
                            const fresh = await fetch('/api/products/id/' + form.id).then((r) => r.json())
                            fresh.images = (fresh.images || []).map((im) => ({ ...im, url: fixUrl(im.url) }))
                            setForm((prev) => ({ ...prev, images: fresh.images }))
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() => (form.id ? updateProduct(form.id, form) : createProduct(form))}
                >
                  {form.id ? 'Update' : 'Create'}
                </button>
                <button className="btn btn-outline" onClick={() => setForm({})}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'collections' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-3 space-y-2">
              {collections.map((c) => (
                <div key={c.id} className="flex items-center gap-3 border rounded-xl p-2">
                  <div className="flex-1">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-stone-500">{c.slug}</div>
                  </div>
                  <button className="btn btn-outline" onClick={() => setForm(c)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="btn" onClick={() => deleteCollection(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="card p-3 space-y-2">
              <div className="text-sm font-semibold">Create / Edit Collection</div>
              <input
                className="input"
                placeholder="Name"
                value={form.name || ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Slug (unique)"
                value={form.slug || ''}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() => (form.id ? updateCollection(form.id, form) : createCollection(form))}
                >
                  {form.id ? 'Update' : 'Create'}
                </button>
                <button className="btn btn-outline" onClick={() => setForm({})}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="mt-4 card p-3">
            {orders.length === 0 ? (
              <div className="text-stone-600">No orders yet.</div>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => (
                  <div key={o.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">Order #{o.id}</div>
                        <div className="text-xs text-stone-500">
                          {new Date(o.createdAt).toLocaleString()} • {o.user?.email || o.email || 'Guest'}
                        </div>
                      </div>
                      <div className="font-semibold">{INR.format(o.total / 100)}</div>
                    </div>

                    <div className="mt-2 text-sm">
                      <span className="badge">{o.status}</span>
                    </div>

                    <ul className="mt-2 text-sm text-stone-700 space-y-1">
                      {o.items.map((it) => (
                        <li key={it.id}>
                          {it.product?.name || it.productId} × {it.quantity} — {INR.format((it.price * it.quantity) / 100)}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex gap-2">
                      <button className="btn btn-outline" onClick={() => markShipped(o.id)}>
                        <Truck className="h-4 w-4" /> Mark shipped
                      </button>
                      <button className="btn" onClick={() => markDelivered(o.id)}>
                        <PackageCheck className="h-4 w-4" /> Mark delivered
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-12 border-t bg-white/60">
        <div className="container py-6 text-sm text-stone-600">
          <div className="flex items-center justify-between">
            <p>© {new Date().getFullYear()} ELAKSI ATELIER. Admin</p>
            <p className="flex items-center gap-2">
              <Shield className="h-4 w-4" /> Protected
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
