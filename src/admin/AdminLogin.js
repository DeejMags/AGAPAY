import React, { useState } from 'react';

const DEFAULT_ADMIN_LIST = (process.env.REACT_APP_ADMIN_EMAILS || 'admin@agapay.com,admin@gmail.com')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

const FALLBACK_PASSWORDS = {
  'admin@gmail.com': 'Admin1234',
};

const SHARED_ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'Admin1234';

const ALLOWED_ADMIN_EMAILS = DEFAULT_ADMIN_LIST.length ? DEFAULT_ADMIN_LIST : ['admin@agapay.com'];

function resolveAdminPassword(email) {
  return FALLBACK_PASSWORDS[email] || SHARED_ADMIN_PASSWORD;
}

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!ALLOWED_ADMIN_EMAILS.includes(normalizedEmail)) {
      setError('You do not have access to the admin console.');
      return;
    }
    const expectedPassword = resolveAdminPassword(normalizedEmail);
    if (!expectedPassword || password !== expectedPassword) {
      setError('Invalid credentials');
      return;
    }
    onLogin({ email: normalizedEmail });
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
          Admin access is restricted. Configure allowed addresses via <code>REACT_APP_ADMIN_EMAILS</code> and the password via <code>REACT_APP_ADMIN_PASSWORD</code>.
        </div>
      </form>
    </div>
  );
}