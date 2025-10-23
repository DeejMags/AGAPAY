import React, { useState } from 'react'
import { auth } from '../firebase';

export default function SignupForm({ onSuccess }){
  // Google Sign Up handler
  async function handleGoogleSignup(e) {
    e.preventDefault();
    try {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // Ensure backend has a corresponding profile; if not, create it
      try {
        const r = await fetch('/api/auth/google', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, name: user.displayName, uid: user.uid })
        });
        if (!r.ok) throw new Error('Backend profile create failed');
        const profile = await r.json();
        const isAdmin = user.email === 'admin@agapay.com' || user.email === 'admin@gmail.com';
        localStorage.setItem('user', JSON.stringify({ id: profile.id || user.uid, username: user.displayName, email: user.email, phone: user.phoneNumber || '', profilePic: user.photoURL || '', role: isAdmin ? 'admin' : 'user' }));
        localStorage.setItem('token', user.uid);
        if (isAdmin) { window.location.replace('/admin'); return; }
        if (onSuccess) onSuccess(user);
      } catch (err) {
        console.warn('Failed to ensure backend profile for google signup', err);
        // still proceed with client session
        localStorage.setItem('user', JSON.stringify({ id: user.uid, username: user.displayName, email: user.email, phone: user.phoneNumber || '', profilePic: user.photoURL || '', role: 'user' }));
        localStorage.setItem('token', user.uid);
        if (onSuccess) onSuccess(user);
      }
    } catch (err) {
      setError('Google sign up failed: ' + err.message);
    }
  }
  const [name,setName] = useState('')
  const [email,setEmail] = useState('')
  const [phone,setPhone] = useState('')
  const [password,setPassword] = useState('')
  const [confirm,setConfirm] = useState('')
  const [role,setRole] = useState('user')
  const [error,setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({});


  function validateAll() {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Invalid email';
  // location removed
    if (!password) errs.password = 'Password is required';
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (password !== confirm) errs.confirm = 'Passwords do not match';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e){
    e.preventDefault();
    setError('');
    if (!validateAll()) return;
    try {
      // Create account via backend so server creates the Auth user and Firestore profile
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, phone, role, password })
      });
      if (!res.ok) {
        const j = await res.json().catch(()=>({ error: 'Signup failed' }));
        if (res.status === 409) setError(j.error || 'Email already exists');
        else setError(j.error || 'Signup failed');
        return;
      }
      const json = await res.json();
      // After backend creates the auth user, do a client sign-in so firebase client has currentUser
      const { signInWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
    const isAdmin = email === 'admin@agapay.com' || email === 'admin@gmail.com';
    const profile = { id: json.id || cred.user.uid, username: name, email, phone, profilePic: cred.user.photoURL || '', role: isAdmin ? 'admin' : role };
      localStorage.setItem('user', JSON.stringify(profile));
      localStorage.setItem('token', cred.user.uid);
      if(isAdmin) { window.location.replace('/admin'); return; }
      if(onSuccess) onSuccess(cred.user);
    } catch (err) {
      console.error('Signup error', err);
      setError('Sign up failed: ' + (err.message || String(err)));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
  {error && <div className="text-red-600">{error}</div>}
  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="p-2 border rounded" />
  {fieldErrors.name && <div className="text-red-500 text-sm">{fieldErrors.name}</div>}
  <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="p-2 border rounded" />
  {fieldErrors.email && <div className="text-red-500 text-sm">{fieldErrors.email}</div>}
  <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone" className="p-2 border rounded" />
  {/* location field removed */}
  <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="p-2 border rounded" />
  {fieldErrors.password && <div className="text-red-500 text-sm">{fieldErrors.password}</div>}
  <input value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" placeholder="Confirm password" className="p-2 border rounded" />
  {fieldErrors.confirm && <div className="text-red-500 text-sm">{fieldErrors.confirm}</div>}
      <div className="flex gap-4 items-center">
        <label className="font-medium">Role:</label>
        <select value={role} onChange={e=>setRole(e.target.value)} className="border rounded p-2">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button className="p-2 bg-teal-600 text-white rounded">Create account</button>
      <button type="button" className="p-2 bg-red-500 text-white rounded mt-2" onClick={handleGoogleSignup}>
        Sign Up with Google
      </button>
    </form>
  )
}
