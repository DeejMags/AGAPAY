import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import RatingStars from '../components/RatingStars'
import MapEmbed from '../components/MapEmbed'
import ProductCard from '../components/ProductCard'
import authFetch from '../utils/authFetch'
import FullScreenLoader from '../components/FullScreenLoader'
import ReportModal from '../components/ReportModal'

function mergeWithHint(base, hint) {
  if (!hint) return base;
  const merged = { ...(base || {}) };
  if (!merged.id && hint.id) merged.id = hint.id;
  if (!merged.authId && hint.authId) merged.authId = hint.authId;
  if (!merged.email && hint.email) merged.email = hint.email;
  const fallbackName = hint.username || hint.displayName || hint.name || (hint.email ? String(hint.email).split('@')[0] : null);
  if (!merged.username && fallbackName) merged.username = fallbackName;
  if (!merged.displayName && fallbackName) merged.displayName = fallbackName;
  if (!merged.name && fallbackName) merged.name = fallbackName;
  if (!merged.fullName && fallbackName) merged.fullName = fallbackName;
  if (!merged.profilePic && (hint.profilePic || hint.avatar)) merged.profilePic = hint.profilePic || hint.avatar;
  return merged;
}

export default function Profile(){
  // ...existing code...
  // (Ensure all code for Profile component is above this bracket)
// ...existing code...

function ProfileHeader({ me, onPicChange, menu }) {
  const displayName = me ? (me.username || me.name || me.displayName || me.fullName || (me.email ? String(me.email).split('@')[0] : 'User')) : 'User';
  return (
    <div className="relative bg-white border rounded p-4 flex flex-col items-center">
      {/* Three-dots actions outside the portrait, top-right of the card */}
      {menu ? (
        <div className="absolute top-2 right-2 z-30">
          {menu}
        </div>
      ) : null}
      <div className="relative w-40 h-40 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
        {me && me.profilePic ? (
          <img src={me.profilePic} alt="profile" className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-500">No photo</div>
        )}
      </div>
      <h2 className="mt-4 text-xl font-semibold">{displayName}</h2>
      <div className="text-sm text-gray-600">{me ? me.email : ''}</div>
      {me && me.phone && <div className="text-sm text-gray-600 mt-1">{me.phone}</div>}
      {me && me.location && <div className="text-sm text-gray-600 mt-1">{me.location}</div>}
    </div>
  );
}
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const hintState = location && location.state && location.state.userHint ? location.state.userHint : null
  const hintRef = useRef(hintState)
  const [user, setUser] = useState(() => mergeWithHint(null, hintRef.current))
  const [myProducts, setMyProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const menuRef = useRef(null)
  // Trigger reload when auth state becomes available (fixes initial 'User' until refresh)
  const [reloadTick, setReloadTick] = useState(0)
  // Seller review related state (only used when viewing another user's profile via :id)
  const [sellerReviews, setSellerReviews] = useState([])
  const [ratingAverage, setRatingAverage] = useState(0)
  const [ratingCount, setRatingCount] = useState(0)
  const [canReview, setCanReview] = useState(false)
  const [myExistingReview, setMyExistingReview] = useState(null)
  const [pendingRating, setPendingRating] = useState('')
  const [pendingComment, setPendingComment] = useState('')
  // Seller stats derived from products (sold count, distinct buyers)
  const [sellerStats, setSellerStats] = useState({ sold: 0, buyers: [], buyersResolved: [] })

  useEffect(() => {
    if (hintState) {
      hintRef.current = hintState;
      setUser(prev => mergeWithHint(prev, hintState));
    }
  }, [hintState])

  // close menu on outside click
  useEffect(() => {
    function onDocMouseDown(e){
      // Close only if click is outside the menu wrapper
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return ()=> document.removeEventListener('mousedown', onDocMouseDown);
  }, [])

  // When viewing own profile (no :id), wait for Firebase auth to initialize and then reload
  useEffect(() => {
    if (id) return; // only for self profile
    let unsub = null;
    (async () => {
      try {
        const { auth } = await import('../firebase');
        unsub = auth.onAuthStateChanged(() => setReloadTick(t => t + 1));
      } catch (e) { /* ignore */ }
    })();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [id])

  useEffect(() => {
    async function fetchUserByParam(paramId) {
      // Backend first: supports Firestore doc id, Firebase UID (authId), or email
      try {
        const r = await authFetch(`/api/users/${encodeURIComponent(paramId)}`);
        if (r.ok) return await r.json();
      } catch (e) {
        // ignore and try Firestore
      }
      try {
        const { db } = await import('../firebase');
        const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');
        // Try direct doc
        const directRef = doc(db, 'users', paramId);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) return { id: directSnap.id, ...directSnap.data() };
        // Try by authId
        const q1 = query(collection(db, 'users'), where('authId', '==', paramId));
        const s1 = await getDocs(q1);
        if (!s1.empty) return { id: s1.docs[0].id, ...s1.docs[0].data() };
        // If looks like email, try by email
        if (typeof paramId === 'string' && paramId.includes('@')) {
          const q2 = query(collection(db, 'users'), where('email', '==', paramId));
          const s2 = await getDocs(q2);
          if (!s2.empty) return { id: s2.docs[0].id, ...s2.docs[0].data() };
        }
        // Fallback: derive minimal seller profile from a product document
        // This covers cases where sellerId references a legacy value not present in users collection.
        try {
          const { limit } = await import('firebase/firestore');
          // Find product whose sellerId matches paramId
          const qp1 = query(collection(db, 'products'), where('sellerId', '==', paramId), limit(1));
          const ps1 = await getDocs(qp1);
          let prodDoc = null;
          if (!ps1.empty) prodDoc = ps1.docs[0].data();
          // If not found, try owner field (email-based legacy owner)
          if (!prodDoc && typeof paramId === 'string' && paramId.includes('@')) {
            const qp2 = query(collection(db, 'products'), where('owner', '==', paramId), limit(1));
            const ps2 = await getDocs(qp2);
            if (!ps2.empty) prodDoc = ps2.docs[0].data();
          }
          if (prodDoc) {
            const username = prodDoc.sellerName || prodDoc.seller || (prodDoc.owner && prodDoc.owner.split('@')[0]) || 'Seller';
            return {
              id: paramId,
              authId: null,
              email: typeof paramId === 'string' && paramId.includes('@') ? paramId : (prodDoc.owner || null),
              username,
              displayName: username,
              profilePic: prodDoc.sellerAvatar || null,
              // mark as synthetic so future enrichment can replace it
              _synthetic: true
            };
          }
        } catch (e) { /* ignore product fallback errors */ }
      } catch (e) {
        console.warn('Profile: Firestore fallback failed for user lookup', e);
      }
      return null;
    }

    async function fetchCurrentUser() {
      // Prefer Firebase auth uid if available, fallback to localStorage
      try {
        const { auth } = await import('../firebase');
        const uid = auth && auth.currentUser ? auth.currentUser.uid : null;
        const email = auth && auth.currentUser ? auth.currentUser.email : null;
        if (uid) {
          const u = await fetchUserByParam(uid);
          if (u) return u;
          // Build a minimal profile from auth if Firestore lookup failed
          const baseName = email ? String(email).split('@')[0] : 'User';
          return { id: uid, authId: uid, email: email || null, username: baseName, displayName: baseName };
        }
        if (email) {
          const u = await fetchUserByParam(email);
          if (u) return u;
          const baseName = String(email).split('@')[0];
          return { id: email, authId: null, email, username: baseName, displayName: baseName };
        }
      } catch (e) {
        // ignore
      }
      const local = JSON.parse(localStorage.getItem('user') || 'null');
      if (local && (local.id || local.authId || local.email)) {
        const key = local.id || local.authId || local.email;
        const u = await fetchUserByParam(key);
        if (u) return u;
        // Ensure local has a sensible display name fallback
        const email = local.email || null;
        const baseName = email ? String(email).split('@')[0] : (local.username || local.displayName || 'User');
        return { ...local, username: local.username || baseName, displayName: local.displayName || baseName };
      }
      return null;
    }

    async function enrichProfile(u) {
      if (!u) return null;
      const hasName = !!(u.username || u.name || u.displayName || u.fullName);
      const hasEmail = !!u.email;
      if (hasName && hasEmail) return u;
      // Try multiple keys: id, authId, email
      const candidates = [u.id, u.authId, u.email].filter(Boolean).map(String);
      for (const key of candidates) {
        try {
          const r = await authFetch(`/api/users/${encodeURIComponent(key)}`);
          if (r && r.ok) {
            const j = await r.json();
            const merged = {
              ...u,
              username: u.username || j.username || j.displayName || undefined,
              name: u.name || j.name || undefined,
              displayName: u.displayName || j.displayName || j.username || undefined,
              fullName: u.fullName || j.fullName || undefined,
              email: u.email || j.email || undefined,
              profilePic: u.profilePic || j.profilePic || j.photoURL || undefined,
            };
            return merged;
          }
        } catch (e) { /* continue */ }
      }
      // Firestore fallback by id
      try {
        const { db } = await import('../firebase');
        const { doc, getDoc } = await import('firebase/firestore');
        const ref = doc(db, 'users', String(u.id || ''));
        const snap = await getDoc(ref);
        if (snap.exists()) return { id: snap.id, ...snap.data(), ...u };
      } catch (e) { /* ignore */ }
      return u;
    }

    async function load() {
      setLoading(true);
      // Snapshot auth user to enrich profile with displayName/email/photo
      let authUser = null;
      try {
        const { auth } = await import('../firebase');
        authUser = auth && auth.currentUser ? auth.currentUser : null;
      } catch (e) { /* ignore */ }

      // 1) Resolve which user profile to show
      let profile = null;
      if (id) profile = await fetchUserByParam(id);
      else profile = await fetchCurrentUser();

      // Merge auth details immediately to avoid rendering generic 'User' after refresh
      if (authUser && !profile && !id) {
        const viewerEmail = authUser.email || null;
        const baseName = viewerEmail ? String(viewerEmail).split('@')[0] : undefined;
        profile = {
          id: authUser.uid,
          authId: authUser.uid,
          email: viewerEmail,
          username: authUser.displayName || baseName || 'User',
          displayName: authUser.displayName || baseName || 'User',
          name: authUser.displayName || baseName || 'User',
          profilePic: authUser.photoURL || undefined,
        };
      } else if (authUser && profile) {
        const viewerUid = authUser.uid || null;
        const viewerEmail = authUser.email || null;
        const profileId = profile && profile.id ? String(profile.id) : null;
        const profileAuthId = profile && profile.authId ? String(profile.authId) : null;
        const initialParam = id ? String(id) : null;
        const isSelfProfile = (!id)
          || (viewerUid && profileAuthId && profileAuthId === viewerUid)
          || (viewerUid && profileId && profileId === viewerUid)
          || (viewerUid && initialParam && initialParam === viewerUid)
          || (viewerEmail && profile.email && String(profile.email).toLowerCase() === String(viewerEmail).toLowerCase());

        if (isSelfProfile) {
          const email = viewerEmail || profile.email || null;
          const baseName = email ? String(email).split('@')[0] : undefined;
          profile = {
            ...profile,
            authId: profile?.authId || viewerUid,
            email: profile?.email || viewerEmail || null,
            profilePic: profile?.profilePic || authUser.photoURL || undefined,
            username: profile?.username || authUser.displayName || baseName || profile?.username,
            displayName: profile?.displayName || authUser.displayName || baseName || profile?.displayName,
            name: profile?.name || authUser.displayName || profile?.name,
          };
        }
      }

      profile = mergeWithHint(profile, hintRef.current);
      setUser(profile);

      // Best-effort enrichment to populate missing name/email without requiring a manual refresh
      try {
        const improved = await enrichProfile(profile);
        if (improved) setUser(mergeWithHint(improved, hintRef.current));
      } catch (e) { /* ignore */ }

      // 2) Load products (public API shows active by default)
      let products = [];
      try {
        const res = await authFetch('/api/products');
        if (res.ok) {
          const json = await res.json();
          products = Array.isArray(json) ? json : (json.items || []);
        } else throw new Error('API failed');
      } catch (err) {
        try {
          const { collection, getDocs } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          const snap = await getDocs(collection(db, 'products'));
          products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn('Failed to load products for profile', e);
          products = [];
        }
      }

      // 3) Filter listings for the profile owner (match by id, authId, or owner email)
      if (profile) {
        const pid = String(profile.id || '');
        const pauth = String(profile.authId || '');
        const pemail = String(profile.email || '');
        const mine = products.filter(p => {
          const sid = String(p.sellerId || '');
          const owner = String(p.owner || '');
          return sid === pid || (pauth && sid === pauth) || (pemail && (sid === pemail || owner === pemail));
        });
        setMyProducts(mine);
        // Compute seller stats if viewing seller profile (id present OR own profile with listings)
        const soldItems = mine.filter(p => (String(p.status||'').toLowerCase() === 'sold'));
        const buyerIds = Array.from(new Set(soldItems.map(p => String(p.buyerId || '')).filter(Boolean)));
        setSellerStats(prev => ({ ...prev, sold: soldItems.length, buyers: buyerIds }));

        // If viewing another user's profile and core identity fields are missing,
        // derive a display name/avatar from their product metadata to avoid showing generic "User".
        const missingName = !(profile.username || profile.name || profile.displayName || profile.fullName);
        const missingEmail = !profile.email;
        if ((id && (missingName || missingEmail)) && mine.length) {
          const p0 = mine[0];
          const fallbackName = p0.sellerName || p0.seller || (p0.owner ? String(p0.owner).split('@')[0] : 'Seller');
          const fallbackEmail = p0.owner || null;
          const fallbackAvatar = p0.sellerAvatar || null;
          setUser(prev => ({
            ...prev,
            username: prev?.username || fallbackName,
            displayName: prev?.displayName || fallbackName,
            name: prev?.name || fallbackName,
            email: prev?.email || fallbackEmail,
            profilePic: prev?.profilePic || fallbackAvatar,
          }));
        }
      } else {
        setMyProducts([]);
        setSellerStats({ sold: 0, buyers: [], buyersResolved: [] });
      }
      setLoading(false);
    }
    load();
  }, [id, reloadTick]);

  // Resolve buyer profiles (names) for seller stats
  // ESLint: include buyersResolved in dependency array; guard against unnecessary re-renders.
  useEffect(() => {
    let cancelled = false;
    async function resolveBuyers() {
      const ids = sellerStats.buyers.slice(0, 15); // cap to 15 to avoid excessive requests
      if (!ids.length) return;
      const already = sellerStats.buyersResolved || [];
      // Determine which buyer IDs still need resolving
      const need = ids.filter(bid => !already.some(x => x.id === bid));
      if (!need.length) return; // nothing new to resolve, avoid state update loop
      const merged = [...already];
      for (const bid of need) {
        let profile = null;
        // Backend lookup first
        try {
          const r = await authFetch(`/api/users/${encodeURIComponent(bid)}`);
          if (r.ok) profile = await r.json();
        } catch (e) { /* ignore */ }
        // Firestore fallback if backend failed
        if (!profile) {
          try {
            const { db } = await import('../firebase');
            const { doc, getDoc, collection, query, where, getDocs, limit } = await import('firebase/firestore');
            const direct = await getDoc(doc(db, 'users', bid));
            if (direct.exists()) profile = { id: direct.id, ...direct.data() };
            else {
              const q = query(collection(db, 'users'), where('authId', '==', bid), limit(1));
              const snap = await getDocs(q);
              if (!snap.empty) profile = { id: snap.docs[0].id, ...snap.docs[0].data() };
            }
          } catch (e) { /* ignore */ }
        }
        const display = profile ? (profile.username || profile.displayName || profile.name || (profile.email ? profile.email.split('@')[0] : bid.slice(0,8))) : bid.slice(0,8);
        merged.push({ id: bid, name: display, avatar: profile?.profilePic || profile?.avatar || null });
      }
      if (!cancelled) setSellerStats(prev => ({ ...prev, buyersResolved: merged }));
    }
    resolveBuyers();
    return () => { cancelled = true; };
  }, [sellerStats.buyers, sellerStats.buyersResolved]);

  // Load seller reviews & viewer eligibility when viewing another user's profile
  useEffect(() => {
    if (!id) return; // only run when viewing a seller profile
    let cancelled = false;
    async function loadReviews() {
      // Fetch reviews summary from backend
      try {
        const resp = await authFetch(`/api/reviews/seller/${encodeURIComponent(id)}`);
        if (resp && resp.ok) {
          const json = await resp.json();
          if (!cancelled) {
            setSellerReviews(Array.isArray(json.reviews) ? json.reviews : []);
            setRatingAverage(json.summary?.average ? Number(json.summary.average) : 0);
            setRatingCount(json.summary?.count ? Number(json.summary.count) : 0);
          }
        }
      } catch (e) { /* ignore */ }

      // Determine if current viewer purchased from this seller
      try {
        const { auth } = await import('../firebase');
        const viewerUid = auth && auth.currentUser ? auth.currentUser.uid : null;
        if (!viewerUid) return;
        const { db } = await import('../firebase');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'products'), where('buyerId', '==', viewerUid), where('sellerId', '==', id));
        const snap = await getDocs(q);
        const purchased = !snap.empty;
        if (!cancelled) setCanReview(purchased);
        if (purchased) {
          // Load existing review (if any)
            try {
              const rQ = query(collection(db, 'seller_reviews'), where('sellerId', '==', id), where('buyerId', '==', viewerUid));
              const rSnap = await getDocs(rQ);
              if (!rSnap.empty) {
                const rev = { id: rSnap.docs[0].id, ...rSnap.docs[0].data() };
                if (!cancelled) {
                  setMyExistingReview(rev);
                  setPendingRating(String(rev.rating || ''));
                  setPendingComment(rev.comment || '');
                }
              }
            } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
    }
    loadReviews();
    return () => { cancelled = true; };
  }, [id]);

  async function submitSellerReview() {
    if (!id || !pendingRating) return;
    try {
      const body = { sellerId: id, rating: Number(pendingRating), comment: pendingComment };
      const resp = await authFetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (resp.ok) {
        const json = await resp.json();
        setMyExistingReview(json);
        setPendingRating(String(json.rating));
        setPendingComment(json.comment || '');
        setRatingAverage(Number(json.ratingAverage) || 0);
        setRatingCount(Number(json.ratingCount) || (ratingCount || 1));
        setSellerReviews(prev => {
          const idx = prev.findIndex(r => String(r.buyerId) === String(json.buyerId));
          if (idx >= 0) { const clone = [...prev]; clone[idx] = { ...clone[idx], ...json }; return clone; }
          return [{ id: json.id || `${json.sellerId}_${json.buyerId}`, ...json }, ...prev];
        });
      } else {
        const err = await resp.json().catch(()=>({}));
        alert(err.error || 'Failed to submit review');
      }
    } catch (e) {
      alert('Failed to submit review');
    }
  }

  if (loading) return <FullScreenLoader />
  if(!user) return <div className="py-8 container mx-auto px-4">User not found.</div>

  // Menu element (three dots) shown only when viewing another user's profile
  const menu = id ? (
    <div ref={menuRef} className="relative" onMouseDown={(e)=>e.stopPropagation()}>
      <button
        type="button"
        className="w-9 h-9 flex items-center justify-center bg-white/90 hover:bg-white border border-gray-300 text-gray-800 shadow-sm text-xl"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="More actions"
        onClick={() => setMenuOpen(v => !v)}
      >
        <span aria-hidden>⋮</span>
      </button>
      {menuOpen && (
        <div role="menu" className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-lg z-50">
          <button role="menuitem" className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { setMenuOpen(false); navigate('/reviews'); }}>Review seller</button>
          <button role="menuitem" className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600" onClick={() => { setMenuOpen(false); setShowReport(true); }}>Report seller</button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="py-8 container mx-auto px-4">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/4">
          {/* Profile header: circular image with edit overlay */}
          <ProfileHeader me={user} onPicChange={(u)=>{ setUser(u); }} menu={menu} />

          {/* View / Edit area under header */}
          <div className="mt-4">
            {/* Only show rating stars if user is a seller (has listings); omit duplicate name/email below the profile card */}
            {/* Rating summary */}
            {id ? (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <RatingStars value={Math.round(ratingAverage)} />
                  <span className="text-xs text-gray-600">{ratingCount} review{ratingCount===1?'':'s'}</span>
                </div>
              </div>
            ) : (
              myProducts.length > 0 && (
                <div className="mt-2">
                  <RatingStars value={(user.ratings||[]).length ? Math.round((user.ratings.reduce((s,r)=>s+r.ratingValue,0))/(user.ratings.length)) : 0} />
                </div>
              )
            )}

            {/* Seller stats (sold items and buyers) */}
            {(id || (!id && myProducts.length)) && sellerStats.sold > 0 && (
              <div className="mt-4 border rounded p-3 bg-white shadow-sm">
                <div className="text-xs font-semibold text-gray-700 mb-2">Sales Summary</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div><span className="text-gray-500">Items Sold:</span> <span className="font-semibold">{sellerStats.sold}</span></div>
                  <div><span className="text-gray-500">Distinct Buyers:</span> <span className="font-semibold">{sellerStats.buyers.length}</span></div>
                </div>
                {sellerStats.buyersResolved.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-600 mb-1">Recent Buyers</div>
                    <ul className="space-y-1 max-h-40 overflow-auto pr-1">
                      {sellerStats.buyersResolved.slice(0,10).map(b => (
                        <li key={b.id} className="flex items-center gap-2 text-xs">
                          <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                            {b.avatar ? <img src={b.avatar} alt={b.name} className="w-full h-full object-cover" /> : <span className="text-gray-500">👤</span>}
                          </div>
                          <button
                            type="button"
                            onClick={()=> window.location.href = `/profile/${encodeURIComponent(b.id)}`}
                            className="text-gray-700 hover:text-teal-700 truncate"
                            title={`View ${b.name}'s profile`}
                          >{b.name}</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {id && canReview && (
              <div className="mt-4 w-full border rounded p-3 bg-teal-50">
                <div className="text-sm font-semibold mb-2">{myExistingReview ? 'Update your review' : 'Leave a review'}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Rating</label>
                    <select className="border rounded px-2 py-1 w-full" value={pendingRating} onChange={e=>setPendingRating(e.target.value)}>
                      <option value="">Select</option>
                      {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} ★</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">Comment (optional)</label>
                    <input
                      className="border rounded px-2 py-1 w-full"
                      placeholder="Share your experience with this seller…"
                      value={pendingComment}
                      onChange={e=>setPendingComment(e.target.value)}
                      maxLength={2000}
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    className="px-4 py-2 bg-teal-600 text-white rounded disabled:opacity-50"
                    disabled={!pendingRating}
                    onClick={submitSellerReview}
                  >{myExistingReview ? 'Update Review' : 'Submit Review'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{id ? `${(user.username || user.name || user.displayName || user.fullName || (user.email ? String(user.email).split('@')[0] : 'Seller'))}'s listings` : 'My listings'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {myProducts.length ? myProducts.map(p=> <ProductCard key={p._id || p.id} product={p} />) : <div className="p-4 border rounded">No listings yet.</div>}
          </div>
          {id && sellerReviews.length > 0 && (
            <div className="mt-8">
              <h4 className="font-semibold mb-2">Buyer Reviews</h4>
              <div className="space-y-3">
                {sellerReviews.slice(0,30).map(r => (
                  <div key={r.id} className="p-3 border rounded-lg bg-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700 font-medium">
                        <span className="text-teal-700">{r.buyerName || (r.buyerId ? String(r.buyerId).slice(0,8) : 'Buyer')}</span>
                        <span className="mx-2 text-gray-300">•</span>
                        <span>{Number(r.rating)} ★</span>
                      </div>
                      <div className="text-xs text-gray-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</div>
                    </div>
                    {r.comment && <div className="text-sm text-gray-800 mt-1">{r.comment}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Seller location map: show user's own location if available, otherwise show first product location */}
          {(() => {
            // Determine a representative lat/lng to show
            const userLat = user && (user.locationLat !== undefined ? Number(user.locationLat) : (user.lat !== undefined ? Number(user.lat) : undefined));
            const userLng = user && (user.locationLng !== undefined ? Number(user.locationLng) : (user.lng !== undefined ? Number(user.lng) : undefined));
            let mapLat = null, mapLng = null;
            if (typeof userLat === 'number' && typeof userLng === 'number') {
              mapLat = userLat; mapLng = userLng;
            } else {
              // look for first product with coords
              const withCoords = myProducts.find(pp => (pp.locationLat !== undefined && pp.locationLng !== undefined && pp.locationLat !== null && pp.locationLng !== null));
              if (withCoords) { mapLat = Number(withCoords.locationLat); mapLng = Number(withCoords.locationLng); }
            }
            if (mapLat && mapLng) {
              return (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Seller location</h4>
                  <div className="border rounded overflow-hidden" style={{ height: 300 }}>
                    <MapEmbed lat={mapLat} lng={mapLng} height="300px" />
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>
      {/* Report modal */}
      <ReportModal open={showReport} onClose={()=>setShowReport(false)} reportedUser={user} onSubmitted={()=>{ /* could toast */ }} />
    </div>
  )

}
