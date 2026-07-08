import React, { useEffect, useMemo, useState } from 'react'
// ...existing code...
import { useLocation } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import BanNotificationModal from '../components/BanNotificationModal'
import { db } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'
// ...existing code...

// Stable helpers for category filtering
const KNOWN_CATEGORIES = ['electronics','fashion','home & living','furniture','home','sports','services'];
const normalize = (s) => String(s || '').trim().toLowerCase();
const mapSearchToCategory = (q) => {
  const t = normalize(q);
  if (!t) return '';
  if (/(^|\b)(electronic|electronics)(\b|$)/.test(t)) return 'electronics';
  if (/(^|\b)(fashion|clothes|clothing|apparel)(\b|$)/.test(t)) return 'fashion';
  if (/(^|\b)(home\s*&\s*living|home and living)(\b|$)/.test(t)) return 'home & living';
  if (/(^|\b)(furniture)(\b|$)/.test(t)) return 'furniture';
  if (/(^|\b)(home)(\b|$)/.test(t)) return 'home';
  if (/(^|\b)(sport|sports)(\b|$)/.test(t)) return 'sports';
  if (/(^|\b)(service|services)(\b|$)/.test(t)) return 'services';
  if (/(^|\b)(other|others|misc|miscellaneous)(\b|$)/.test(t)) return 'others';
  return '';
};

export default function Marketplace(){
  const locationHook = useLocation();
  const params = new URLSearchParams(locationHook.search);
  const searchQuery = params.get('search') || '';
  const [products, setProducts] = useState([])
  const [showBanModal, setShowBanModal] = useState(false);
  const [banInfo, setBanInfo] = useState({ reason: '', userName: '' });
  // main filter state
  // Remove local search state, use query from URL
  const [category, setCategory] = useState('')
  // const [location, setLocation] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  // sidebar filter state (no sidebarQuery)
  const [sidebarLocation, setSidebarLocation] = useState('')
  const [sidebarMinPrice, setSidebarMinPrice] = useState('')
  const [sidebarMaxPrice, setSidebarMaxPrice] = useState('')
  const [sidebarRating, setSidebarRating] = useState('')
  const [sidebarDelivery, setSidebarDelivery] = useState(false)
  const [sidebarPickup, setSidebarPickup] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false) // Mobile sidebar state

  // Check if current user is banned
  useEffect(() => {
    let cancelled = false;
    async function checkUserBan() {
      try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (!user || !user.id) return;
        
        const res = await fetch(`/api/users/${encodeURIComponent(user.id)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const profile = await res.json();
          if (profile.banned || profile.status === 'banned') {
            if (!cancelled) {
              setBanInfo({
                reason: profile.banReason || 'Violation of community guidelines',
                userName: profile.fullName || profile.name || profile.displayName || profile.username || ''
              });
              setShowBanModal(true);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to check user ban status:', e);
      }
    }
    checkUserBan();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      try {
        // Prefer backend API which normalizes fields
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('API error');
  const json = await res.json();
  const items = Array.isArray(json) ? json : (json.items || []);
  if (!cancelled) setProducts(items);
      } catch (err) {
        // If backend fails, fall back to client Firestore only (no localStorage demo)
        try {
          const snap = await getDocs(collection(db, 'products'));
          const firebaseProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (!cancelled) setProducts(firebaseProducts);
        } catch (e) {
          console.warn('Failed to load products from backend and Firestore', e);
          if (!cancelled) setProducts([]);
        }
      }
    }
    fetchProducts();
    const onProductUpdated = () => { fetchProducts(); };
    window.addEventListener('product-updated', onProductUpdated);
    window.addEventListener('product-created', onProductUpdated);
    return () => { cancelled = true; window.removeEventListener('product-updated', onProductUpdated); window.removeEventListener('product-created', onProductUpdated); };
  }, []);

  const filtered = useMemo(()=>{
    const effectiveCategory = normalize(category) || mapSearchToCategory(searchQuery);
    let res = products.filter(p=>{
      if(p.status && p.status !== 'active') return false;
      if(p.dropoffJunkshop) return false; // Exclude drop-off items from marketplace
      if (searchQuery) {
        const tq = searchQuery.toLowerCase();
        const titleOk = (p.title || '').toLowerCase().includes(tq);
        const descOk = (p.description || p.desc || '').toLowerCase().includes(tq);
        if (!titleOk && !descOk) return false;
      }
      const pCat = normalize(p.category);
      if (effectiveCategory) {
        if (effectiveCategory === 'others') {
          // Show items not in known categories when 'Others' is selected
          if (!pCat || KNOWN_CATEGORIES.includes(pCat)) return false;
        } else {
          if (pCat !== effectiveCategory) return false;
        }
      }
  // ...existing code...
      if(minPrice && Number(p.price) < Number(minPrice)) return false
      if(maxPrice && Number(p.price) > Number(maxPrice)) return false
      if (sidebarDelivery && !p.delivery) return false
      if (sidebarPickup && !p.pickup) return false
      return true
    })

    if(sortBy === 'low') res = res.sort((a,b)=>Number(a.price)-Number(b.price))
    if(sortBy === 'high') res = res.sort((a,b)=>Number(b.price)-Number(a.price))
    if(sortBy === 'alpha') res = res.sort((a,b)=> (a.title||'').toString().toLowerCase().localeCompare((b.title||'').toString().toLowerCase()))
    if(sortBy === 'newest') {
      res = res.sort((a,b)=> {
        const aid = a._id || a.id;
        const bid = b._id || b.id;
        // If both are numbers, sort numerically (descending)
        if (typeof bid === 'number' && typeof aid === 'number') return bid - aid;
        // Otherwise, sort as strings (descending)
        return String(bid).localeCompare(String(aid));
      });
    }

    return res
  },[products, searchQuery, category, minPrice, maxPrice, sortBy, sidebarDelivery, sidebarPickup])

  // ...existing code...

  return (
    <div className="relative">
      <BanNotificationModal isOpen={showBanModal} banReason={banInfo.reason} userName={banInfo.userName} />
    <div className="py-6 md:py-8">
      <div className="container mx-auto px-2 md:px-4">
        {/* categories pill bar */}
        <div className="overflow-x-auto py-2 mb-4">
          <div className="flex gap-2 whitespace-nowrap">
            {['All','electronics','fashion','home & living','furniture','home','sports','services','others'].map(cat => (
              <button key={cat} onClick={()=> setCategory(cat==='All' ? '' : cat)} className={`px-3 py-1 rounded-full border text-sm sm:text-base flex-shrink-0 ${category === (cat==='All' ? '' : cat) ? 'bg-teal-600 text-white' : 'bg-white text-gray-700'}`}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile filter button + Desktop sidebar + Products grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
          {/* Mobile Filters Button */}
          <div className="md:hidden mb-2">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full p-3 bg-teal-600 text-white rounded font-semibold flex items-center justify-between"
            >
              <span>Filters</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6"></line>
                <line x1="4" y1="12" x2="20" y2="12"></line>
                <line x1="4" y1="18" x2="20" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Desktop Sidebar */}
          <aside className="hidden md:block md:col-span-1">
            <div className="p-4 border rounded bg-white sticky top-20">
              <h3 className="font-semibold mb-4">Filters</h3>
              <div className="mb-4">
                <input placeholder="Location" className="w-full p-2 border rounded text-sm" value={sidebarLocation} onChange={e=>setSidebarLocation(e.target.value)} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Price range</label>
                <div className="flex gap-2 mb-2">
                  <input type="number" min="0" placeholder="Min" className="w-1/2 p-2 border rounded text-sm" value={sidebarMinPrice} onChange={e=>setSidebarMinPrice(e.target.value)} />
                  <input type="number" min="0" placeholder="Max" className="w-1/2 p-2 border rounded text-sm" value={sidebarMaxPrice} onChange={e=>setSidebarMaxPrice(e.target.value)} />
                </div>
                <button className="w-full p-2 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700" onClick={()=>{ setMinPrice(sidebarMinPrice); setMaxPrice(sidebarMaxPrice); }}>Apply</button>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Ratings</label>
                <select className="w-full p-2 border rounded text-sm" value={sidebarRating} onChange={e=>setSidebarRating(e.target.value)}>
                  <option value="">All ratings</option>
                  <option value="1">1 star & up</option>
                  <option value="2">2 stars & up</option>
                  <option value="3">3 stars & up</option>
                  <option value="4">4 stars & up</option>
                  <option value="5">5 stars</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Category</label>
                <select className="w-full p-2 border rounded text-sm" value={category} onChange={e=>setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  <option value="electronics">Electronics</option>
                  <option value="home & living">Home & Living</option>
                  <option value="furniture">Furniture</option>
                  <option value="sports">Sports</option>
                  <option value="fashion">Fashion</option>
                  <option value="home">Home</option>
                  <option value="services">Services</option>
                  <option value="others">Others</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2">Fulfillment</label>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={sidebarDelivery} onChange={e=>setSidebarDelivery(e.target.checked)} /> Delivery</label>
                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={sidebarPickup} onChange={e=>setSidebarPickup(e.target.checked)} /> Pickup</label>
                </div>
              </div>
            </div>
          </aside>

          {/* Mobile Filter Drawer */}
          {sidebarOpen && (
            <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50 flex items-end">
              <div className="w-full bg-white rounded-t-2xl p-4 max-h-96 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Filters</h3>
                  <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <input placeholder="Location" className="w-full p-2 border rounded text-sm" value={sidebarLocation} onChange={e=>setSidebarLocation(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Price range</label>
                  <div className="flex gap-2 mb-2">
                    <input type="number" min="0" placeholder="Min" className="w-1/2 p-2 border rounded text-sm" value={sidebarMinPrice} onChange={e=>setSidebarMinPrice(e.target.value)} />
                    <input type="number" min="0" placeholder="Max" className="w-1/2 p-2 border rounded text-sm" value={sidebarMaxPrice} onChange={e=>setSidebarMaxPrice(e.target.value)} />
                  </div>
                  <button className="w-full p-2 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700" onClick={()=>{ setMinPrice(sidebarMinPrice); setMaxPrice(sidebarMaxPrice); setSidebarOpen(false); }}>Apply</button>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Ratings</label>
                  <select className="w-full p-2 border rounded text-sm" value={sidebarRating} onChange={e=>setSidebarRating(e.target.value)}>
                    <option value="">All ratings</option>
                    <option value="1">1 star & up</option>
                    <option value="2">2 stars & up</option>
                    <option value="3">3 stars & up</option>
                    <option value="4">4 stars & up</option>
                    <option value="5">5 stars</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select className="w-full p-2 border rounded text-sm" value={category} onChange={e=>setCategory(e.target.value)}>
                    <option value="">All categories</option>
                    <option value="electronics">Electronics</option>
                    <option value="home & living">Home & Living</option>
                    <option value="furniture">Furniture</option>
                    <option value="sports">Sports</option>
                    <option value="fashion">Fashion</option>
                    <option value="home">Home</option>
                    <option value="services">Services</option>
                    <option value="others">Others</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-2">Fulfillment</label>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={sidebarDelivery} onChange={e=>setSidebarDelivery(e.target.checked)} /> Delivery</label>
                    <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={sidebarPickup} onChange={e=>setSidebarPickup(e.target.checked)} /> Pickup</label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Products Section */}
          <div className="col-span-1 md:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">All listings</h2>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="p-2 border rounded text-sm sm:text-base">
                <option value="newest">Newest</option>
                <option value="alpha">Alphabetical (A → Z)</option>
                <option value="low">Lowest price</option>
                <option value="high">Highest price</option>
              </select>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {filtered.map((i, idx)=> <ProductCard key={i._id || i.id} product={i} index={idx} style={{ '--delay': `${idx * 60}ms` }} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}