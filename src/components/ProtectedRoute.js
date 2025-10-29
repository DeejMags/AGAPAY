import React from 'react'
import { Navigate } from 'react-router-dom'
import { auth } from '../firebase'

export default function ProtectedRoute({ children }){
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if(!user) return <Navigate to="/login" replace />
  const status = String(user.status || '').toLowerCase();
  const isBanned = user.banned === true || status === 'banned' || status.includes('ban') || (user.active === false && status !== 'active');
  if (isBanned) {
    try {
      auth.signOut?.();
    } catch {}
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch {}
    return <Navigate to="/login" replace />
  }
  return children
}
