import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

export default function ProtectedRoute({ children }){
  const [authReady, setAuthReady] = useState(false)
  const [firebaseUser, setFirebaseUser] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setAuthReady(true)
    })
    return unsubscribe
  }, [])

  // Still waiting for Firebase to initialize
  if (!authReady) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>
  }

  // Check if user is logged in via Firebase AND has localStorage record
  if (!firebaseUser) {
    return <Navigate to="/login" replace />
  }

  // Check if user is banned
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if (user) {
    const status = String(user.status || '').toLowerCase()
    const isBanned = user.banned === true || status === 'banned' || status.includes('ban') || (user.active === false && status !== 'active')
    if (isBanned) {
      try {
        auth.signOut()
      } catch {}
      try {
        localStorage.removeItem('user')
        localStorage.removeItem('token')
      } catch {}
      return <Navigate to="/login" replace />
    }
  }

  return children
}
