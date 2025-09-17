import React, { useState } from 'react'

export default function SignupForm({ onSuccess }){
  const [name,setName] = useState('')
  const [email,setEmail] = useState('')
  const [phone,setPhone] = useState('')
  const [password,setPassword] = useState('')
  const [confirm,setConfirm] = useState('')
  const [role,setRole] = useState('user')
  const [error,setError] = useState('')

  function submit(e){
    e.preventDefault()
    setError('')
    if(password !== confirm) return setError('Passwords do not match')
    const users = JSON.parse(localStorage.getItem('agapay_users') || '[]')
    if(users.find(u=>u.email===email)) return setError('Email already exists')
    const id = `u_${Date.now()}`
    const user = { id, username: name, email, phone, password, profilePic:'', ratings:[], address:'', role }
    users.push(user)
    localStorage.setItem('agapay_users', JSON.stringify(users))
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', `t_${Math.random().toString(36).slice(2)}`)
    if(role === 'admin') {
      window.location.href = '/admin';
    } else {
      if(onSuccess) onSuccess(user);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {error && <div className="text-red-600">{error}</div>}
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="p-2 border rounded" />
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="p-2 border rounded" />
      <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone" className="p-2 border rounded" />
      <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="p-2 border rounded" />
      <input value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" placeholder="Confirm password" className="p-2 border rounded" />
      <div className="flex gap-4 items-center">
        <label className="font-medium">Role:</label>
        <select value={role} onChange={e=>setRole(e.target.value)} className="border rounded p-2">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button className="p-2 bg-teal-600 text-white rounded">Create account</button>
    </form>
  )
}
