import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { subscribeToUserConversations } from '../firebaseMessageService';
import authFetch from '../utils/authFetch';

function timeAgo(ts) {
  const now = Date.now();
  const diff = Math.max(0, now - (Number(ts) || 0));
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const date = new Date(Number(ts) || now);
  return date.toLocaleDateString();
}

function displayName(u) {
  if (!u) return 'User';
  return u.username || u.name || (u.email ? String(u.email).split('@')[0] : 'User');
}

export default function NotificationsPopover({ open, onClose }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all'); // 'all' | 'unread'
  const [items, setItems] = useState([]); // { id, otherId, otherName, otherAvatar, text, ts, unread }
  const [profileCache, setProfileCache] = useState({});
  const meId = (auth && auth.currentUser && auth.currentUser.uid) || (JSON.parse(localStorage.getItem('user') || 'null')?.id) || null;

  // Subscribe to conversations and map to notification items
  useEffect(() => {
    if (!open || !meId) return;
    let unsub = null;
    try {
      unsub = subscribeToUserConversations(String(meId), list => {
        const mapped = list.map(c => {
          const otherId = (c.participants || []).find(p => String(p) !== String(meId)) || null;
          const lm = c.lastMessage || null;
          const ts = lm ? (Number(lm.createdAt || 0) || 0) : (Number(c.lastMessageAt || 0) || 0);
          return {
            id: c.conversationId,
            otherId,
            otherName: otherId && profileCache[otherId] ? displayName(profileCache[otherId]) : 'User',
            otherAvatar: otherId && profileCache[otherId] ? (profileCache[otherId].profilePic || profileCache[otherId].avatar || null) : null,
            text: lm ? (lm.text && String(lm.text).trim() ? lm.text : '[Photo]') : 'New conversation',
            ts,
            unread: (c.unreadMap && Number(c.unreadMap[String(meId)] || 0) > 0) || false,
          };
        }).sort((a,b) => (b.ts||0)-(a.ts||0)).slice(0, 20);
        setItems(mapped);
        // Backfill missing profiles
        const ids = Array.from(new Set(mapped.map(x => x.otherId).filter(Boolean)));
        ids.forEach(async (oid) => {
          if (profileCache[oid]) return;
          // backend first
          try {
            const res = await authFetch(`/api/users/${encodeURIComponent(oid)}`);
            if (res.ok) {
              const u = await res.json();
              setProfileCache(prev => ({ ...prev, [oid]: u }));
              return;
            }
          } catch {}
          // firestore fallback
          try {
            const { db } = await import('../firebase');
            const { doc, getDoc } = await import('firebase/firestore');
            const snap = await getDoc(doc(db, 'users', String(oid)));
            if (snap.exists()) setProfileCache(prev => ({ ...prev, [oid]: { id: snap.id, ...snap.data() } }));
          } catch {}
        });
      });
    } catch (e) {
      // ignore
    }
    return () => { if (unsub) unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meId]);

  // Apply tab filtering
  const filtered = useMemo(() => {
    const enrich = (it) => ({
      ...it,
      otherName: it.otherId && profileCache[it.otherId] ? displayName(profileCache[it.otherId]) : it.otherName,
      otherAvatar: it.otherId && profileCache[it.otherId] ? (profileCache[it.otherId].profilePic || profileCache[it.otherId].avatar || null) : it.otherAvatar,
    });
    const base = items.map(enrich);
    if (tab === 'unread') return base.filter(i => i.unread);
    return base;
  }, [items, profileCache, tab]);

  if (!open) return null;

  return (
    <div className="absolute right-0 mt-2 w-96 max-w-[95vw] bg-white border rounded-xl shadow-xl z-[60] overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
        <div className="font-semibold">Notifications</div>
        <button className="text-teal-600 text-sm hover:underline" onClick={() => { onClose && onClose(); navigate('/messages'); }}>See all</button>
      </div>
      <div className="px-3 pt-2">
        <div className="inline-flex items-center rounded-lg bg-gray-100 p-1 text-sm">
          <button type="button" className={`px-3 py-1 rounded-md ${tab==='all' ? 'bg-white shadow font-medium' : 'text-gray-600'}`} onClick={()=>setTab('all')}>All</button>
          <button type="button" className={`ml-1 px-3 py-1 rounded-md ${tab==='unread' ? 'bg-white shadow font-medium' : 'text-gray-600'}`} onClick={()=>setTab('unread')}>Unread</button>
        </div>
      </div>
      <div className="max-h-96 overflow-auto divide-y">
        {filtered.length ? filtered.map(n => (
          <button type="button" key={n.id}
            onClick={() => {
              // When a notification is clicked, open Messages and preselect conversation
              localStorage.setItem('agapay_active_conv', String(n.id));
              onClose && onClose();
              navigate('/messages');
            }}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 ${n.unread ? 'bg-blue-50' : ''}`}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                {n.otherAvatar ? <img src={n.otherAvatar} alt={n.otherName} className="w-full h-full object-cover" /> : <span className="text-gray-500">👤</span>}
              </div>
              {n.unread && <span className="absolute -bottom-0 -right-0 translate-x-1/4 translate-y-1/4 w-2.5 h-2.5 bg-teal-600 rounded-full ring-2 ring-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">{n.otherName || 'User'}</div>
                <div className="text-xs text-gray-500 whitespace-nowrap">{timeAgo(n.ts)}</div>
              </div>
              <div className="text-sm text-gray-600 truncate">{n.text}</div>
            </div>
          </button>
        )) : (
          <div className="px-4 py-8 text-center text-gray-500">No notifications</div>
        )}
      </div>
    </div>
  );
}
