import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import authFetch from '../utils/authFetch';

export default function AppealsPage() {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(null);

  useEffect(() => { loadAppeals(); }, []);

  async function loadAppeals() {
    setLoading(true);
    try {
      const q = query(collection(db, 'ban_appeals'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));

      // Enrich each appeal with the user's current first+last name from their Firestore profile
      const enriched = await Promise.all(list.map(async (appeal) => {
        try {
          let userDoc = null;
          if (appeal.userId) {
            const snap = await getDocs(query(collection(db, 'users'), where('__name__', '==', appeal.userId)));
            if (!snap.empty) userDoc = snap.docs[0].data();
          }
          if (!userDoc && appeal.userEmail) {
            const snap = await getDocs(query(collection(db, 'users'), where('email', '==', appeal.userEmail.toLowerCase())));
            if (!snap.empty) userDoc = snap.docs[0].data();
          }
          if (userDoc) {
            const combined = [userDoc.firstName, userDoc.lastName].filter(Boolean).join(' ').trim();
            const resolvedName = combined || userDoc.fullName || userDoc.name || userDoc.displayName || userDoc.username || appeal.userName;
            return { ...appeal, userName: resolvedName || appeal.userName };
          }
        } catch { /* non-critical — keep stored value */ }
        return appeal;
      }));

      setAppeals(enriched);
    } catch (e) {
      console.error('Failed to load appeals', e);
    } finally {
      setLoading(false);
    }
  }

  async function acceptAppeal(appeal) {
    if (actionBusy) return;
    setActionBusy(appeal.id);
    try {
      // Resolve userId — may be missing from appeals submitted before the fix
      let userId = appeal.userId;
      if (!userId && appeal.userEmail) {
        try {
          const snap = await getDocs(query(collection(db, 'users'), where('email', '==', appeal.userEmail)));
          if (!snap.empty) userId = snap.docs[0].id;
        } catch { /* ignore lookup error */ }
      }
      if (!userId) {
        alert('Cannot unban: this appeal is missing user info. Please use User Management to manually unban the user, then delete this appeal.');
        return;
      }

      try {
        const res = await authFetch(`/api/users/${encodeURIComponent(userId)}/unban`, { method: 'POST' });
        if (!res.ok) throw new Error('backend unban failed');
      } catch {
        await updateDoc(doc(db, 'users', userId), { banned: false, status: 'active', banReason: null });
      }
      await updateDoc(doc(db, 'ban_appeals', appeal.id), { status: 'accepted', resolvedAt: serverTimestamp() });
      try {
        await addDoc(collection(db, 'notifications'), {
          userId,
          type: 'ban_appeal_accepted',
          message: 'Your ban appeal has been accepted. Your account has been restored.',
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch { /* non-critical */ }
      // Emit custom event to notify UserManagement to refresh
      window.dispatchEvent(new CustomEvent('user-unbanned', { detail: { userId } }));
      setAppeals(prev => prev.filter(a => a.id !== appeal.id));
    } catch (e) {
      console.error('Accept appeal failed', e);
      alert('Failed to accept appeal');
    } finally {
      setActionBusy(null);
    }
  }

  async function declineAppeal(appeal) {
    if (actionBusy) return;
    setActionBusy(appeal.id);
    try {
      await updateDoc(doc(db, 'ban_appeals', appeal.id), { status: 'declined', resolvedAt: serverTimestamp() });
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: appeal.userId,
          type: 'ban_appeal_declined',
          message: 'Your ban appeal has been reviewed and declined. The ban remains in effect.',
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch { /* non-critical */ }
      setAppeals(prev => prev.filter(a => a.id !== appeal.id));
    } catch (e) {
      console.error('Decline appeal failed', e);
      alert('Failed to decline appeal');
    } finally {
      setActionBusy(null);
    }
  }

  function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Ban Appeals</h2>
          <p className="text-sm text-gray-500 mt-1">Review and resolve pending user ban appeals</p>
        </div>
        <button
          onClick={loadAppeals}
          className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition font-medium"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading appeals...
        </div>
      ) : appeals.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-10 text-center text-gray-500">
          <div className="text-5xl mb-3">✅</div>
          <p className="font-semibold text-lg">No pending appeals</p>
          <p className="text-sm mt-1 text-gray-400">All ban appeals have been resolved.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-4">
            {appeals.length} pending appeal{appeals.length !== 1 ? 's' : ''} waiting for review
          </p>
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="min-w-full">
              <thead>
                <tr className="bg-yellow-50 text-yellow-800 border-b border-yellow-100">
                  <th className="p-3 text-left text-sm font-semibold">User</th>
                  <th className="p-3 text-left text-sm font-semibold">Email</th>
                  <th className="p-3 text-left text-sm font-semibold">Ban Reason</th>
                  <th className="p-3 text-left text-sm font-semibold">Appeal Reason</th>
                  <th className="p-3 text-left text-sm font-semibold">Submitted</th>
                  <th className="p-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appeals.map(a => (
                  <tr key={a.id} className="border-b last:border-b-0 hover:bg-yellow-50/40 transition">
                    <td className="p-3 font-medium text-sm">{a.userName || [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || '—'}</td>
                    <td className="p-3 text-sm text-gray-600">{a.userEmail || '—'}</td>
                    <td className="p-3 text-sm max-w-xs">
                      <span className="inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs break-words">
                        {a.banReason && !a.banReason.startsWith('Firebase:') && !a.banReason.includes('auth/user-disabled') ? a.banReason : 'No reason given'}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-700 max-w-xs">
                      <div className="bg-gray-50 rounded p-2 break-words">{a.reason || '—'}</div>
                    </td>
                    <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition"
                          disabled={actionBusy === a.id}
                          onClick={() => acceptAppeal(a)}
                        >
                          {actionBusy === a.id ? 'Processing…' : '✓ Accept & Unban'}
                        </button>
                        <button
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition"
                          disabled={actionBusy === a.id}
                          onClick={() => declineAppeal(a)}
                        >
                          ✕ Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
