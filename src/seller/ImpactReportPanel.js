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

  function pct(value, total) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((Number(value) / Number(total)) * 100));
  }

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
    };
  }, [attachRealtimeListener, attachUserPointsListener]);

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
    </div>
  );
}
