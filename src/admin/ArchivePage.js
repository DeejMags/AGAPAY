import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import authFetch from '../utils/authFetch';

export default function ArchivePage({ users, setUsers, reports, setReports, products, setProducts }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [appeals, setAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(null);

  // Load pending ban appeals
  useEffect(() => {
    let cancelled = false;
    async function loadAppeals() {
      try {
        const q = query(collection(db, 'ban_appeals'), where('status', '==', 'pending'));
        const snap = await getDocs(q);
        if (!cancelled) {
          setAppeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (e) {
        console.error('Failed to load appeals', e);
      } finally {
        if (!cancelled) setAppealsLoading(false);
      }
    }
    loadAppeals();
    return () => { cancelled = true; };
  }, []);

  // Restore a banned user + accept their appeal
  async function restoreUser(userId, appealId) {
    if (actionBusy) return;
    setActionBusy(userId);
    try {
      const res = await authFetch(`/api/users/${encodeURIComponent(userId)}/unban`, { method: 'POST' });
      if (!res.ok) throw new Error('backend unban failed');
    } catch (e) {
      try {
        await updateDoc(doc(db, 'users', userId), { banned: false, status: 'active', banReason: null });
      } catch (er) {
        console.error('Unban user failed', er);
        alert('Failed to restore user');
        setActionBusy(null);
        return;
      }
    }
    if (appealId) {
      try {
        await updateDoc(doc(db, 'ban_appeals', appealId), { status: 'accepted', resolvedAt: serverTimestamp() });
        setAppeals(prev => prev.filter(a => a.id !== appealId));
      } catch (e) {
        console.error('Failed to update appeal', e);
      }
    }
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        type: 'ban_appeal_accepted',
        message: 'Your ban appeal has been accepted. Your account has been restored.',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to send notification', e);
    }
    setUsers(prev => (prev || []).map(u => u.id === userId ? { ...u, banned: false, status: 'active', banReason: null } : u));
    setActionBusy(null);
  }

  // Decline a ban appeal (keep user banned)
  async function declineAppeal(userId, appealId) {
    if (actionBusy) return;
    setActionBusy(appealId);
    try {
      await updateDoc(doc(db, 'ban_appeals', appealId), { status: 'declined', resolvedAt: serverTimestamp() });
      setAppeals(prev => prev.filter(a => a.id !== appealId));
    } catch (e) {
      console.error('Failed to decline appeal', e);
      alert('Failed to decline appeal');
      setActionBusy(null);
      return;
    }
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        type: 'ban_appeal_declined',
        message: 'Your ban appeal has been reviewed and declined. The ban remains in effect.',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to send notification', e);
    }
    setActionBusy(null);
  }

  // Unarchive a non-banned user
  async function unarchiveUser(id) {
    try {
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
    if (typeof setReports === 'function') setReports(prev => (prev || []).map(r => r.id === id ? { ...r, status: 'open' } : r));
  }

  // Unarchive product
  async function unarchiveProduct(id) {
    try {
      const res = await authFetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: false }) });
      if (!res.ok) throw new Error('backend restore failed');
    } catch (e) {
      try {
        await updateDoc(doc(db, 'products', id), { archived: false });
      } catch (er) {
        console.error('Unarchive product failed', er);
        alert('Failed to unarchive product');
        return;
      }
    }
    if (typeof setProducts === 'function') setProducts(prev => (prev || []).map(p => p.id === id ? { ...p, archived: false } : p));
  }

  // Delete product permanently
  async function deleteProduct(id) {
    try {
      const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('backend delete failed');
    } catch (e) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (er) {
        console.error('Delete product failed', er);
        alert('Failed to delete product');
        return;
      }
    }
    if (typeof setProducts === 'function') setProducts(prev => (prev || []).filter(p => p.id !== id));
    setConfirmDelete(null);
    alert('Product permanently deleted');
  }

  const bannedUsers = (users || []).filter(u => u.banned === true || String(u.status || '').toLowerCase() === 'banned');
  const archivedUsers = (users || []).filter(u =>
    (Boolean(u.archived) || String(u.status || '').toLowerCase() === 'archived') &&
    u.banned !== true &&
    String(u.status || '').toLowerCase() !== 'banned'
  );
  const archivedReports = (reports || []).filter(r => String(r.status || '').toLowerCase() === 'archived');
  const archivedProducts = (products || []).filter(p => Boolean(p.archived));

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Archive</h2>

      {/* Banned Users */}
      <section className="mb-8">
        <h3 className="text-xl font-semibold mb-3">Banned Users</h3>
        {bannedUsers.length === 0 ? (
          <div className="text-sm text-gray-500">No banned users.</div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl shadow mb-4">
            <table className="min-w-full">
              <thead>
                <tr className="bg-red-100 text-red-700">
                  <th className="p-3 text-left">User</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Ban Reason</th>
                  <th className="p-3 text-left">Appeal</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bannedUsers.map(u => {
                  const appeal = appeals.find(a => a.userId === u.id);
                  return (
                    <tr key={u.id} className="border-b hover:bg-red-50">
                      <td className="p-3">{u.fullName || u.name || u.username || String(u.id).slice(0, 8)}</td>
                      <td className="p-3">{u.email || '—'}</td>
                      <td className="p-3 text-sm text-gray-600">{u.banReason || '—'}</td>
                      <td className="p-3">
                        {appealsLoading ? (
                          <span className="text-xs text-gray-400">Loading...</span>
                        ) : appeal ? (
                          <div className="max-w-xs">
                            <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded mb-1">Pending Appeal</span>
                            <p className="text-xs text-gray-600 break-words">{appeal.reason}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No appeal</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 transition"
                            disabled={actionBusy === u.id}
                            onClick={() => restoreUser(u.id, appeal ? appeal.id : null)}
                          >
                            {actionBusy === u.id ? 'Restoring...' : 'Restore'}
                          </button>
                          {appeal && (
                            <button
                              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 transition"
                              disabled={actionBusy === appeal.id}
                              onClick={() => declineAppeal(u.id, appeal.id)}
                            >
                              {actionBusy === appeal.id ? 'Declining...' : 'Decline'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Archived Users (non-banned) */}
      <section className="mb-8">
        <h3 className="text-xl font-semibold mb-3">Archived Users</h3>
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
                  <tr key={u.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="p-3">{u.fullName || u.name || u.username || String(u.id).slice(0, 8)}</td>
                    <td className="p-3">{u.email || '—'}</td>
                    <td className="p-3">{u.status || (u.archived ? 'Archived' : '')}</td>
                    <td className="p-3">
                      <button className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition" onClick={() => unarchiveUser(u.id)}>Unarchive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Archived Products */}
      <section className="mb-8">
        <h3 className="text-xl font-semibold mb-3">Archived Products</h3>
        {archivedProducts.length === 0 ? (
          <div className="text-sm text-gray-500">No archived products.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {archivedProducts.map(p => (
              <div key={p.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                <div className="relative">
                  {p.photo && <img src={p.photo} alt={p.title} className="w-full h-40 object-cover" />}
                  {!p.photo && p.images && p.images.length > 0 && <img src={p.images[0]} alt={p.title} className="w-full h-40 object-cover" />}
                  <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-semibold">Archived</div>
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-sm truncate">{p.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">{p.category}</p>
                  <p className="text-sm font-bold text-teal-600 mt-2">P{p.price}</p>
                  {p.archivedReason && <p className="text-xs text-gray-600 mt-2 italic">{p.archivedReason}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
                      onClick={() => unarchiveProduct(p.id)}
                    >
                      Restore
                    </button>
                    <button
                      className="flex-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                      onClick={() => setConfirmDelete(p.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Archived Reports */}
      <section>
        <h3 className="text-xl font-semibold mb-3">Archived Reports</h3>
        {archivedReports.length === 0 ? (
          <div className="text-sm text-gray-500">No archived reports.</div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl shadow mb-4">
            <table className="min-w-[700px] w-full table-auto">
              <thead>
                <tr className="bg-teal-100 text-teal-700">
                  <th className="p-3 text-left">Reporter</th>
                  <th className="p-3 text-left">Reported User</th>
                  <th className="p-3 text-left">Reason</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedReports.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{r.reporterName || r.reporterEmail || 'Unknown'}</td>
                    <td className="p-3">{r.reportedUserName || r.reportedUserEmail || 'Unknown'}</td>
                    <td className="p-3 max-w-xs break-words">{r.reason || 'E'}</td>
                    <td className="p-3">{r.status}</td>
                    <td className="p-3">
                      <button className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition" onClick={() => unarchiveReport(r.id)}>Unarchive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold text-red-600 mb-2">Delete Product?</h3>
            <p className="text-gray-600 mb-4">
              This action cannot be undone. The product will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                onClick={() => deleteProduct(confirmDelete)}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}