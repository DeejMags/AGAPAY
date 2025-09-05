import React, { useState } from 'react'

export default function LoginForm({ onSuccess }){
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')

  function submit(e){
    e.preventDefault()
    setError('')
    const users = JSON.parse(localStorage.getItem('agapay_users') || '[]')
    const user = users.find(u => u.email === email)
    if(!user) return setError('No account with that email')
    if(user.password !== password) return setError('Wrong password')
    const token = `t_${Math.random().toString(36).slice(2)}`
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    if(onSuccess) onSuccess()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {error && <div className="text-red-600">{error}</div>}
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="p-2 border rounded" />
      <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="p-2 border rounded" />
      <button className="p-2 bg-teal-600 text-white rounded">Login</button>
    </form>
  )
}
