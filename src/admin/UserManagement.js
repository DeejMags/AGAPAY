import React, { useState } from 'react';
export default function UserManagement() {
  // Demo users
  const [search, setSearch] = useState('');
  const users = [
    { id: 1, name: 'Admin', email: 'admin@agapay.com', phone: '09170000000', address: 'HQ', status: 'Active' },
    { id: 2, name: 'Juan Dela Cruz', email: 'juan@email.com', phone: '09171234567', address: 'Manila', status: 'Active' },
    { id: 3, name: 'Maria Santos', email: 'maria@email.com', phone: '09181234567', address: 'Cebu', status: 'Suspended' },
    // ...more users
  ];
  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">User Management</h2>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..." className="border rounded-lg px-4 py-2 mb-4 w-full max-w-md" />
      <table className="w-full bg-white rounded-xl shadow mb-8">
        <thead>
          <tr className="bg-teal-100 text-teal-700">
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Email</th>
            <th className="p-3 text-left">Phone</th>
            <th className="p-3 text-left">Address</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(u => (
            <tr key={u.id} className="border-b">
              <td className="p-3">{u.name}</td>
              <td className="p-3">{u.email}</td>
              <td className="p-3">{u.phone}</td>
              <td className="p-3">{u.address}</td>
              <td className="p-3">{u.status}</td>
              <td className="p-3">
                <button className="text-teal-600 hover:underline mr-2">Edit</button>
                <button className="text-yellow-600 hover:underline mr-2">Reset PW</button>
                <button className="text-red-600 hover:underline">Suspend</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
