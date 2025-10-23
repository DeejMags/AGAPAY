import React, { useState } from 'react'
import { auth } from '../firebase';

function mapAuthError(err) {
  const code = err && err.code ? String(err.code) : '';
  switch (code) {
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Try again or reset it.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.';
    case 'auth/popup-blocked':
      return 'Popup blocked by your browser. Allow popups and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was closed before completing.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';
    default:
      return 'Login failed. Please try again.';
  }
}

export default function LoginForm({ onSuccess }){
  // Google Login handler
  async function handleGoogleLogin(e) {
    e.preventDefault();
    try {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // Request backend profile (create if missing)
      try {
        const r = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, name: user.displayName, uid: user.uid }) });
        if (!r.ok) throw new Error('Failed to fetch/create profile');
        const profile = await r.json();
        const isAdmin = user.email === 'admin@agapay.com' || user.email === 'admin@gmail.com';
        const finalProfile = { id: profile.id || user.uid, username: profile.username || user.displayName, email: user.email, role: isAdmin ? 'admin' : profile.role || 'user' };
        localStorage.setItem('user', JSON.stringify(finalProfile));
        localStorage.setItem('token', user.uid);
        if (finalProfile.role === 'admin') window.location.href = '/admin';
        else if (onSuccess) onSuccess(finalProfile);
      } catch (err) {
        console.warn('Google login backend profile failed', err);
        setError('User does not exist. Please sign up first.');
        return;
      }
    } catch (err) {
      setError(mapAuthError(err));
    }
  }
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({});

  function validateAll() {
    const errs = {};
    if (!email.trim()) errs.email = 'Email is required';
    if (!password) errs.password = 'Password is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e){
    e.preventDefault();
    setError('');
    if (!validateAll()) return;
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      // After client signs in, fetch authoritative profile from backend
      try {
        const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        if (!r.ok) {
          const j = await r.json().catch(()=>({ error: 'Profile fetch failed' }));
          setError(j.error || 'No account with that email');
          return;
        }
        const profile = await r.json();
        localStorage.setItem('token', user.uid);
        localStorage.setItem('user', JSON.stringify(profile));
        if (profile.role === 'admin' || profile.email === 'admin@agapay.com' || profile.email === 'admin@gmail.com') {
          window.location.href = '/admin';
        } else if (onSuccess) onSuccess(profile);
      } catch (err) {
        console.warn('Failed to fetch backend profile after signin', err);
        setError('No account with that email');
        return;
      }
    } catch (err) {
      setError(mapAuthError(err));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}
      <input value={email} onChange={e=>{ setEmail(e.target.value); if (error) setError(''); }} placeholder="Email" className="p-2 border rounded" />
      {fieldErrors.email && <div className="text-red-500 text-sm">{fieldErrors.email}</div>}
      <input value={password} onChange={e=>{ setPassword(e.target.value); if (error) setError(''); }} type="password" placeholder="Password" className="p-2 border rounded" />
      {fieldErrors.password && <div className="text-red-500 text-sm">{fieldErrors.password}</div>}
      <button className="p-2 bg-teal-600 text-white rounded">Login</button>
      <button type="button" className="p-2 bg-red-500 text-white rounded mt-2" onClick={handleGoogleLogin}>
        Login with Google
      </button>
    </form>
  )
}

// In Navbar.js, update the redirect logic to:
// if(user && user.role === 'admin') { navigate('/admin'); }
