import React, { useEffect, useState, useRef, useCallback } from 'react';
import authFetch from '../utils/authFetch';
import { auth } from '../firebase';
import {
  BADGE_ORDER,
  badgeChipClasses,
  computeNextBadge,
  computeProgressToNext,
  formatBadgeLabel,
  getBadgeIcon,
  getBadgeMeta,
  normalizeBadgeTier,
  sanitizeBadgeList,
} from '../utils/badges';

function toDate(value) {
  if (!value) return null;
  try {
    if (typeof value.toDate === 'function') {
      const d = value.toDate();
      return Number.isNaN(d?.getTime()) ? null : d;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (_) {
    return null;
  }
}

export default function ImpactReportPanel() {
  const [loading, setLoading] = useState(true);
  const [sold, setSold] = useState(0);
  const [points, setPoints] = useState(0);
  const [goals] = useState({ sold: 20, points: 1000 }); // add points goal for UI only
  const unsubRef = useRef(null);
  const userUnsubRef = useRef(null);
  const historyUnsubRef = useRef(null);
  const buyerHistoryUnsubRef = useRef(null);
  const [history, setHistory] = useState([]); // list of transactions for this seller
  const [historyLoading, setHistoryLoading] = useState(true); // loading indicator for transactions
  const [nameCache, setNameCache] = useState({}); // userId -> name 
  const [productCache, setProductCache] = useState({}); // productId -> title
  const [badgeState, setBadgeState] = useState({
    unlocked: [],
    highestTier: null,
    equippedBadge: null,
    badgeUpdatedAt: null,
    showOnProfile: true,
  });
  const [equipStatus, setEquipStatus] = useState({ state: 'idle', tier: null, message: null, error: null, context: null });
  const [visibilityStatus, setVisibilityStatus] = useState({ state: 'idle', error: null });
  const [dismissedPrompts, setDismissedPrompts] = useState(() => new Set());
  // Refs mirror caches to avoid adding them as dependencies in callbacks that attach listeners
  const nameCacheRef = useRef({});
  const productCacheRef = useRef({});

  useEffect(() => { nameCacheRef.current = nameCache; }, [nameCache]);
  useEffect(() => { productCacheRef.current = productCache; }, [productCache]);

  const dismissPrompt = useCallback((key) => {
    if (!key) return;
    setDismissedPrompts(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  function pct(value, total) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((Number(value) / Number(total)) * 100));
  }

  const applyBadgeFromProfile = useCallback((profile) => {
    if (!profile || typeof profile !== 'object') return;
    const ordered = sanitizeBadgeList(profile.badgesUnlocked || []);
    const highestCandidate = normalizeBadgeTier(profile.equippedBadge || profile.highestBadgeTier || profile.badgeTier);
    const highestFromUnlocked = ordered.length ? ordered[ordered.length - 1] : null;
    const hasBadgeUpdatedAt = Object.prototype.hasOwnProperty.call(profile, 'badgeUpdatedAt');
    const badgeUpdatedAt = hasBadgeUpdatedAt ? toDate(profile.badgeUpdatedAt) : null;
    const showOnProfile = profile.showBadgeOnProfile === undefined ? true : !!profile.showBadgeOnProfile;
    const equippedNormalized = normalizeBadgeTier(profile.equippedBadge);

    setBadgeState(prev => ({
      unlocked: ordered,
      highestTier: highestCandidate || highestFromUnlocked || null,
      equippedBadge: equippedNormalized || highestCandidate || highestFromUnlocked || null,
      badgeUpdatedAt: hasBadgeUpdatedAt ? badgeUpdatedAt : prev.badgeUpdatedAt,
      showOnProfile,
    }));
  }, []);

  const waitForCurrentUser = useCallback(() => {
    if (auth && auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise(resolve => {
      let settled = false;
      let timer = null;
      let unsubscribe = () => {};
      const finish = (user) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        unsubscribe();
        resolve(user || (auth ? auth.currentUser : null));
      };
      timer = setTimeout(() => finish(auth ? auth.currentUser : null), 2500);
      unsubscribe = auth.onAuthStateChanged(user => finish(user));
    });
  }, []);

  const handleEquipBadge = useCallback(async (nextTierRaw, contextKey = null) => {
    const tier = normalizeBadgeTier(nextTierRaw);
    const tierKey = tier || 'none';
    setEquipStatus({ state: 'saving', tier: tierKey, message: null, error: null, context: contextKey });
    try {
      const user = await waitForCurrentUser();
      if (!user || !user.uid) throw new Error('Please sign in to update your badge.');
      const res = await authFetch(`/api/users/${encodeURIComponent(user.uid)}/badges/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      let data = {};
      try { data = await res.json(); } catch (_) { data = {}; }
      if (!res.ok) {
        const message = (data && (data.error || data.message)) ? (data.error || data.message) : 'Failed to update badge';
        throw new Error(message);
      }
      const unlockedFromServer = Array.isArray(data.badgesUnlocked)
        ? sanitizeBadgeList(data.badgesUnlocked)
        : null;
      const equippedFromServer = normalizeBadgeTier(data.equippedBadge);
      const highestFromServer = normalizeBadgeTier(data.highestBadgeTier);
      const updatedAt = data.badgeUpdatedAt ? new Date(data.badgeUpdatedAt) : new Date();
      setBadgeState(prev => ({
        ...prev,
        unlocked: unlockedFromServer === null ? prev.unlocked : unlockedFromServer,
        equippedBadge: equippedFromServer || null,
        highestTier: highestFromServer || prev.highestTier,
        badgeUpdatedAt: Number.isNaN(updatedAt.getTime()) ? prev.badgeUpdatedAt : updatedAt,
        showOnProfile: data.showBadgeOnProfile === undefined ? prev.showOnProfile : !!data.showBadgeOnProfile,
      }));
      setEquipStatus({
        state: 'success',
        tier: tierKey,
        message: tier ? `${formatBadgeLabel(tier)} equipped` : 'Automatic badge selection restored',
        error: null,
        context: contextKey,
      });
      if (contextKey) dismissPrompt(contextKey);
    } catch (err) {
      setEquipStatus({ state: 'error', tier: tierKey, message: null, error: err.message || 'Unable to update badge', context: contextKey });
    }
  }, [setBadgeState, waitForCurrentUser, dismissPrompt]);

  const handleToggleBadgeVisibility = useCallback(async () => {
    const currentlyVisible = badgeState.showOnProfile !== false;
    const nextVisible = !currentlyVisible;
    setVisibilityStatus({ state: 'saving', error: null });
    try {
      const user = await waitForCurrentUser();
      if (!user || !user.uid) throw new Error('Please sign in to update your badge.');
      const fallbackTier = badgeState.unlocked.length ? badgeState.unlocked[badgeState.unlocked.length - 1] : null;
      const tierToSend = nextVisible
        ? (normalizeBadgeTier(badgeState.equippedBadge) || normalizeBadgeTier(badgeState.highestTier) || fallbackTier)
        : null;
      const body = { showOnProfile: nextVisible };
      if (nextVisible && tierToSend) body.tier = tierToSend;
      const res = await authFetch(`/api/users/${encodeURIComponent(user.uid)}/badges/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data = {};
      try { data = await res.json(); } catch (_) { data = {}; }
      if (!res.ok) {
        const message = (data && (data.error || data.message)) ? (data.error || data.message) : 'Failed to update badge visibility';
        throw new Error(message);
      }
      const unlockedFromServer = Array.isArray(data.badgesUnlocked) ? sanitizeBadgeList(data.badgesUnlocked) : null;
      const equippedFromServer = normalizeBadgeTier(data.equippedBadge);
      const highestFromServer = normalizeBadgeTier(data.highestBadgeTier);
      const updatedAt = data.badgeUpdatedAt ? new Date(data.badgeUpdatedAt) : new Date();
      setBadgeState(prev => ({
        ...prev,
        unlocked: unlockedFromServer === null ? prev.unlocked : unlockedFromServer,
        equippedBadge: equippedFromServer === null ? prev.equippedBadge : equippedFromServer,
        highestTier: highestFromServer || prev.highestTier,
        badgeUpdatedAt: Number.isNaN(updatedAt.getTime()) ? prev.badgeUpdatedAt : updatedAt,
        showOnProfile: data.showBadgeOnProfile === undefined ? prev.showOnProfile : !!data.showBadgeOnProfile,
      }));
      setVisibilityStatus({ state: 'success', error: null });
    } catch (err) {
      setVisibilityStatus({ state: 'error', error: err.message || 'Unable to update badge visibility' });
    }
  }, [badgeState.equippedBadge, badgeState.highestTier, badgeState.showOnProfile, badgeState.unlocked, waitForCurrentUser]);


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
        applyBadgeFromProfile(data);
      }, (err) => { console.debug('ImpactReport user points realtime error', err && err.message); });
      userUnsubRef.current = unsub;
    } catch (e) { /* ignore */ }
  }, [applyBadgeFromProfile]);

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
                if (!cancelled) {
                  setPoints(total);
                  applyBadgeFromProfile(u);
                }
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
            if (!cancelled) {
              setPoints(total);
              applyBadgeFromProfile(data);
            }
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
  }, [attachRealtimeListener, attachUserPointsListener, attachHistoryListener, applyBadgeFromProfile]);

  function isSoldStatus(status) {
    if (!status) return false;
    const s = String(status).toLowerCase();
    return s === 'sold' || s === 'completed' || s === 'delivered';
  }

    const safePoints = Number.isFinite(points) ? points : 0;
    const profileVisible = badgeState.showOnProfile !== false;
    const visibleEquipped = profileVisible ? badgeState.equippedBadge : null;
    const currentBadgeTier = visibleEquipped || badgeState.highestTier;
    const currentBadgeMeta = getBadgeMeta(currentBadgeTier);
    const nextBadgeMeta = computeNextBadge(safePoints);
    const badgeProgress = computeProgressToNext(safePoints, currentBadgeMeta, nextBadgeMeta);
    const badgeUnlockedList = BADGE_ORDER.filter(tier => (badgeState.unlocked || []).includes(tier));
    const pointsToNext = nextBadgeMeta ? Math.max(0, nextBadgeMeta.minPoints - safePoints) : 0;
    const badgeDescription = profileVisible
      ? (currentBadgeMeta?.description || 'Keep earning points to unlock your first badge.')
      : 'Badge hidden from your profile. Toggle visibility whenever you are ready to showcase it.';
    const badgeLastUpdated = badgeState.badgeUpdatedAt ? badgeState.badgeUpdatedAt.toLocaleString() : null;
    const activeEquippedTier = profileVisible ? (badgeState.equippedBadge || null) : null;
    const equipSavingKey = equipStatus.state === 'saving' ? equipStatus.tier : null;
    const currentUid = (auth && auth.currentUser && auth.currentUser.uid) || '';

  

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-teal-50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">Impact Report</h3>
        <div className="text-xs text-gray-500">Updated: {new Date().toLocaleDateString()}</div>
      </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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
              <div className="mt-1 text-3xl font-extrabold text-emerald-700">{loading ? '—' : safePoints.toLocaleString()}</div>
            </div>
            <div className="text-4xl">⭐</div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white/80 rounded-full h-2 overflow-hidden shadow-inner">
               <div className="h-2 bg-emerald-500 transition-all" style={{ width: `${pct(safePoints, goals.points)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-emerald-700/80">
              <span>{pct(safePoints, goals.points)}% of goal</span>
              <span>Goal: {goals.points.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-amber-600 font-medium">Badge</div>
              <div className="mt-1 text-3xl font-extrabold text-amber-700 flex items-center gap-2">
                <span>{loading ? '—' : formatBadgeLabel(currentBadgeTier)}</span>
                {(!loading && badgeState.showOnProfile === false) && (
                  <span className="text-[11px] uppercase tracking-wide bg-amber-500/15 text-amber-800 px-2 py-[1px] rounded-full">Hidden</span>
                )}
              </div>
              <p className="text-sm text-amber-700/80 mt-2">
                {loading ? 'Checking badge progress…' : badgeDescription}
              </p>
            </div>
            <div className="text-4xl">
              {loading ? '🏅' : getBadgeIcon(currentBadgeTier)}
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white/80 rounded-full h-2 overflow-hidden shadow-inner">
              <div className="h-2 bg-amber-500 transition-all" style={{ width: `${loading ? 0 : badgeProgress}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between text-xs text-amber-700/80 gap-y-1">
              <span>
                {loading
                  ? 'Calculating progress…'
                  : (nextBadgeMeta
                    ? `${badgeProgress}% towards ${nextBadgeMeta.label}`
                    : 'You reached the highest badge!')}
              </span>
              <span>
                {loading
                  ? '—'
                  : (nextBadgeMeta
                    ? `${Math.max(pointsToNext, 0)} pts to ${nextBadgeMeta.label}`
                    : `${safePoints.toLocaleString()} pts`)}
              </span>
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <span className="text-xs text-amber-700/70">Loading badges…</span>
            ) : badgeUnlockedList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {badgeUnlockedList.map(tier => (
                  <span key={tier} className={`px-2 py-1 text-xs font-semibold rounded-full border ${badgeChipClasses(tier)}`}>
                    {formatBadgeLabel(tier)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-amber-700/70">Unlock badges by closing more sales.</span>
            )}
            {(!loading && badgeLastUpdated) && (
              <div className="text-[11px] text-amber-700/60 mt-2">Updated {badgeLastUpdated}</div>
            )}
          </div>
          <div className="mt-4 border-t border-amber-200 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-amber-600 font-semibold">Profile Visibility</div>
                <p className="text-xs text-amber-700/80">
                  {badgeState.showOnProfile === false ? 'Hidden from your public profile' : 'Visible on your public profile'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleBadgeVisibility}
                disabled={visibilityStatus.state === 'saving'}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                  badgeState.showOnProfile === false
                    ? 'border-emerald-400 text-emerald-700 hover:bg-emerald-50'
                    : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                } ${visibilityStatus.state === 'saving' ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {badgeState.showOnProfile === false ? 'Show badge' : 'Hide badge'}
              </button>
            </div>
            {visibilityStatus.error && (
              <div className="text-xs text-red-600 mt-2">{visibilityStatus.error}</div>
            )}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-semibold text-gray-800">Recent Transactions</h4>
            <span className="text-xs text-gray-500">{historyLoading ? 'Loading transactions…' : `Showing latest ${Math.min(history.length, 50)} records`}</span>
          </div>
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
                {history.map((h, index) => {
                  const uid = currentUid;
                  const isSeller = h && String(h.sellerId || '') === String(uid);
                  const counterpartyId = isSeller ? h.buyerId : h.sellerId;
                  const counterparty = nameCache[counterpartyId] || counterpartyId || '—';
                  const yourPoints = isSeller ? Number(h.sellerPoints || 0) : Number(h.buyerPoints || 0);
                  const rawUnlocks = isSeller ? h?.sellerBadgeUnlocks : h?.buyerBadgeUnlocks;
                  const isBadgeEquipEvent = !!h?.isBadgeEquipEvent || h?.eventType === 'badge_equip';
                  const equippedTier = isBadgeEquipEvent ? normalizeBadgeTier(h?.equippedBadge || h?.badgeTier) : null;
                  const badgeAction = isBadgeEquipEvent ? (h?.badgeAction || (equippedTier ? 'equip' : 'unequip')) : null;
                  const badgeLabel = (isBadgeEquipEvent && equippedTier) ? formatBadgeLabel(equippedTier) : null;
                  const badgeIcon = isBadgeEquipEvent ? getBadgeIcon(equippedTier) : null;
                  const badgeActionCopy = (() => {
                    switch (badgeAction) {
                      case 'hide':
                        return {
                          title: 'Badge hidden from profile',
                          body: 'Your badge is hidden until you decide to show it again.',
                        };
                      case 'show':
                        return {
                          title: 'Badge visible on profile',
                          body: badgeLabel ? `Now showing the ${badgeLabel} badge on your storefront.` : 'Now showing your badge on your storefront.',
                        };
                      case 'unequip':
                        return {
                          title: 'Badge removed from profile',
                          body: 'Your profile now follows automatic badge selection.',
                        };
                      default:
                        return {
                          title: 'Badge equipped on profile',
                          body: badgeLabel ? `Now showing the ${badgeLabel} badge on your storefront.` : 'Now showing your badge on your storefront.',
                        };
                    }
                  })();
                  const itemTitle = isBadgeEquipEvent
                    ? (
                      <div className="flex items-start gap-3 text-left">
                        <div className="text-2xl">{badgeIcon}</div>
                        <div>
                          <div className="text-sm font-semibold text-amber-900">{badgeActionCopy.title}</div>
                          <div className="text-xs text-amber-700">{badgeActionCopy.body}</div>
                        </div>
                      </div>
                    )
                    : ((h.productTitle && String(h.productTitle).trim()) || productCache[h.productId] || h.productId);
                  const counterpartyDisplay = isBadgeEquipEvent ? 'Profile update' : counterparty;
                  const pointsDisplay = isBadgeEquipEvent ? '—' : yourPoints;
                  const unlockedBadges = Array.isArray(rawUnlocks)
                    ? Array.from(new Set(rawUnlocks.map(normalizeBadgeTier).filter(Boolean)))
                    : [];
                  const rowKey = h.id || `${h.productId || 'txn'}-${index}`;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr className="border-t">
                        <td className={`px-3 py-2 ${isBadgeEquipEvent ? '' : 'whitespace-nowrap'}`}>{itemTitle}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{counterpartyDisplay}</td>
                        <td className={`px-3 py-2 text-right font-medium ${isBadgeEquipEvent ? 'text-amber-700' : (isSeller ? 'text-emerald-700' : 'text-blue-700')}`}>{pointsDisplay}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(h.createdAt)}</td>
                      </tr>
                      {unlockedBadges.length > 0 && (
                        <tr className="border-t bg-amber-50/60">
                          <td colSpan={4} className="px-3 py-3 space-y-3">
                            {unlockedBadges.map(tier => {
                              const promptKey = `${rowKey}:${tier}`;
                              if (dismissedPrompts.has(promptKey)) return null;
                              const meta = getBadgeMeta(tier);
                              const label = formatBadgeLabel(tier);
                              const busy = equipStatus.state === 'saving' && equipStatus.context === promptKey && equipSavingKey === tier;
                              const feedbackContextMatch = equipStatus.context === promptKey && equipStatus.tier === tier;
                              const feedbackState = feedbackContextMatch && equipStatus.state !== 'saving'
                                ? (equipStatus.error ? 'error' : equipStatus.message ? 'success' : null)
                                : null;
                              const feedbackText = feedbackState === 'error'
                                ? (equipStatus.error || '')
                                : (feedbackState === 'success' ? (equipStatus.message || '') : '');
                              const alreadyEquipped = activeEquippedTier === tier;
                              return (
                                <div key={promptKey} className="rounded-xl border border-amber-200 bg-white px-3 py-3 shadow-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-900">
                                        <span className="text-lg">{getBadgeIcon(tier)}</span>
                                        <span>{label}</span>
                                        <span className="text-[10px] uppercase tracking-wide bg-amber-500/10 text-amber-700 px-2 py-[1px] rounded-full">New badge unlocked</span>
                                      </div>
                                      <p className="text-xs text-amber-700 mt-1">
                                        {meta?.description || 'Display this badge on your profile to highlight your impact.'}
                                      </p>
                                      <p className="text-xs text-amber-600 mt-1">Equip this badge on your profile?</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleEquipBadge(tier, promptKey)}
                                        disabled={busy || alreadyEquipped}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                          alreadyEquipped
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-amber-500 text-white hover:bg-amber-600'
                                        } ${busy ? 'opacity-70 cursor-not-allowed' : ''}`}
                                      >
                                        {alreadyEquipped ? 'Showing' : busy ? 'Equipping…' : 'Equip Badge'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => dismissPrompt(promptKey)}
                                        disabled={busy}
                                        className="rounded-full px-4 py-2 text-sm font-semibold border border-amber-200 text-amber-700 hover:border-amber-400"
                                      >
                                        Maybe later
                                      </button>
                                    </div>
                                  </div>
                                  {feedbackState && (
                                    <div className={`text-xs mt-2 ${feedbackState === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                                      {feedbackText}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
