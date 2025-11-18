import React, { useEffect, useState, useRef, useCallback } from 'react';
import authFetch from '../utils/authFetch';
import { auth } from '../firebase';

export default function ImpactReportPanel() {
  const [loading, setLoading] = useState(true);
  const [sold, setSold] = useState(0);
  const [points, setPoints] = useState(0);
  const [goals] = useState({ sold: 20, points: 2000 }); // add points goal for UI only
  const unsubRef = useRef(null);
  const userUnsubRef = useRef(null);
  const historyUnsubRef = useRef(null);
  const buyerHistoryUnsubRef = useRef(null);
  const [history, setHistory] = useState([]); // list of transactions for this seller
  const [historyLoading, setHistoryLoading] = useState(true); // loading indicator for transactions
  const [nameCache, setNameCache] = useState({}); // userId -> name
  const [productCache, setProductCache] = useState({}); // productId -> title
  // Refs mirror caches to avoid adding them as dependencies in callbacks that attach listeners
  const nameCacheRef = useRef({});
  const productCacheRef = useRef({});

  useEffect(() => { nameCacheRef.current = nameCache; }, [nameCache]);
  useEffect(() => { productCacheRef.current = productCache; }, [productCache]);

  function pct(value, total) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((Number(value) / Number(total)) * 100));
  }

  // Helper: resolve user name with backend preferred
  const resolveUserName = useCallback(async (userId) => {
    if (!userId) return '';
    if (nameCache[userId]) return nameCache[userId];
    let name = '';
    try {
      const res = await authFetch(`/api/users/${encodeURIComponent(userId)}`);
      if (res && res.ok) {
        const u = await res.json();
        name = u.name || u.displayName || u.username || (u.email ? String(u.email).split('@')[0] : '') || '';
      }
    } catch (_) { /* continue to Firestore fallback */ }
    if (!name) {
      try {
        const { db } = await import('../firebase');
        const { doc, getDoc } = await import('firebase/firestore');
        const ref = doc(db, 'users', String(userId));
        const s = await getDoc(ref);
        if (s.exists()) {
          const u = s.data() || {};
          name = u.name || u.displayName || u.username || (u.email ? String(u.email).split('@')[0] : '') || '';
        }
      } catch (_) {}
    }
    setNameCache(prev => ({ ...prev, [userId]: name || String(userId) }));
    return name || String(userId);
  }, [nameCache]);

  // Helper: resolve product title (prefer Firestore to avoid backend 404 noise for deleted items)
  const resolveProductTitle = useCallback(async (productId) => {
    if (!productId) return '';
    if (productCache[productId]) return productCache[productId];
    let title = '';
    // First, try Firestore directly (client always has access and avoids network 404 spam)
    try {
      const { db } = await import('../firebase');
      const { doc, getDoc } = await import('firebase/firestore');
      const ref = doc(db, 'products', String(productId));
      const s = await getDoc(ref);
      if (s.exists()) {
        const p = s.data() || {};
        title = p.title || p.name || '';
      }
    } catch (_) {}
    // Intentionally skip backend lookup if Firestore doesn't have the doc to avoid noisy 404s
    setProductCache(prev => ({ ...prev, [productId]: title || String(productId) }));
    return title || String(productId);
  }, [productCache]);

  // Realtime listener (defined before useEffect to satisfy no-use-before-define)
  const attachRealtimeListener = useCallback(async function attachRealtimeListener() {
    try {
      const { db } = await import('../firebase');
      const { collection, onSnapshot, query, where } = await import('firebase/firestore');
      const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
      if (!uid) return;
      const q = query(collection(db, 'products'), where('sellerId', '==', uid));
      const unsub = onSnapshot(q, (snap) => {
        const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const soldCount = products.filter(p => isSoldStatus(p.status)).length;
        setSold(soldCount);
      }, (err) => {
        // ignore realtime errors silently
        console.debug('ImpactReport realtime error', err && err.message);
      });
      // Store for cleanup
      unsubRef.current = unsub;
    } catch (e) {
      // ignore
    }
  }, []);

  // Realtime listener for user points
  const attachUserPointsListener = useCallback(async function attachUserPointsListener() {
    try {
      const { db } = await import('../firebase');
      const { doc, onSnapshot } = await import('firebase/firestore');
      const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
      if (!uid) return;
      const ref = doc(db, 'users', uid);
      const unsub = onSnapshot(ref, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};
        const total = Number(data.totalPoints || data.sellerPoints || 0) || 0;
        setPoints(total);
      }, (err) => { console.debug('ImpactReport user points realtime error', err && err.message); });
      userUnsubRef.current = unsub;
    } catch (e) { /* ignore */ }
  }, []);

  // Realtime listener for transaction history (seller and buyer views) with graceful fallback if index is missing
  const attachHistoryListener = useCallback(async function attachHistoryListener() {
    try {
      setHistoryLoading(true);
      const { db } = await import('../firebase');
      const { collection, onSnapshot, query, where, orderBy, limit } = await import('firebase/firestore');
      const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
      if (!uid) { setHistoryLoading(false); return; }

      // Track when both sources (seller and buyer) have produced their first snapshot
      let sellerLoaded = false;
      let buyerLoaded = false;
      function markSourceLoaded(source) {
        if (source === 'seller') sellerLoaded = true; else buyerLoaded = true;
        if (sellerLoaded && buyerLoaded) setHistoryLoading(false);
      }

      // Helper to attach a snapshot with fallback when composite index for orderBy is missing
      async function attachWithFallback(roleField, storeRef) {
        const base = collection(db, 'points_history');
        const qOrdered = query(base, where(roleField, '==', uid), orderBy('createdAt', 'desc'), limit(50));
        let firstAttempt = true;
        const unsub = onSnapshot(qOrdered, (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          updateMergedHistory(roleField, rows);
          markSourceLoaded(storeRef);
        }, (err) => {
          const msg = (err && (err.message || err.code)) || '';
          // Firestore: FAILED_PRECONDITION indicates missing index requirement for where+orderBy
          if (firstAttempt && /FAILED_PRECONDITION|requires an index/i.test(msg)) {
            firstAttempt = false;
            // Fallback: listen without orderBy. We'll sort on the client side later.
            try {
              const qSimple = query(base, where(roleField, '==', uid), limit(50));
              const unsub2 = onSnapshot(qSimple, (snap2) => {
                const rows2 = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
                updateMergedHistory(roleField, rows2);
                markSourceLoaded(storeRef);
              });
              // swap unsub reference
              if (storeRef === 'seller') historyUnsubRef.current = unsub2; else buyerHistoryUnsubRef.current = unsub2;
              // Stop original listener
              try { unsub(); } catch {}
            } catch {}
          } else {
            console.debug('ImpactReport history realtime error', msg);
          }
        });
        if (storeRef === 'seller') historyUnsubRef.current = unsub; else buyerHistoryUnsubRef.current = unsub;
      }

      // Maintain separate caches then merge
      let latestSeller = [];
      let latestBuyer = [];
      function updateMergedHistory(source, rows) {
        if (source === 'seller') latestSeller = rows; else latestBuyer = rows;
        const merged = [...latestSeller, ...latestBuyer]
          .reduce((acc, item) => { acc.set(item.id, item); return acc; }, new Map());
        const list = Array.from(merged.values());
        // Enrich
        list.forEach(r => {
          if (r.buyerId && !nameCacheRef.current[r.buyerId]) resolveUserName(r.buyerId).catch(()=>{});
          if (r.sellerId && !nameCacheRef.current[r.sellerId]) resolveUserName(r.sellerId).catch(()=>{});
          if (r.productId && !productCacheRef.current[r.productId]) resolveProductTitle(r.productId).catch(()=>{});
        });
        // Sort by createdAt desc if present
        list.sort((a,b) => {
          const da = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const db = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return db - da;
        });
        setHistory(list);
      }

      await attachWithFallback('sellerId', 'seller');
      await attachWithFallback('buyerId', 'buyer');
    } catch (e) { /* ignore */ }
  }, [resolveUserName, resolveProductTitle]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Try backend first with auth; fallback to Firestore
      try {
        // Ensure auth is ready for authFetch
        if (!auth.currentUser) {
          await new Promise(resolve => {
            const t = setTimeout(resolve, 1500);
            const unsub = auth.onAuthStateChanged(() => { clearTimeout(t); unsub(); resolve(); });
          });
        }
        const res = await authFetch('/api/products?mine=true');
        if (res && res.ok) {
          const payload = await res.json();
          const items = Array.isArray(payload) ? payload : (payload.items || []);
          const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
          const mine = uid ? items.filter(p => p.sellerId === uid) : items;
          const soldCount = mine.filter(p => isSoldStatus(p.status)).length;
          if (!cancelled) { setSold(soldCount); }
          // Load user points from backend
          try {
            if (uid) {
              const ures = await authFetch(`/api/users/${uid}`);
              if (ures && ures.ok) {
                const u = await ures.json();
                const total = Number(u.totalPoints || u.sellerPoints || 0) || 0;
                if (!cancelled) setPoints(total);
              }
            }
          } catch (e) { /* ignore */ }
          setLoading(false);
          // Also attach a realtime listener to Firestore for live updates
          attachRealtimeListener();
          attachUserPointsListener();
          attachHistoryListener();
          return;
        }
      } catch (e) {
        // continue to fallback
      }

      try {
        const { collection, getDocs, query, where, doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
        if (!uid) { setSold(0); setLoading(false); return; }
        const q = query(collection(db, 'products'), where('sellerId', '==', uid));
        const snap = await getDocs(q);
        const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const soldCount = products.filter(p => isSoldStatus(p.status)).length;
        if (!cancelled) { setSold(soldCount); }
        // Load user points from Firestore
        try {
          const uref = doc(db, 'users', uid);
          const usnap = await getDoc(uref);
          if (usnap.exists()) {
            const data = usnap.data() || {};
            const total = Number(data.totalPoints || data.sellerPoints || 0) || 0;
            if (!cancelled) setPoints(total);
          }
        } catch (e) { /* ignore */ }
        // Attach realtime listener
        attachRealtimeListener();
        attachUserPointsListener();
        attachHistoryListener();
      } catch (e) {
        if (!cancelled) { setSold(0); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      if (unsubRef.current) { try { unsubRef.current(); } catch(e) {} }
      if (userUnsubRef.current) { try { userUnsubRef.current(); } catch(e) {} }
      if (historyUnsubRef.current) { try { historyUnsubRef.current(); } catch(e) {} }
      if (buyerHistoryUnsubRef.current) { try { buyerHistoryUnsubRef.current(); } catch(e) {} }
    };
  }, [attachRealtimeListener, attachUserPointsListener, attachHistoryListener]);

  function isSoldStatus(status) {
    if (!status) return false;
    const s = String(status).toLowerCase();
    return s === 'sold' || s === 'completed' || s === 'delivered';
  }

  

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-teal-50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">Impact Report</h3>
        <div className="text-xs text-gray-500">Updated: {new Date().toLocaleDateString()}</div>
      </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Items Sold */}
        <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-blue-600 font-medium">Items Sold</div>
              <div className="mt-1 text-3xl font-extrabold text-blue-700">{loading ? '—' : sold}</div>
            </div>
            <div className="text-4xl">🛍️</div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white/80 rounded-full h-2 overflow-hidden shadow-inner">
              <div className="h-2 bg-blue-500 transition-all" style={{ width: `${pct(sold, goals.sold)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-blue-700/80">
              <span>{pct(sold, goals.sold)}% of goal</span>
              <span>Goal: {goals.sold}</span>
            </div>
          </div>
        </div>
        {/* Points */}
        <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-emerald-600 font-medium">Points</div>
              <div className="mt-1 text-3xl font-extrabold text-emerald-700">{loading ? '—' : points.toLocaleString()}</div>
            </div>
            <div className="text-4xl">⭐</div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white/80 rounded-full h-2 overflow-hidden shadow-inner">
              <div className="h-2 bg-emerald-500 transition-all" style={{ width: `${pct(points, goals.points)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-emerald-700/80">
              <span>{pct(points, goals.points)}% of goal</span>
              <span>Goal: {goals.points.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold text-gray-800">Recent Transactions</h4>
          <span className="text-xs text-gray-500">{historyLoading ? 'Loading transactions…' : `Showing latest ${Math.min(history.length, 50)} records`}</span>
        </div>
        {historyLoading ? (
          <div className="overflow-auto border rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">Counterparty</th>
                  <th className="px-3 py-2 text-right">Your Points</th>
                  <th className="px-3 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td colSpan={4} className="px-3 py-4">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (history.length === 0 ? (
          <div className="text-sm text-gray-500">No transactions yet.</div>
        ) : (
          <div className="overflow-auto border rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">Counterparty</th>
                  <th className="px-3 py-2 text-right">Your Points</th>
                  <th className="px-3 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const uid = (auth && auth.currentUser && auth.currentUser.uid) || '';
                  const isSeller = h && String(h.sellerId || '') === String(uid);
                  const counterpartyId = isSeller ? h.buyerId : h.sellerId;
                  const counterparty = nameCache[counterpartyId] || counterpartyId || '—';
                  const yourPoints = isSeller ? Number(h.sellerPoints || 0) : Number(h.buyerPoints || 0);
                  // Prefer title captured in history (survives product deletion); fallback to cache or ID
                  const itemTitle = (h.productTitle && String(h.productTitle).trim()) || productCache[h.productId] || h.productId;
                  return (
                    <tr key={h.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{itemTitle}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{counterparty}</td>
                      <td className={`px-3 py-2 text-right font-medium ${isSeller ? 'text-emerald-700' : 'text-blue-700'}`}>{yourPoints}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(h.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(ts) {
  try {
    if (!ts) return '';
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return '';
    return d.toLocaleString();
  } catch (_) { return ''; }
}
