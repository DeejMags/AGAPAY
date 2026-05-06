import React, { useState } from 'react'
import { auth } from '../firebase';
import { loginWithEmail, signInWithGoogle, mapAuthError, isUserBanned, getBanReason } from '../utils/firebaseAuthService';
import { signOut } from 'firebase/auth';

export default function LoginForm({ onSuccess }){
  const [bannedOpen, setBannedOpen] = useState(false);
  const [bannedMsg, setBannedMsg] = useState('Your account has been banned for violating our policies. If you believe this is a mistake, please contact support.');

  function openBannedModal(message, reason) {
    const base = message || 'Your account has been banned for violating our policies. If you believe this is a mistake, please contact support.';
    const full = reason ? `${base}\n\nReason: ${reason}` : base;
    setBannedMsg(full);
    setBannedOpen(true);
  }

  // Google Login handler
  async function handleGoogleLogin(e) {
    e.preventDefault();
    try {
      const { user, profile, isAdmin } = await signInWithGoogle();
      
      // Store profile and auth token
      localStorage.setItem('user', JSON.stringify({
        id: profile.id,
        username: profile.username,
        email: profile.email,
        phone: profile.phone || '',
        profilePic: user.photoURL || '',
        role: profile.role,
      }));
      localStorage.setItem('token', user.uid);
      
      // Redirect admins
      if (isAdmin) {
        window.location.href = '/admin';
      } else if (onSuccess) {
        onSuccess(profile);
      }
    } catch (err) {
      const errorMsg = err.message || mapAuthError(err);
      if (errorMsg.includes('banned')) {
        openBannedModal(errorMsg);
      } else {
        setError(errorMsg);
      }
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
      const { user, profile, isAdmin } = await loginWithEmail(email, password);
      
      // Store profile and auth token
      localStorage.setItem('token', user.uid);
      localStorage.setItem('user', JSON.stringify({
        id: profile.id,
        username: profile.username,
        email: profile.email,
        phone: profile.phone || '',
        profilePic: user.photoURL || '',
        role: profile.role,
      }));
      
      // Redirect admins
      if (isAdmin) {
        window.location.href = '/admin';
      } else if (onSuccess) {
        onSuccess(profile);
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = err.message || mapAuthError(err);
      if (errorMsg.includes('banned')) {
        openBannedModal(errorMsg);
      } else {
        setError(errorMsg);
      }
    }
  }

  return (
    <>
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

    {/* Banned popup */}
    {bannedOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
          <div className="text-lg font-semibold mb-2">Account Banned</div>
          <div className="text-sm text-gray-700 whitespace-pre-line">{bannedMsg}</div>
          <div className="flex justify-end gap-2 mt-4">
            <button className="px-4 py-2 rounded bg-teal-600 text-white" onClick={()=> setBannedOpen(false)}>OK</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// In Navbar.js, update the redirect logic to:
// if(user && user.role === 'admin') { navigate('/admin'); }
