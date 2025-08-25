import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setToken, api } from '../auth';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    try {
      setErr('');
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);           // this now triggers the global "elaksi-auth" event
      nav('/account');               // go to account
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="container py-10 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      {err && <div className="mb-3 text-red-600">{err}</div>}
      <form onSubmit={submit} className="space-y-3">
        <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn btn-primary w-full">Login</button>
      </form>
      <div className="mt-3 text-sm">
        No account? <Link className="text-amber-700 underline" to="/register">Register</Link>
      </div>
    </div>
  );
}
