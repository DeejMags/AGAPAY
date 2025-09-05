import React from 'react'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'

export default function AuthModal({ open, type='login', onClose }){
  if(!open) return null

  function success(){
    if(onClose) onClose()
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
      <div className="relative bg-white rounded-lg p-6 w-full max-w-md shadow-lg animate-fade-in">
        <button className="absolute top-3 right-3 text-gray-600" onClick={onClose}>✕</button>
        <h2 className="text-xl font-semibold mb-4">{type==='login' ? 'Login' : 'Sign up'}</h2>
        {type==='login' ? <LoginForm onSuccess={success} /> : <SignupForm onSuccess={success} />}
      </div>
    </div>
  )
}
