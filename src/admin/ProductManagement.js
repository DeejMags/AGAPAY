import React, { useState } from 'react';
export default function ProductManagement({ products, setProducts }) {
  const [search, setSearch] = useState('');
  const filtered = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  function handleApprove(id) {
    const updated = products.map(p => p.id === id ? { ...p, status: 'active' } : p);
    setProducts(updated);
    localStorage.setItem('agapay_products', JSON.stringify(updated));
  }
  function handleDeny(id) {
    const updated = products.map(p => p.id === id ? { ...p, status: 'denied' } : p);
    setProducts(updated);
    localStorage.setItem('agapay_products', JSON.stringify(updated));
  }
  function handleDelete(id) {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    localStorage.setItem('agapay_products', JSON.stringify(updated));
  }
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Product Management</h2>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products..." className="border rounded-lg px-4 py-2 mb-4 w-full max-w-md" />
      <table className="w-full bg-white rounded-xl shadow mb-8">
        <thead>
          <tr className="bg-teal-100 text-teal-700">
            <th className="p-3 text-left">Title</th>
            <th className="p-3 text-left">Price</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Owner</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => (
            <tr key={p.id} className="border-b">
              <td className="p-3">{p.title}</td>
              <td className="p-3">₱{p.price}</td>
              <td className="p-3">{p.status}</td>
              <td className="p-3">{p.owner || p.sellerId || 'Unknown'}</td>
              <td className="p-3">
                {p.status === 'pending' && (
                  <>
                    <button className="text-teal-600 hover:underline mr-2" onClick={()=>handleApprove(p.id)}>Approve</button>
                    <button className="text-red-600 hover:underline mr-2" onClick={()=>handleDeny(p.id)}>Deny</button>
                  </>
                )}
                <button className="text-blue-600 hover:underline mr-2">Edit</button>
                <button className="text-red-600 hover:underline" onClick={()=>handleDelete(p.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
