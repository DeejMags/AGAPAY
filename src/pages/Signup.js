import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Signup(){
  const [username,setUsername] = useState('')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [confirmPassword,setConfirmPassword] = useState('')
  const [role,setRole] = useState('user')
  const [error,setError] = useState('')
  const navigate = useNavigate()

  function submit(e){
    e.preventDefault()
    setError('')
    if(password !== confirmPassword){
      setError('Passwords do not match')
      return
    }
    const users = JSON.parse(localStorage.getItem('agapay_users') || '[]')
    if(users.find(u => u.email === email)){
      setError('Email already exists')
      return
    }
    const id = `u_${Date.now()}`
    const user = { id, username, email, password, profilePic: '', ratings: [], role }
    users.push(user)
    localStorage.setItem('agapay_users', JSON.stringify(users))
    const token = `t_${Math.random().toString(36).slice(2)}`
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    if(role === 'admin'){
      navigate('/admin')
    }else{
      navigate('/marketplace')
    }
    window.location.reload()
  }

  return (
    <div className="py-8 container mx-auto px-4 max-w-md">
      <h1 className="text-2xl font-bold">Sign up</h1>
      {error && <div className="mt-2 text-red-600">{error}</div>}
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="p-2 border rounded" />
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="p-2 border rounded" />
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="p-2 border rounded" />
        <input value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} type="password" placeholder="Confirm Password" className="p-2 border rounded" />
        <div className="flex gap-4 items-center">
          <label className="font-medium">Role:</label>
          <select value={role} onChange={e=>setRole(e.target.value)} className="border rounded p-2">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button className="p-2 bg-teal-600 text-white rounded">Create account</button>
      </form>
    </div>
  )
}
