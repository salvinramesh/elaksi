import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setToken, api } from '../auth';

export default function Register(){
  const nav = useNavigate();
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [phone,setPhone]=useState('');
  const [password,setPassword]=useState('');
  const [err,setErr]=useState('');

  async function submit(e){
    e.preventDefault();
    try{
      const res = await api('/api/auth/register', { method:'POST', body: JSON.stringify({ name, email, phone, password }) });
      setToken(res.token);
      nav('/account');
    }catch(e){ setErr(e.message); }
  }

  return (
    <div className="container py-10 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Create account</h1>
      {err && <div className="mb-3 text-red-600">{err}</div>}
      <form onSubmit={submit} className="space-y-3">
        <input className="input" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" placeholder="Phone (optional)" value={phone} onChange={e=>setPhone(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn btn-primary w-full">Create account</button>
      </form>
      <div className="mt-3 text-sm">Have an account? <Link className="text-amber-700 underline" to="/login">Login</Link></div>
    </div>
  );
}
