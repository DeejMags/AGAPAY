
export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Demo admin and user accounts
  const demoAccounts = [
    { email: 'admin@agapay.com', password: 'admin123' },
    { email: 'juan@email.com', password: 'juanpass' },
    { email: 'maria@email.com', password: 'mariapass' },
  ];

  function handleSubmit(e) {
    e.preventDefault();
    const found = demoAccounts.find(acc => acc.email === email && acc.password === password);
    if (found) {
      onLogin();
    } else {
      setError('Invalid credentials');
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-teal-600 mb-4 text-center">Admin Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <button type="submit" className="bg-teal-600 text-white font-bold py-2 rounded-lg hover:bg-teal-700 transition">Login</button>
        <div className="text-xs text-gray-500 mt-2 text-center">
          Demo accounts:<br/>
          admin@agapay.com / admin123<br/>
          juan@email.com / juanpass<br/>
          maria@email.com / mariapass
        </div>
      </form>
    </div>
  );
}

import React, { useState } from 'react';
