import React, { useState, useRef } from 'react'
import { loginWithEmail, signInWithGoogle, mapAuthError } from '../utils/firebaseAuthService';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

export default function LoginForm({ onSuccess }){
  const loginEmailRef = useRef(''); // always tracks the typed login email

  const [bannedOpen, setBannedOpen] = useState(false);
  const [bannedMsg, setBannedMsg] = useState('');
  const [bannedUserId, setBannedUserId] = useState('');
  const [bannedUserEmail, setBannedUserEmail] = useState('');
  const [bannedUserName, setBannedUserName] = useState('');
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);

  function openBannedModal(message, reason, userId, userEmail, userName) {
    setBannedMsg(reason || message || '');
    setBannedUserId(userId || '');
    setBannedUserEmail(userEmail || loginEmailRef.current || '');
    setBannedUserName(userName || '');
    setShowAppealForm(false);
    setAppealReason('');
    setAppealSubmitted(false);
    setBannedOpen(true);
  }

  async function submitAppeal() {
    if (!appealReason.trim()) return;
    setAppealSubmitting(true);
    try {
      // Resolve user info from Firestore if it's missing (e.g. when the error path didn't carry it)
      let resolvedUserId = bannedUserId;
      let resolvedEmail = bannedUserEmail || loginEmailRef.current || '';
      let resolvedName = bannedUserName;

      if (resolvedEmail && (!resolvedUserId || !resolvedName)) {
        try {
          const snap = await getDocs(query(collection(db, 'users'), where('email', '==', resolvedEmail.toLowerCase())));
          if (!snap.empty) {
            const d = snap.docs[0];
            const data = d.data();
            resolvedUserId = resolvedUserId || d.id;
            const combinedName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
            resolvedName = resolvedName || combinedName || data.fullName || data.name || data.username || data.displayName || '';
          }
        } catch { /* non-critical — save with whatever we have */ }
      }

      await addDoc(collection(db, 'ban_appeals'), {
        userId: resolvedUserId || '',
        userName: resolvedName || resolvedEmail || '',
        userEmail: resolvedEmail || '',
        banReason: bannedMsg || '',
        reason: appealReason.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setAppealSubmitted(true);
      setShowAppealForm(false);
      setAppealReason('');
    } catch (e) {
      console.error('Failed to submit appeal:', e);
      alert('Failed to submit appeal. Please try again.');
    } finally {
      setAppealSubmitting(false);
    }
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
      if (errorMsg.includes('banned') || err.code === 'auth/user-disabled') {
        const rawReason = err.banReason || errorMsg.replace(/^user is banned:?\s*/i, '').trim() || null;
        const cleanReason = rawReason &&
          !rawReason.toLowerCase().startsWith('your account') &&
          !rawReason.startsWith('Firebase:') &&
          !rawReason.toLowerCase().includes('auth/user-disabled')
          ? rawReason : null;
        openBannedModal(null, cleanReason,
          err.bannedUserId || null, err.userEmail || null, err.userName || null);
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
      if (errorMsg.includes('banned') || err.code === 'auth/user-disabled') {
        const rawReason = err.banReason || errorMsg.replace(/^user is banned:?\s*/i, '').trim() || null;
        const cleanReason = rawReason &&
          !rawReason.toLowerCase().startsWith('your account') &&
          !rawReason.startsWith('Firebase:') &&
          !rawReason.toLowerCase().includes('auth/user-disabled')
          ? rawReason : null;
        openBannedModal(null, cleanReason,
          err.bannedUserId || null,
          err.userEmail || email.trim() || null,
          err.userName || null);
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
      <input value={email} onChange={e=>{ setEmail(e.target.value); loginEmailRef.current = e.target.value.trim(); if (error) setError(''); }} placeholder="Email" className="p-2 border rounded" />
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
          <div className="text-5xl mb-3">⛔</div>
          <h2 className="text-2xl font-bold text-red-600 mb-1">Account Banned</h2>
          <p className="text-gray-500 text-sm mb-4">Your account has been suspended from Agapay.</p>

          {bannedMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-left">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Reason</p>
              <p className="text-gray-700 text-sm">{bannedMsg}</p>
            </div>
          )}

          {appealSubmitted ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-left">
              <p className="text-green-700 font-semibold text-sm">✅ Appeal Submitted</p>
              <p className="text-green-600 text-xs mt-1">Your appeal has been received. The admin will review it shortly.</p>
            </div>
          ) : showAppealForm ? (
            <div className="text-left mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Why should your ban be lifted?</label>
              <textarea
                value={appealReason}
                onChange={e => setAppealReason(e.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                placeholder="Explain your situation..."
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{appealReason.length}/1000</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={submitAppeal}
                  disabled={appealSubmitting || !appealReason.trim()}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
                >
                  {appealSubmitting ? 'Submitting...' : 'Submit Appeal'}
                </button>
                <button
                  onClick={() => { setShowAppealForm(false); setAppealReason(''); }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAppealForm(true)}
              className="w-full px-4 py-2 mb-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium"
            >
              📝 Request Appeal
            </button>
          )}

          <button
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            onClick={() => setBannedOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    )}
    </>
  )
}

// In Navbar.js, update the redirect logic to:
// if(user && user.role === 'admin') { navigate('/admin'); }
