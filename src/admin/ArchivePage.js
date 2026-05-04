import React from 'react';
import OrdersManagement from './OrdersManagement';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import authFetch from '../utils/authFetch';

export default function ArchivePage({ orders, setOrders, users, setUsers, reports, setReports, refreshOrders }) {
  // Unarchive user
  async function unarchiveUser(id) {
    try {
      // try backend first
      const res = await authFetch(`/api/users/${encodeURIComponent(id)}/unarchive`, { method: 'POST' });
      if (!res.ok) throw new Error('backend unarchive failed');
    } catch (e) {
      try {
        await updateDoc(doc(db, 'users', id), { archived: false, status: 'active', active: true });
      } catch (er) {
        console.error('Unarchive user failed', er);
        alert('Failed to unarchive user');
        return;
      }
    }
    // update UI
    setUsers(prev => (prev || []).map(u => u.id === id ? { ...u, archived: false, status: 'active', active: true } : u));
  }

  // Unarchive report
  async function unarchiveReport(id) {
    try {
      const res = await authFetch(`/api/reports/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'open' }) });
      if (!res.ok) throw new Error('backend restore failed');
    } catch (e) {
      try {
        await updateDoc(doc(db, 'reports', id), { status: 'open' });
      } catch (er) {
        console.error('Unarchive report failed', er);
        alert('Failed to unarchive report');
        return;
      }
    }
    // refresh reports list if parent provided
    if (typeof setReports === 'function') setReports(prev => (prev || []).map(r => r.id === id ? { ...r, status: 'open' } : r));
  }

  const archivedUsers = (users || []).filter(u => Boolean(u.archived) || String(u.status || '').toLowerCase() === 'archived');
  const archivedReports = (reports || []).filter(r => String(r.status || '').toLowerCase() === 'archived');

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Archive</h2>

      <section className="mb-8">
        <h3 className="text-xl font-semibold mb-2">Archived Orders</h3>
        <OrdersManagement orders={orders} setOrders={setOrders} initialStatus="Archived" onRefresh={refreshOrders} />
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold">Archived Users</h3>
        </div>
        {archivedUsers.length === 0 ? (
          <div className="text-sm text-gray-500">No archived users.</div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl shadow mb-4">
            <table className="min-w-full">
              <thead>
                <tr className="bg-teal-100 text-teal-700">
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedUsers.map(u => (
                  <tr key={u.id} className="bg-white border-b">
                    <td className="p-3">{u.fullName || u.name || u.username || String(u.id).slice(0,8)}</td>
                    <td className="p-3">{u.email || '—'}</td>
                    <td className="p-3">{u.status || (u.archived ? 'Archived' : '')}</td>
                    <td className="p-3">
                      <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={() => unarchiveUser(u.id)}>Unarchive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold">Archived Reports</h3>
        </div>
        {archivedReports.length === 0 ? (
          <div className="text-sm text-gray-500">No archived reports.</div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl shadow mb-4">
            <table className="min-w-[700px] w-full table-auto">
              <thead>
                <tr className="bg-teal-100 text-teal-700">
                  <th className="p-3 text-left">Reporter</th>
                  <th className="p-3 text-left">Reported user</th>
                  <th className="p-3 text-left">Reason</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedReports.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="p-3">{r.reporterName || r.reporterEmail || 'Unknown'}</td>
                    <td className="p-3">{r.reportedUserName || r.reportedUserEmail || 'Unknown'}</td>
                    <td className="p-3 max-w-xs break-words">{r.reason || '—'}</td>
                    <td className="p-3">{r.status}</td>
                    <td className="p-3">
                      <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={() => unarchiveReport(r.id)}>Unarchive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
