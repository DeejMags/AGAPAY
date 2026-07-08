import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'

export default function Signup(){
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function submit(e){
    e.preventDefault()
    setError('')
    
    if(password !== confirmPassword){
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    
    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      // Update profile with display name
      await updateProfile(user, {
        displayName: username
      })
      
      // Get Firebase ID token
      const token = await user.getIdToken()
      
      // Store token and user info in localStorage
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify({
        uid: user.uid,
        id: user.uid,
        email: user.email,
        displayName: username,
        firstName: username.split(' ')[0],
        lastName: username.split(' ').slice(1).join(' '),
        profilePic: '',
        role: 'user'
      }))
      
      navigate('/marketplace')
      window.location.reload()
    } catch (err) {
      console.error('Signup error:', err)
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already in use')
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak')
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address')
      } else {
        setError(err.message || 'Signup failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="py-8 container mx-auto px-4 max-w-md">
      <h1 className="text-2xl font-bold">Sign up</h1>
      {error && <div className="mt-2 text-red-600">{error}</div>}
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <input 
          value={username} 
          onChange={e=>setUsername(e.target.value)} 
          placeholder="Full Name" 
          className="p-2 border rounded"
          required
        />
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
        <input 
          value={confirmPassword} 
          onChange={e=>setConfirmPassword(e.target.value)} 
          type="password" 
          placeholder="Confirm Password" 
          className="p-2 border rounded"
          required
        />
        <button 
          className="p-2 bg-teal-600 text-white rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
