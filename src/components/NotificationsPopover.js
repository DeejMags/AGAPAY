import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { subscribeToUserConversations } from '../firebaseMessageService';
import authFetch from '../utils/authFetch';
import { getBadgeIcon } from '../utils/badges';

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

export default function NotificationsPopover({ open, onClose, adminCounts = null }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all'); 
  const [items, setItems] = useState([]); 
  const [profileCache, setProfileCache] = useState({});
  const [systemNotifs, setSystemNotifs] = useState([]); 
  const [adminSummary, setAdminSummary] = useState({ pendingProducts: 0, openReports: 0 });
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [badgeFeed, setBadgeFeed] = useState([]);
  const [badgeFeedLoading, setBadgeFeedLoading] = useState(false);
  const meId = (auth && auth.currentUser && auth.currentUser.uid) || (JSON.parse(localStorage.getItem('user') || 'null')?.id) || null;
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  const isAdmin = currentUser && currentUser.role === 'admin';

  function toMillis(ts) {
    if (!ts) return Date.now();
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
    if (ts.toDate) return ts.toDate().getTime();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    if (typeof ts._seconds === 'number') return ts._seconds * 1000;
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }

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

  useEffect(() => {
    if (isAdmin && adminCounts) {
      setAdminSummary(prev => {
        if (prev.pendingProducts === adminCounts.pendingProducts && prev.openReports === adminCounts.openReports) return prev;
        return { pendingProducts: adminCounts.pendingProducts || 0, openReports: adminCounts.openReports || 0 };
      });
    }
  }, [adminCounts, isAdmin]);

  useEffect(() => {
    if (!open || !isAdmin) {
      setSystemNotifs([]);
      setAdminSummary({ pendingProducts: 0, openReports: 0 });
      return;
    }
    let cancelled = false;
    async function loadAdminNotifications() {
      setLoadingAdmin(true);
      try {
        const [prodRes, reportRes] = await Promise.all([
          authFetch('/api/products?admin=true&status=pending&pageSize=100').catch(() => null),
          authFetch('/api/reports').catch(() => null)
        ]);
        let pendingProducts = [];
        let openReports = [];
        if (prodRes && prodRes.ok) {
          const data = await prodRes.json();
          const items = Array.isArray(data) ? data : (data.items || []);
          pendingProducts = items;
        }
        if (reportRes && reportRes.ok) {
          const data = await reportRes.json();
          const items = Array.isArray(data) ? data : (data.items || []);
          openReports = items.filter(r => {
            const status = String(r.status || 'open').toLowerCase();
            return status !== 'resolved' && status !== 'closed';
          });
        }
        if (cancelled) return;
        const productNotifs = pendingProducts.map(p => ({
          id: `product:${p.id}`,
          otherName: 'Product awaiting review',
          text: `${(p.seller && (p.seller.name || p.seller.email)) || p.sellerName || 'Seller'} uploaded ${p.title || 'a product'}`,
          ts: toMillis(p.createdAt),
          unread: true,
          icon: '📦',
          targetSection: 'products',
        }));
        const reportNotifs = openReports.map(r => ({
          id: `report:${r.id}`,
          otherName: r.reporterEmail || r.reporterName || 'New report',
          text: r.reason || 'New user report submitted',
          ts: toMillis(r.createdAt),
          unread: true,
          icon: '🚨',
          targetSection: 'report',
        }));
        const combined = [...productNotifs, ...reportNotifs].sort((a,b) => (b.ts || 0) - (a.ts || 0));
        setSystemNotifs(combined);
        setAdminSummary({ pendingProducts: pendingProducts.length, openReports: openReports.length });
      } catch (err) {
        if (!cancelled) {
          setSystemNotifs([]);
          setAdminSummary({ pendingProducts: 0, openReports: 0 });
        }
      } finally {
        if (!cancelled) setLoadingAdmin(false);
      }
    }
    loadAdminNotifications();
    return () => { cancelled = true; };
  }, [open, isAdmin]);

  useEffect(() => {
    if (!open || !meId) {
      setBadgeFeed([]);
      return;
    }
    let cancelled = false;
    async function loadBadgeFeed() {
      setBadgeFeedLoading(true);
      try {
        const res = await authFetch(`/api/users/${encodeURIComponent(meId)}/badges/feed?limit=15`).catch(() => null);
        if (!res || !res.ok) throw new Error('badge_feed_failed');
        let data = {};
        try { data = await res.json(); } catch (_) { data = {}; }
        if (cancelled) return;
        const list = Array.isArray(data?.items) ? data.items : [];
        const mapped = list.map((item, idx) => {
          const ts = Number(item.timestamp || Date.parse(item.createdAt)) || Date.now() - idx;
          return {
            id: `badge:${item.id || idx}`,
            otherName: item.title || 'Badge update',
            text: item.message || 'Badge progress update',
            ts,
            unread: true,
            icon: getBadgeIcon(item.tier),
          };
        });
        setBadgeFeed(mapped);
      } catch (err) {
        if (!cancelled) setBadgeFeed([]);
      } finally {
        if (!cancelled) setBadgeFeedLoading(false);
      }
    }
    loadBadgeFeed();
    return () => { cancelled = true; };
  }, [open, meId]);

  // Apply tab filtering
  const filtered = useMemo(() => {
    const enrich = (it) => ({
      ...it,
      otherName: it.otherId && profileCache[it.otherId] ? displayName(profileCache[it.otherId]) : it.otherName,
      otherAvatar: it.otherId && profileCache[it.otherId] ? (profileCache[it.otherId].profilePic || profileCache[it.otherId].avatar || null) : it.otherAvatar,
    });
    const base = [...badgeFeed, ...systemNotifs, ...items.map(enrich)];
    if (tab === 'unread') return base.filter(i => i.unread);
    return base;
  }, [badgeFeed, items, profileCache, systemNotifs, tab]);

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
      {isAdmin && (
        <div className="px-4 py-2 text-xs text-gray-600 bg-teal-50 flex justify-between border-b border-teal-100">
          <span>Pending products: {adminSummary.pendingProducts}</span>
          <span>Open reports: {adminSummary.openReports}</span>
        </div>
      )}
      <div className="max-h-96 overflow-auto divide-y">
        {loadingAdmin && isAdmin && (
          <div className="px-4 py-2 text-center text-xs text-gray-500">Updating admin notifications…</div>
        )}
        {badgeFeedLoading && (
          <div className="px-4 py-2 text-center text-xs text-gray-500">Updating badge notifications…</div>
        )}
        {filtered.length ? filtered.map(n => (
          <button type="button" key={n.id}
            onClick={() => {
              if (n.targetSection) {
                onClose && onClose();
                navigate('/admin', { state: { adminSection: n.targetSection } });
                return;
              }
              // When a notification is clicked, open Messages and preselect conversation
              localStorage.setItem('agapay_active_conv', String(n.id));
              onClose && onClose();
              navigate('/messages');
            }}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 ${n.unread ? 'bg-blue-50' : ''}`}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                {n.otherAvatar ? (
                  <img src={n.otherAvatar} alt={n.otherName} className="w-full h-full object-cover" />
                ) : n.icon ? (
                  <span className="text-lg" role="img" aria-hidden="true">{n.icon}</span>
                ) : (
                  <span className="text-gray-500">👤</span>
                )}
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
