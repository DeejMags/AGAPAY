import React, { useState } from 'react';
export default function OrdersManagement({ orders, setOrders }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Orders & Shopping Cart</h2>
      <div className="mb-4">
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="border rounded-lg px-4 py-2">
          <option value="all">All</option>
          <option value="Pending">Pending</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>
      <table className="w-full bg-white rounded-xl shadow mb-8">
        <thead>
          <tr className="bg-teal-100 text-teal-700">
            <th className="p-3 text-left">Product</th>
            <th className="p-3 text-left">Buyer</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(o => (
            <tr key={o.id} className="border-b">
              <td className="p-3">{o.product}</td>
              <td className="p-3">{o.buyer}</td>
              <td className="p-3">{o.status}</td>
              <td className="p-3">
                <button className="text-blue-600 hover:underline mr-2">Update</button>
                <button className="text-red-600 hover:underline">Cancel</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
