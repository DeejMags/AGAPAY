import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import RatingStars from '../components/RatingStars'
import ProductCard from '../components/ProductCard'
import authFetch from '../utils/authFetch'
import FullScreenLoader from '../components/FullScreenLoader'
import ReportModal from '../components/ReportModal'

export default function Profile(){
  // ...existing code...
  // (Ensure all code for Profile component is above this bracket)
// ...existing code...

function ProfileHeader({ me, onPicChange, menu }) {
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
      <h2 className="mt-4 text-xl font-semibold">{me ? (me.name || me.username) : 'User'}</h2>
      <div className="text-sm text-gray-600">{me ? me.email : ''}</div>
      {me && me.phone && <div className="text-sm text-gray-600 mt-1">{me.phone}</div>}
      {me && me.location && <div className="text-sm text-gray-600 mt-1">{me.location}</div>}
    </div>
  );
}
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [myProducts, setMyProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const menuRef = useRef(null)

  // close menu on outside click
  useEffect(() => {
    function onDocMouseDown(e){
      // Close only if click is outside the menu wrapper
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return ()=> document.removeEventListener('mousedown', onDocMouseDown);
  }, [])

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
        }
        if (email) {
          const u = await fetchUserByParam(email);
          if (u) return u;
        }
      } catch (e) {
        // ignore
      }
      const local = JSON.parse(localStorage.getItem('user') || 'null');
      if (local && (local.id || local.authId || local.email)) {
        const key = local.id || local.authId || local.email;
        const u = await fetchUserByParam(key);
        if (u) return u;
        return local; // last resort
      }
      return null;
    }

    async function load() {
      setLoading(true);
      // 1) Resolve which user profile to show
      let profile = null;
      if (id) profile = await fetchUserByParam(id);
      else profile = await fetchCurrentUser();
      setUser(profile);

      // 2) Load products (public API shows active by default)
      let products = [];
      try {
        const res = await fetch('/api/products');
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
      } else {
        setMyProducts([]);
      }
      setLoading(false);
    }
    load();
  }, [id]);

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
            <h2 className="mt-2 text-xl font-semibold">{user.username}</h2>
            <div className="text-sm text-gray-600">{user.email}</div>
            {/* Only show rating stars if user is a seller (has listings) */}
            {myProducts.length > 0 && (
              <div className="mt-2">
                <RatingStars value={(user.ratings||[]).length ? Math.round((user.ratings.reduce((s,r)=>s+r.ratingValue,0))/(user.ratings.length)) : 0} />
              </div>
            )}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{id ? `${user.username || 'Seller'}'s listings` : 'My listings'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {myProducts.length ? myProducts.map(p=> <ProductCard key={p._id || p.id} product={p} />) : <div className="p-4 border rounded">No listings yet.</div>}
          </div>
        </div>
      </div>
      {/* Report modal */}
      <ReportModal open={showReport} onClose={()=>setShowReport(false)} reportedUser={user} onSubmitted={()=>{ /* could toast */ }} />
    </div>
  )

}
