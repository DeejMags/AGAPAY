import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import ConfirmModal from '../components/ConfirmModal';

export default function OrdersManagement({ orders, setOrders, initialStatus = null, onRefresh = null }) {
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'all');
  const [typeFilter, setTypeFilter] = useState('all');
  const filtered = (orders || []).filter(o => {
    const status = String(o.status || '').toLowerCase();
    // If this instance is the Archive tab, only show archived orders
    if (String(initialStatus || '').toLowerCase() === 'archived') {
      if (status !== 'archived') return false;
      // allow typeFilter to still filter within archived
    } else {
      // In normal Orders view, exclude archived orders from 'All'
      if (status === 'archived') return false;
      if (statusFilter !== 'all' && String(o.status) !== String(statusFilter)) return false;
    }
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

  // Archive modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  function openArchiveConfirm(id) {
    setConfirmTarget(id);
    setArchiveReason('');
    setConfirmOpen(true);
  }

  async function confirmArchive() {
    const id = confirmTarget;
    if (!id) return setConfirmOpen(false);
    setConfirmLoading(true);
    try {
      await setOrderStatus(id, 'Archived');
      // navigate admin to Archive tab
      try { window.dispatchEvent(new Event('navigate-archive')); } catch (_) {}
    } finally {
      setConfirmLoading(false);
      setConfirmOpen(false);
      setConfirmTarget(null);
      setArchiveReason('');
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{String(initialStatus || '').toLowerCase() === 'archived' ? 'Archive' : 'Orders & Shopping Cart'}</h2>
      <div className="mb-4 flex gap-3 items-center justify-between">
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
        <div>
          <button onClick={() => onRefresh && onRefresh()} className="px-3 py-2 bg-teal-600 text-white border rounded shadow-sm">Refresh</button>
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
                <div className="flex gap-2">
                  <button onClick={() => setOrderStatus(o.id, 'Delivered')} className="px-2 py-1 bg-teal-600 text-white rounded text-sm">Mark Delivered</button>
                  <button onClick={() => setOrderStatus(o.id, 'Cancelled')} className="px-2 py-1 bg-red-600 text-white rounded text-sm">Cancel</button>
                  <button onClick={() => openArchiveConfirm(o.id)} className="px-2 py-1 bg-gray-600 text-white rounded text-sm">Archive</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmModal
        open={confirmOpen}
        title="Archive order"
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null); setArchiveReason(''); }}
        onConfirm={confirmArchive}
        confirmLabel="Archive"
        confirmDanger={true}
        confirmLoading={confirmLoading}
      >
        <div className="mb-2">You are about to archive this order. It will be hidden from default lists but kept for records.</div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Reason (optional)</label>
          <textarea value={archiveReason} onChange={e=>setArchiveReason(e.target.value)} className="w-full border rounded p-2 mt-1" rows={3} />
        </div>
      </ConfirmModal>
    </div>
  );
}
