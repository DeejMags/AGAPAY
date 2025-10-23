import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import authFetch from '../utils/authFetch';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
export default function UserManagement({ users: parentUsers, setUsers: setParentUsers }) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState(parentUsers || []);
  const [loading, setLoading] = useState(!parentUsers);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmMode, setConfirmMode] = useState(null); // 'ban' | 'delete'
  const [typedConfirm, setTypedConfirm] = useState('');

  // Toast / notification
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyText, setNotifyText] = useState('');
  const [notifySuccess, setNotifySuccess] = useState(true);
  // auto-hide handled via effect below
  

  useEffect(() => {
    // If parent provided users, use them; otherwise fetch from backend then Firestore
    let mounted = true;
    async function fetchUsers() {
      setLoading(true);
      try {
        // Try backend first
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setUsers(Array.isArray(data) ? data : []);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend users fetch failed, using client Firestore:', err.message);
      }

      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const userList = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (mounted) setUsers(userList);
      } catch (err) {
        console.error('Error fetching users from Firestore:', err);
        if (mounted) setUsers([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (parentUsers) {
      setUsers(parentUsers);
      setLoading(false);
    } else {
      fetchUsers();
    }
    return () => { mounted = false; };
  }, [parentUsers]);

  const filtered = users.filter(u => (u.username || u.name || '').toLowerCase().includes(search.toLowerCase()));

  // Edit action removed: admin may use Ban/Delete which are handled below.

  async function handleDelete(id) {
    const stringId = typeof id === 'string' ? id : String(id);
    let deleted = false;
    try {
      const res = await authFetch(`/api/users/${stringId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Backend delete failed');
      deleted = true;
    } catch (err) {
      try {
        await deleteDoc(doc(db, 'users', stringId));
        deleted = true;
      } catch (e) {
        console.error('Delete fallback failed', e);
        deleted = false;
      }
    }

    // write admin log
    try {
      const adminUser = JSON.parse(localStorage.getItem('user') || 'null');
      const adminId = (adminUser && (adminUser.id || adminUser.authId)) || (auth && auth.currentUser && auth.currentUser.uid) || null;
      await addDoc(collection(db, 'admin_logs'), { action: 'delete_user', targetId: stringId, adminId, timestamp: serverTimestamp(), success: deleted });
    } catch (e) {
      console.warn('Failed to write admin log', e);
    }

    // update UI + toast
    if (deleted) {
      setUsers(prev => prev.filter(u => u.id !== stringId));
      if (setParentUsers) setParentUsers(prev => prev.filter(u => u.id !== stringId));
      setNotifyText('User deleted'); setNotifySuccess(true); setNotifyOpen(true);
    } else {
      setNotifyText('Failed to delete user'); setNotifySuccess(false); setNotifyOpen(true);
    }
  }

  async function handleBan(id) {
    try {
      // Try backend API first
      const res = await authFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Banned' })
      });
      if (!res.ok) throw new Error('Backend ban failed');
      // log admin action
      try {
        const adminUser = JSON.parse(localStorage.getItem('user') || 'null');
        const adminId = (adminUser && (adminUser.id || adminUser.authId)) || (auth && auth.currentUser && auth.currentUser.uid) || null;
        await addDoc(collection(db, 'admin_logs'), { action: 'ban_user', targetId: id, adminId, timestamp: serverTimestamp(), success: true });
      } catch (e) { console.warn('Failed to write admin log for ban', e); }
    } catch (err) {
      // Fallback to Firestore client
      await updateDoc(doc(db, 'users', id), { status: 'Banned' });
      try {
        const adminUser = JSON.parse(localStorage.getItem('user') || 'null');
        const adminId = (adminUser && (adminUser.id || adminUser.authId)) || (auth && auth.currentUser && auth.currentUser.uid) || null;
        await addDoc(collection(db, 'admin_logs'), { action: 'ban_user', targetId: id, adminId, timestamp: serverTimestamp(), success: true });
      } catch (e) { console.warn('Failed to write admin log for ban', e); }
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'Banned' } : u));
    if (setParentUsers) setParentUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'Banned' } : u));
    setNotifyText('User banned'); setNotifySuccess(true); setNotifyOpen(true);
  }

  function openBanConfirm(id) {
    setConfirmMode('ban');
    setConfirmTarget(id);
    setTypedConfirm('');
    setConfirmOpen(true);
  }

  function openDeleteConfirm(id) {
    setConfirmMode('delete');
    setConfirmTarget(id);
    setTypedConfirm('');
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    const id = confirmTarget;
    setConfirmOpen(false);
    setConfirmTarget(null);
    if (!id) return;
    await handleDelete(id);
  }



  

  // Manual refresh to re-fetch users from backend/firestore
  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
        if (setParentUsers) setParentUsers(Array.isArray(data) ? data : []);
        return;
      }
    } catch (err) {
      console.warn('Refresh backend fetch failed, falling back to Firestore:', err.message);
    }
    try {
      const qs = await getDocs(collection(db, 'users'));
      const list = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(list);
      if (setParentUsers) setParentUsers(list);
    } catch (err) {
      console.error('Refresh failed to load users from Firestore:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  // Auto-hide toast after a short delay
  useEffect(() => {
    if (!notifyOpen) return;
    const t = setTimeout(() => setNotifyOpen(false), 3000);
    return () => clearTimeout(t);
  }, [notifyOpen]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">User Management</h2>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..." className="border rounded-lg px-4 py-2 mb-4 w-full max-w-md" />
      <button className="px-3 py-1 bg-teal-600 text-white rounded" onClick={refresh}>Refresh</button>
      {loading ? <div className="mt-4">Loading users...</div> : (
        <div className="mt-4 overflow-x-auto bg-white rounded-xl shadow mb-8">
          <table className="min-w-full">
            <thead>
              <tr className="bg-teal-100 text-teal-700">
                <th className="p-3 text-left first:rounded-tl-xl">Name</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left last:rounded-tr-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(u => (
                <tr key={u.id} className="bg-white">
                  <td className="p-3 align-top">{u.username || u.name}</td>
                  <td className="p-3 align-top">{u.email}</td>
                  <td className="p-3 align-top">{u.phone || ''}</td>
                  <td className="p-3 align-top">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      
                      <button
                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition"
                        onClick={() => openBanConfirm(u.id)}
                        aria-label={`Ban ${u.username || u.name}`}>
                        Ban
                      </button>
                                      <button
                                        className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                                        onClick={() => openDeleteConfirm(u.id)}
                                        aria-label={`Delete ${u.username || u.name}`}>
                                        Delete
                                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Ban confirmation modal */}
      {/* Ban confirmation modal */}
      <Modal
        open={confirmOpen && !!confirmTarget}
        title={confirmMode === 'delete' ? 'Confirm deletion' : 'Confirm ban'}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null); setConfirmMode(null); setTypedConfirm(''); }}
        onConfirm={async () => {
          const id = confirmTarget;
          const mode = confirmMode;
          // require typed confirmation for delete
          if (mode === 'delete' && typedConfirm.trim() !== 'DELETE') {
            setNotifyText('Type DELETE to confirm'); setNotifySuccess(false); setNotifyOpen(true);
            return;
          }
          setConfirmOpen(false);
          setConfirmTarget(null);
          setConfirmMode(null);
          setTypedConfirm('');
          if (!id) return;
          if (mode === 'ban') return await handleBan(id);
          return await handleDelete(id);
        }}
        confirmLabel={confirmMode === 'delete' ? 'Delete user' : 'Ban user'}
        confirmDanger={confirmMode === 'delete'}
      >
        {(() => {
          const targetUser = users.find(x => x.id === confirmTarget) || {};
          const displayName = targetUser.username || targetUser.name || targetUser.email || confirmTarget;
          if (confirmMode === 'delete') {
            return (
              <>
                <div className="mb-2">You are about to permanently delete <strong>{displayName}</strong>. This action cannot be undone.</div>
                <div>Type <strong>DELETE</strong> in the box below to confirm permanent deletion of this user.</div>
                <input autoFocus className="mt-3 w-full border rounded p-2" value={typedConfirm} onChange={e => setTypedConfirm(e.target.value)} placeholder="Type DELETE to confirm" />
              </>
            );
          }
          return (
            <div>Are you sure you want to ban <strong>{displayName}</strong>? This action will mark their account as Banned.</div>
          );
        })()}
      </Modal>

      {/* Toast notification */}
      {notifyOpen && (
        <div className={`fixed right-4 bottom-6 z-50 p-3 rounded shadow-lg ${notifySuccess ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {notifyText}
        </div>
      )}
     
    </div>
  );
}

// Simple modal components inserted here to avoid new dependencies
function Modal({ open, title, children, onCancel, onConfirm, confirmLabel = 'Confirm' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <div className="mb-4">{children}</div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded bg-gray-200" onClick={onCancel}>Cancel</button>
          <button
            className={`px-3 py-1 rounded ${confirmLabel.toLowerCase().includes('delete') ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-teal-600 text-white'}`}
            onClick={onConfirm}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Inject confirm and notify modals into the default export via side-effectless inclusion
export function __AdminUserManagementModals({ confirmOpen, confirmTarget, confirmBanFn, setConfirmOpenLocal, notifyOpenLocal, notifyTextLocal, setNotifyOpenLocal, setNotifyTextLocal, sendNotifyFn }) {
  // This component is not used directly; modals are rendered by the parent file's state above.
  return null;
}
