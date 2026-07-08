import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function submit(e){
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      // Get Firebase ID token
      const token = await user.getIdToken()
      
      // Store token and user info in localStorage
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify({
        uid: user.uid,
        id: user.uid,
        email: user.email,
        displayName: user.displayName || email.split('@')[0],
        profilePic: user.photoURL || '',
        role: 'user'
      }))
      
      navigate('/marketplace')
      window.location.reload()
    } catch (err) {
      console.error('Login error:', err)
      if (err.code === 'auth/user-not-found') {
        setError('No account with that email')
      } else if (err.code === 'auth/wrong-password') {
        setError('Wrong password')
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address')
      } else {
        setError(err.message || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="py-8 container mx-auto px-4 max-w-md">
      <h1 className="text-2xl font-bold">Login</h1>
      {error && <div className="mt-2 text-red-600">{error}</div>}
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <input 
          value={email} 
          onChange={e=>setEmail(e.target.value)} 
          placeholder="Email" 
          className="p-2 border rounded"
          type="email"
          required
        />
        <input 
          value={password} 
          onChange={e=>setPassword(e.target.value)} 
          type="password" 
          placeholder="Password" 
          className="p-2 border rounded"
          required
        />
        <button 
          className="p-2 bg-teal-600 text-white rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}
