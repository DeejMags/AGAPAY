import React from 'react'
import { Navigate } from 'react-router-dom'
import { auth } from '../firebase'

export default function AdminProtectedRoute({ children }){
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if(!user) return <Navigate to="/login" replace />
  const email = String(user.email || '').toLowerCase();
  const role = String(user.role || '').toLowerCase();
  const isAdmin = role === 'admin' || email === 'admin@agapay.com' || email === 'admin@gmail.com';
  if(!isAdmin) {
    try { auth.signOut?.(); } catch {}
    return <Navigate to="/" replace />
  }
  const status = String(user.status || '').toLowerCase();
  const isBanned = user.banned === true || status === 'banned' || status.includes('ban') || (user.active === false && status !== 'active');
  if (isBanned) {
    try { auth.signOut?.(); } catch {}
    try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch {}
    return <Navigate to="/login" replace />
  }
  return children
}
