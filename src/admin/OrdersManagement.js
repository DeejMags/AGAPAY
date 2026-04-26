import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function OrdersManagement({ orders, setOrders }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const filtered = (orders || []).filter(o => {
    if (statusFilter !== 'all' && String(o.status) !== String(statusFilter)) return false;
    if (typeFilter !== 'all' && String((o.type || '').toLowerCase()) !== String(typeFilter).toLowerCase()) return false;
    return true;
  });

  async function setOrderStatus(id, status) {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
      setOrders(prev => (prev || []).map(o => o.id === id ? { ...o, status } : o));
    } catch (e) {
      console.error('Failed to update order status', e);
      alert('Failed to update order status');
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Orders & Shopping Cart</h2>
      <div className="mb-4 flex gap-3 items-center">
        <div>
          <label className="text-sm text-gray-600 mr-2">Status</label>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2">
            <option value="all">All</option>
            <option value="Pending">Pending</option>
            <option value="Delivered">Delivered</option>
            <option value="Archived">Archived</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600 mr-2">Type</label>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2">
            <option value="all">All</option>
            <option value="delivery">Delivery</option>
            <option value="pickup">Pickup</option>
          </select>
        </div>
      </div>
      <table className="w-full bg-white rounded-xl shadow mb-8">
        <thead>
          <tr className="bg-teal-100 text-teal-700">
            <th className="p-3 text-left">Product</th>
            <th className="p-3 text-left">Type</th>
            <th className="p-3 text-left">Buyer</th>
            <th className="p-3 text-left">Contact</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(o => (
            <tr key={o.id} className="border-b">
              <td className="p-3">{o.productTitle || o.product || 'Item'}</td>
              <td className="p-3">{o.type || '-'}</td>
              <td className="p-3">{o.buyerName || o.buyerId || o.buyer || 'Buyer'}</td>
              <td className="p-3">{o.buyerContact || o.buyerEmail || '-'}</td>
              <td className="p-3">{o.status}</td>
              <td className="p-3">
                <button onClick={() => setOrderStatus(o.id, 'Delivered')} className="text-blue-600 hover:underline mr-2">Mark Delivered</button>
                <button onClick={() => setOrderStatus(o.id, 'Cancelled')} className="text-red-600 hover:underline mr-2">Cancel</button>
                <button onClick={() => {
                  if (!window.confirm('Archive this order? It will be hidden from default lists.')) return;
                  setOrderStatus(o.id, 'Archived');
                }} className="text-gray-600 hover:underline">Archive</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
