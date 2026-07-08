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
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [banReason, setBanReason] = useState('');
  // Removed typed delete confirmation; immediate delete now

  // Toast / notification
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyText, setNotifyText] = useState('');
  const [notifySuccess, setNotifySuccess] = useState(true);
  // auto-hide handled via effect below

  // Helper to detect Firebase UID patterns
  const looksLikeUid = (str) => {
    if (!str) return false;
    return /^[a-zA-Z0-9]{20,28}$/.test(String(str).trim());
  };

  // Helper to get clean display name
  const getCleanDisplayName = (u) => {
    if (!u) return '';
    
    // Try firstName + lastName first
    const first = (u.firstName || '').trim();
    const last = (u.lastName || '').trim();
    const combined = [first, last].filter(Boolean).join(' ').trim();
    
    if (combined && !looksLikeUid(combined)) {
      return combined;
    }
    
    // Try other fields
    const fallbacks = [u.fullName, u.name, u.displayName, u.username]
      .map(f => String(f || '').trim())
      .filter(f => f && !looksLikeUid(f));
    
    if (fallbacks.length > 0) return fallbacks[0];
    
    // Try email local part
    if (u.email) {
      const local = String(u.email).split('@')[0].trim();
      if (local && !looksLikeUid(local)) return local;
    }
    
    // Last resort: show first 12 chars of ID
    return String(u.id || '').slice(0, 12);
  };
  

  useEffect(() => {
    // If parent provided users, use them; otherwise fetch from backend then Firestore
    let mounted = true;
    async function enrichMissing(list) {
      // For users missing visible name/email, try to enrich via backend /api/users/:id (which falls back to Firebase Auth)
      const need = (list || []).filter(u => {
        const hasName = !!(u.username || u.name || u.displayName || u.fullName);
        const hasEmail = !!u.email;
        return !hasName || !hasEmail;
      }).slice(0, 50); // limit per pass to avoid flooding
      if (need.length === 0) return list;
      const updates = {};
      await Promise.all(need.map(async (u) => {
        try {
          const res = await authFetch(`/api/users/${encodeURIComponent(u.id)}`);
          if (res && res.ok) {
            const j = await res.json();
            const combined = [j.firstName, j.lastName].filter(Boolean).join(' ').trim();
            updates[u.id] = {
              firstName: j.firstName || u.firstName || '',
              lastName: j.lastName || u.lastName || '',
              username: combined || j.username || j.displayName || u.username,
              name: j.name || combined || u.name,
              displayName: combined || j.displayName || j.username || u.displayName,
              fullName: j.fullName || combined || u.fullName,
              email: j.email || u.email,
            };
          }
        } catch { /* ignore per-user errors */ }
      }));
      if (Object.keys(updates).length === 0) return list;
      return list.map(u => updates[u.id] ? { ...u, ...updates[u.id] } : u);
    }
    async function fetchUsers() {
      setLoading(true);
      try {
        // Try backend first
        const res = await authFetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            const base = Array.isArray(data) ? data : [];
            const enriched = await enrichMissing(base);
            setUsers(enriched);
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
        const enriched = await enrichMissing(userList);
        if (mounted) setUsers(enriched);
      } catch (err) {
        console.error('Error fetching users from Firestore:', err);
        if (mounted) setUsers([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (parentUsers) {
      (async () => {
        const enriched = await enrichMissing(parentUsers);
        if (mounted) setUsers(enriched);
        if (mounted) setLoading(false);
      })();
    } else {
      fetchUsers();
    }
    return () => { mounted = false; };
  }, [parentUsers]);

  // Listen for user-unbanned event from AppealsPage
  useEffect(() => {
    const handleUserUnbanned = (event) => {
      const userId = event.detail?.userId;
      if (userId) {
        setUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, status: 'active', banned: false, active: true } : u
        ));
      }
    };
    window.addEventListener('user-unbanned', handleUserUnbanned);
    return () => window.removeEventListener('user-unbanned', handleUserUnbanned);
  }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      (getCleanDisplayName(u) || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      String(u.id || '').toLowerCase().includes(q)
    );
  });

  // Edit action removed: admin may use Ban/Delete which are handled below.

  // eslint-disable-next-line no-unused-vars
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

  function handleBan(id) {
    // Accept optional reason via closure
    return async function(doReason) {
      const reason = doReason || 'Banned by admin';
      try {
        const res = await authFetch(`/api/users/${encodeURIComponent(id)}/ban`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason })
        });
        if (!res.ok) throw new Error('Backend ban failed');
        try {
          const adminUser = JSON.parse(localStorage.getItem('user') || 'null');
          const adminId = (adminUser && (adminUser.id || adminUser.authId)) || (auth && auth.currentUser && auth.currentUser.uid) || null;
          await addDoc(collection(db, 'admin_logs'), { action: 'ban_user', targetId: id, adminId, timestamp: serverTimestamp(), success: true });
        } catch (e) { console.warn('Failed to write admin log for ban', e); }
      } catch (err) {
        // Fallback: mark Firestore profile as banned if backend is unavailable
        try {
          await updateDoc(doc(db, 'users', id), { status: 'banned', banned: true, active: false, bannedAt: serverTimestamp(), banReason: doReason || 'Banned by admin' });
        } catch (e) { console.error('Fallback ban failed', e); }
        try {
          const adminUser = JSON.parse(localStorage.getItem('user') || 'null');
          const adminId = (adminUser && (adminUser.id || adminUser.authId)) || (auth && auth.currentUser && auth.currentUser.uid) || null;
          await addDoc(collection(db, 'admin_logs'), { action: 'ban_user', targetId: id, adminId, timestamp: serverTimestamp(), success: true, note: 'fallback' });
        } catch (e) { console.warn('Failed to write admin log for ban', e); }
      }
      const applyBanned = (u) => u.id === id ? { ...u, status: 'banned', banned: true, active: false } : u;
      setUsers(prev => prev.map(applyBanned));
      if (setParentUsers) setParentUsers(prev => prev.map(applyBanned));
      setNotifyText('User banned'); setNotifySuccess(true); setNotifyOpen(true);
      return true;
    };
  }

  async function handleUnban(id) {
    try {
      const res = await authFetch(`/api/users/${encodeURIComponent(id)}/unban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Unbanned by admin' }) });
      if (!res.ok) throw new Error('Backend unban failed');
      // update UI
      const applyUnbanned = (u) => u.id === id ? { ...u, status: 'active', banned: false, active: true } : u;
      setUsers(prev => prev.map(applyUnbanned));
      if (setParentUsers) setParentUsers(prev => prev.map(applyUnbanned));
      setNotifyText('User unbanned'); setNotifySuccess(true); setNotifyOpen(true);
    } catch (err) {
      try {
        await updateDoc(doc(db, 'users', id), { status: 'active', banned: false, active: true, unbannedAt: serverTimestamp() });
        const applyUnbanned = (u) => u.id === id ? { ...u, status: 'active', banned: false, active: true } : u;
        setUsers(prev => prev.map(applyUnbanned));
        if (setParentUsers) setParentUsers(prev => prev.map(applyUnbanned));
        setNotifyText('User unbanned'); setNotifySuccess(true); setNotifyOpen(true);
      } catch (e) {
        console.error('Unban fallback failed', e);
        setNotifyText('Failed to unban user'); setNotifySuccess(false); setNotifyOpen(true);
      }
    }
  }

  function openBanConfirm(id) {
    setConfirmMode('ban');
    setConfirmTarget(id);
    setBanReason('');
    setConfirmOpen(true);
  }

  function openPermanentDeleteConfirm(id) {
    setConfirmMode('permanentDelete');
    setConfirmTarget(id);
    setConfirmOpen(true);
  }

  // removed unused confirmDelete helper; onConfirm calls handleBan/handleDelete directly



  

  // Manual refresh to re-fetch users from backend/firestore
  async function refresh() {
    setLoading(true);
    try {
      const res = await authFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        const base = Array.isArray(data) ? data : [];
        const enriched = await (async () => {
          try { return await (async (l)=>{ // inline call to reuse logic without hoisting issues
            const need = (l || []).filter(u => !(u.username||u.name||u.displayName||u.fullName) || !u.email).slice(0,50);
            if (need.length===0) return l;
            const updates = {};
            await Promise.all(need.map(async (u)=>{
              try { const r = await authFetch(`/api/users/${encodeURIComponent(u.id)}`); if (r&&r.ok) { const j = await r.json(); updates[u.id] = { username: j.username||j.displayName||u.username, name: j.name||u.name, displayName: j.displayName||j.username||u.displayName, fullName: j.fullName||u.fullName, email: j.email||u.email }; } } catch {}
            }));
            if (Object.keys(updates).length===0) return l;
            return l.map(u => updates[u.id] ? { ...u, ...updates[u.id] } : u);
          })(base); } catch { return base; }
        })();
        setUsers(enriched);
        if (setParentUsers) setParentUsers(enriched);
        return;
      }
    } catch (err) {
      console.warn('Refresh backend fetch failed, falling back to Firestore:', err.message);
    }
    try {
      const qs = await getDocs(collection(db, 'users'));
      const list = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      // Reuse enrichMissing from initial effect
      try { const enriched = await (async (l)=>{
        const need = (l || []).filter(u => !(u.username||u.name||u.displayName||u.fullName) || !u.email).slice(0,50);
        if (need.length===0) return l;
        const updates = {};
        await Promise.all(need.map(async (u)=>{
          try { const r = await authFetch(`/api/users/${encodeURIComponent(u.id)}`); if (r&&r.ok) { const j = await r.json(); updates[u.id] = { username: j.username||j.displayName||u.username, name: j.name||u.name, displayName: j.displayName||j.username||u.displayName, fullName: j.fullName||u.fullName, email: j.email||u.email }; } } catch {}
        }));
        if (Object.keys(updates).length===0) return l;
        return l.map(u => updates[u.id] ? { ...u, ...updates[u.id] } : u);
      })(list); setUsers(enriched); if (setParentUsers) setParentUsers(enriched); } catch { setUsers(list); if (setParentUsers) setParentUsers(list); }
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
                <th className="p-3 text-left last:rounded-tr-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(u => (
                <tr key={u.id} className="bg-white">
                  <td className="p-3 align-top">
                    <div className="font-medium">{getCleanDisplayName(u) || '—'}</div>
                    <code className="text-xs text-gray-500 break-all font-mono select-all" title={String(u.id || '')}>{u.id}</code>
                  </td>
                  <td className="p-3 align-top whitespace-nowrap">{u.email || '—'}</td>
                  <td className="p-3 align-top">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {(() => {
                        const status = String(u.status || '').toLowerCase();
                        const isBanned = u.banned === true || status === 'banned' || status.includes('ban') || (u.active === false && status !== 'active');
                        return (
                          <>
                            {/* Hide ban/unban for admin-role users */}
                            {u.role !== 'admin' && (
                              <button
                                className={`px-3 py-1 rounded text-white text-sm font-medium transition ${
                                  isBanned
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-red-600 hover:bg-red-700'
                                }`}
                                onClick={() => {
                                  if (isBanned) {
                                    setConfirmMode('unban'); setConfirmTarget(u.id); setConfirmOpen(true);
                                  } else {
                                    openBanConfirm(u.id);
                                  }
                                }}
                                aria-label={isBanned ? `Unban ${getCleanDisplayName(u) || u.id}` : `Ban ${getCleanDisplayName(u) || u.id}`}
                              >
                                {isBanned ? 'Unban' : 'Ban'}
                              </button>
                            )}
                            <button
                              className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition text-sm"
                              onClick={() => openPermanentDeleteConfirm(u.id)}
                              aria-label={`Permanently delete ${getCleanDisplayName(u) || u.id}`}
                            >
                              Delete
                            </button>
                          </>
                        );
                      })()}
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
        title={confirmMode === 'permanentDelete' ? 'Confirm permanent delete' : (confirmMode === 'unban' ? 'Confirm unban' : 'Confirm ban')}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null); setConfirmMode(null); setBanReason(''); }}
        onConfirm={async () => {
          const id = confirmTarget;
          const mode = confirmMode;
          setConfirmLoading(true);
          // require typed confirmation for archive
          setConfirmOpen(false);
          setConfirmTarget(null);
          setConfirmMode(null);
          if (!id) { setConfirmLoading(false); return; }
          try {
            if (mode === 'ban') {
              // handleBan returns a closure — call it with the reason
              await handleBan(id)(banReason || 'Banned by admin');
            } else if (mode === 'permanentDelete') {
              await handleDelete(id);
            } else if (mode === 'unban') {
              await handleUnban(id);
            }
          } finally {
            setConfirmLoading(false);
          }
        }}
        confirmLabel={confirmMode === 'permanentDelete' ? 'Delete permanently' : (confirmMode === 'unban' ? 'Unban user' : 'Ban user')}
        confirmDanger={confirmMode === 'permanentDelete'}
        confirmLoading={confirmLoading}
      >
        {(() => {
          const targetUser = users.find(x => x.id === confirmTarget) || {};
          const displayName = targetUser.username || targetUser.name || targetUser.email || confirmTarget;
          if (confirmMode === 'permanentDelete') {
            return (
              <div>
                <div className="mb-3 text-red-600 font-semibold">⚠️ Warning: This action cannot be undone</div>
                <div className="mb-2">You are about to <strong>permanently delete</strong> the account of <strong>{displayName}</strong>.</div>
                <div className="text-sm text-gray-600">This will remove:</div>
                <ul className="text-sm text-gray-600 list-disc ml-4 mt-1">
                  <li>User profile and account data</li>
                  <li>All associated messages and conversations</li>
                  <li>Product listings and reviews</li>
                </ul>
                <div className="text-sm text-gray-600 mt-2">This action <strong>cannot be recovered</strong>.</div>
              </div>
            );
          }
          if (confirmMode === 'ban') {
            return (
              <>
                <div className="mb-2">Are you sure you want to ban <strong>{displayName}</strong>? This action will mark their account as Banned.</div>
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700">Ban reason</label>
                  <textarea value={banReason} onChange={e=>setBanReason(e.target.value)} className="w-full border rounded p-2 mt-1" rows={4} placeholder="Describe why this user is being banned (policy violation, spam, etc.)" />
                </div>
              </>
            );
          }
          return (
            <div>Are you sure you want to unban <strong>{displayName}</strong>? This will restore access for the user.</div>
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
function Modal({ open, title, children, onCancel, onConfirm, confirmLabel = 'Confirm', confirmDanger = false, confirmLoading = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <div className="mb-4">{children}</div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded bg-gray-200" onClick={onCancel}>Cancel</button>
          <button
              className={`px-3 py-1 rounded ${confirmDanger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-teal-600 text-white'}`}
              onClick={onConfirm}
              disabled={confirmLoading}
            >{confirmLoading ? 'Working...' : confirmLabel}</button>
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
