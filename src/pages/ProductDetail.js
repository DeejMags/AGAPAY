import React, { useEffect, useState } from 'react'
import FullScreenLoader from '../components/FullScreenLoader'
import { useParams, useNavigate } from 'react-router-dom'
import RatingStars from '../components/RatingStars'
import MapEmbed from '../components/MapEmbed'
import ProductCard from "../components/ProductCard";
import { createOrder } from '../firebaseProductService';
import AdminNotifiedModal from '../components/AdminNotifiedModal';
import deliveryIcon from '../deliverytruck.svg';
import boxIcon from '../box.svg';

export default function ProductDetail(){
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [seller, setSeller] = useState(null)
  // ...existing code...
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [mapOpen, setMapOpen] = useState(false)
  const [geoCoords, setGeoCoords] = useState(null)
  const [geocoding, setGeocoding] = useState(false)
  const navigate = useNavigate()
  const [recommended, setRecommended] = useState([])
  function goBackToMarketplace(){
    try {
      const ref = document.referrer || '';
      if (ref && /\/marketplace(\?|$|#)/i.test(ref)) {
        navigate(-1);
        return;
      }
    } catch {}
    navigate('/marketplace');
  }

  useEffect(()=>{
    setLoading(true)
    const t = setTimeout(()=>{
      (async()=>{
        try {
          // Try backend product fetch
          const res = await fetch(`/api/products/${id}`);
          if (res.ok) {
            const json = await res.json();
            setProduct(json);
            // Load seller profile with robust fallbacks: sellerId -> owner(email) -> inline sellerName
            if (json) {
              try {
                if (json.sellerId) {
                  const r2 = await fetch(`/api/users/${json.sellerId}`);
                  if (r2.ok) {
                    setSeller(await r2.json());
                  } else if (json.owner) {
                    const r3 = await fetch(`/api/users/${encodeURIComponent(json.owner)}`);
                    if (r3.ok) setSeller(await r3.json());
                  } else if (json.sellerName) {
                    setSeller({ id: json.sellerId || json.owner || 'unknown', username: json.sellerName });
                  }
                } else if (json.owner) {
                  const r3 = await fetch(`/api/users/${encodeURIComponent(json.owner)}`);
                  if (r3.ok) setSeller(await r3.json());
                } else if (json.sellerName) {
                  setSeller({ id: json.sellerId || json.owner || 'unknown', username: json.sellerName });
                }
              } catch (e) { console.warn('Failed to fetch seller profile', e); }
            }
            setLoading(false);
            return;
          }
        } catch (err) {
          // fallback to Firestore lookup
        }
        try {
          const { collection, getDocs } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          const snap = await getDocs(collection(db, 'products'));
          const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const p = products.find(x=> x._id === id || x.id === id)
          setProduct(p)
          if(p && p.sellerId){
            const usersSnap = await getDocs(collection(db, 'users'));
            const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const s = users.find(u=> u.id === p.sellerId)
            setSeller(s)
          }
        } catch (e) {
          console.warn('Failed to load product from backend and Firestore', e);
          setProduct(null);
        }
        setLoading(false)
      })()
    }, 600) // simulate loading
    return ()=> clearTimeout(t)
  },[id])

  useEffect(()=>{
    if(!product){ setRecommended([]); return }
    (async ()=>{
      try {
        const res = await fetch('/api/products');
        let products = [];
        if (res.ok) {
          const json = await res.json();
          products = Array.isArray(json) ? json : (json.items || []);
        } else throw new Error('API failed');
        setRecommended((products || []).filter(p=> (p._id || p.id) !== (product._id || product.id) && p.category === product.category).slice(0,4))
      } catch (err) {
        try {
          const { collection, getDocs } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          const snap = await getDocs(collection(db, 'products'));
          const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setRecommended(products.filter(p=> p._id !== product._id && p.category === product.category).slice(0,4))
        } catch (e) { setRecommended([]); }
      }
    })()
  },[product])

  // If product has a textual location but no numeric coords, try geocoding via Nominatim
  useEffect(() => {
    let mounted = true;
    async function geocode() {
      if (!product) return;
      const hasLat = (typeof product.locationLat === 'number' && typeof product.locationLng === 'number');
      if (hasLat) {
        setGeoCoords(null);
        setGeocoding(false);
        return;
      }
      if (!product.location) return;
      try {
        setGeocoding(true);
        const q = encodeURIComponent(product.location);
        const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        if (!res.ok) throw new Error('Geocode failed');
        const arr = await res.json();
        if (mounted && Array.isArray(arr) && arr.length > 0) {
          const lat = Number(arr[0].lat);
          const lon = Number(arr[0].lon);
          if (Number.isFinite(lat) && Number.isFinite(lon)) setGeoCoords({ lat, lng: lon });
        }
      } catch (e) {
        // ignore geocoding errors
        console.warn('Geocoding failed', e && e.message);
      } finally {
        if (mounted) setGeocoding(false);
      }
    }
    geocode();
    return () => { mounted = false; };
  }, [product]);

  // Increment per-user view count for this product's category (no UI here)
  useEffect(() => {
    if (!product || !product.category) return;
    const catRaw = String(product.category || '').trim();
    if (!catRaw) return;
    const catKey = catRaw.replace(/\.+/g, '_');

    (async () => {
      try {
        const { auth, db } = await import('../firebase');
        const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
        const userId = (auth && auth.currentUser && auth.currentUser.uid) || (storedUser && storedUser.id) || null;
        const viewerEmail = (auth && auth.currentUser && auth.currentUser.email) || (storedUser && storedUser.email) || null;
        // Do not count views from the product owner/seller
        const sellerId = product && product.sellerId ? String(product.sellerId) : null;
        const ownerEmail = product && product.owner ? String(product.owner) : null;
        if ((userId && sellerId && String(userId) === sellerId) || (viewerEmail && ownerEmail && viewerEmail === ownerEmail)) {
          return; // skip increment for owner/seller
        }
        if (!userId) {
          // Fallback to localStorage if user is not signed in
          const map = JSON.parse(localStorage.getItem('agapay_category_views') || '{}');
          map[catKey] = Number(map[catKey] || 0) + 1;
          localStorage.setItem('agapay_category_views', JSON.stringify(map));
          return;
        }

        const { doc, setDoc, updateDoc, serverTimestamp, increment } = await import('firebase/firestore');
        const ref = doc(db, 'user_metrics', userId);
        // Ensure the metrics doc exists
        await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
        // Increment the category view counter
        await updateDoc(ref, { [`categoryViews.${catKey}`]: increment(1), [`categoryLast.${catKey}`]: serverTimestamp() });
      } catch (e) {
        // As a last resort, use localStorage tracking so user still sees a count
        const map = JSON.parse(localStorage.getItem('agapay_category_views') || '{}');
        map[catKey] = Number(map[catKey] || 0) + 1;
        localStorage.setItem('agapay_category_views', JSON.stringify(map));
      }
    })();
  }, [product]);

  // ...existing code...

  function openChat(){
    (async () => {
      try {
        const productId = product ? (product._id || product.id) : null;
        const otherId = (seller && seller.id) ? seller.id : (productId ? `seller_${productId}` : 'unknown');
        const svc = await import('../firebaseMessageService');
        // Prefer backend start API so the collection/doc is created even if it was deleted previously
        const primaryImage = (product && product.imageUrl) || (Array.isArray(product?.photo) ? product.photo[0] : product?.photo) || null;
        const convId = await svc.startConversation(otherId, { productId, productName: product ? product.title : null, productImage: primaryImage });
        if (convId && typeof convId === 'string') localStorage.setItem('agapay_active_conv', convId);
        else localStorage.setItem('agapay_active_conv', productId || id);
        navigate('/messages');
      } catch (e) {
        localStorage.setItem('agapay_active_conv', id);
        navigate('/messages');
      }
    })();
  }

  async function handleOrder(type) {
    try {
      if (!product) return;
      await createOrder({
        productId: product._id || product.id,
        productTitle: product.title || product.name,
        sellerId: product.sellerId || product.owner || (seller && seller.id) || null,
        type,
      });
      // show modal instead of alert
      setNotifyModal({ open: true, type, title: product.title || product.name });
      try {
        const key = `agapay_selected_order_${product._id || product.id}`;
        localStorage.setItem(key, type);
      } catch (e) {}
      setSelectedType(type);
      // Trigger reload for admin panels that poll for orders
      window.dispatchEvent(new Event('orders-changed'));
    } catch (e) {
      console.error('Order creation failed', e);
      alert('Failed to place order. Please sign in and try again.');
    }
  }

  const [notifyModal, setNotifyModal] = useState({ open: false, type: 'delivery', title: '' });

  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    if (!product) return;
    try {
      const key = `agapay_selected_order_${product._id || product.id}`;
      const v = localStorage.getItem(key);
      if (v === 'delivery' || v === 'pickup') setSelectedType(v);
    } catch (e) { }
  }, [product]);

  if(loading) return <FullScreenLoader />

  if(!product) return <div className="py-8 container mx-auto px-4">Product not found</div>

  // Build robust image list preferring Cloudinary imageUrl, then photo array/string
  const images = (() => {
    const list = [];
    if (product && product.imageUrl) list.push(product.imageUrl);
    if (product && Array.isArray(product.photo)) list.push(...product.photo);
    else if (product && product.photo) list.push(product.photo);
    // Dedupe and remove falsy
    return Array.from(new Set(list.filter(Boolean)));
  })();

  // Compute seller display name; avoid showing email
  const sellerDisplayName = (() => {
    if (seller) {
      const name = seller.username || seller.name || seller.displayName || seller.fullName;
      if (name) return name;
      if (seller.email && typeof seller.email === 'string') return seller.email.split('@')[0];
    }
    return product?.sellerName || 'Seller';
  })();

  return (
    <div className="py-4 md:py-8 container mx-auto px-2 md:px-4">
      <button type="button" onClick={goBackToMarketplace} className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 text-sm md:text-base" aria-label="Back to Marketplace">
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#3FD2A6"><path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z"/></svg>
        <span className="hidden sm:inline font-medium">Back to Marketplace</span>
      </button>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Main Image Section */}
        <div className="md:col-span-2">
          <div className="bg-gray-100 rounded overflow-hidden">
            {images.length > 1 ? (
              <div className="relative">
                <img src={images[index]} alt={product.title} className="w-full h-60 md:h-96 lg:h-[520px] object-cover" />
                <button onClick={()=>setIndex(i=> Math.max(0,i-1))} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded hover:bg-opacity-100 transition">‹</button>
                <button onClick={()=>setIndex(i=> Math.min(images.length-1,i+1))} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded hover:bg-opacity-100 transition">›</button>
                <div className="flex gap-2 p-2 overflow-x-auto bg-white border-t">
                  {images.map((im,i)=> <img key={i} src={im} alt={product.title} onClick={()=>setIndex(i)} className={`w-14 h-10 md:w-20 md:h-14 object-cover rounded cursor-pointer flex-shrink-0 transition ${i===index? 'ring-2 ring-teal-500' : ''}`} />)}
                </div>
              </div>
            ) : (
              <img src={images[0] || 'https://via.placeholder.com/800x600?text=No+Image'} alt={product.title} className="w-full h-60 md:h-96 lg:h-[520px] object-cover" />
            )}
          </div>

          {/* Product Info Section */}
          <div className="mt-4 md:mt-6">
            <h1 className="text-2xl md:text-3xl font-bold">{product.title || product.name || 'Product'}</h1>
            <div className="text-2xl md:text-3xl text-teal-600 font-bold mt-2">₱{product.price}</div>
            <div className="mt-3 text-sm md:text-base text-gray-700">{product.desc || product.description}</div>
            <div className="mt-2 text-xs md:text-sm text-gray-500 flex flex-wrap gap-2">
              <span>Category: {product.category}</span>
              {product.location && <span>· Location: {product.location}</span>}
            </div>
          </div>
        </div>

        {/* Seller Card & Actions Sidebar */}
        <aside className="md:col-span-1 space-y-4">
          {/* Seller Card */}
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center gap-3 mb-4">
              {seller?.profilePic ? (
                <img src={seller.profilePic} alt={seller ? `${sellerDisplayName} profile` : 'Seller profile'} className="w-12 h-12 bg-gray-200 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold flex-shrink-0">
                  {(sellerDisplayName || 'S').toString().trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold leading-tight truncate">{sellerDisplayName}</div>
              </div>
            </div>
            <button onClick={openChat} className="w-full p-2 bg-teal-600 text-white rounded font-medium hover:bg-teal-700 transition text-sm md:text-base">Message Seller</button>
            <button
              onClick={() => {
                const target = seller?.id || product?.sellerId || product?.owner;
                if (target) navigate(`/profile/${target}`);
              }}
              className="mt-2 w-full p-2 border rounded font-medium hover:bg-gray-50 transition text-sm md:text-base"
            >
              View seller profile
            </button>
          </div>

          {/* Order Options Card */}
          {(product.delivery || product.pickup) && (
            <div className="p-4 border rounded-lg bg-white">
              {selectedType && (
                <div className="mb-3 p-2 bg-teal-50 border border-teal-200 rounded text-sm text-teal-800 flex items-center gap-2">
                  <img src={selectedType === 'delivery' ? deliveryIcon : boxIcon} alt={selectedType} className="w-4 h-4 flex-shrink-0" />
                  <span>Selected: {selectedType === 'delivery' ? 'Delivery' : 'Pickup'}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {product.delivery && (
                  <button onClick={() => handleOrder('delivery')} className="w-full p-2 md:p-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition text-sm md:text-base inline-flex flex-col items-center justify-center gap-1">
                    <img src={deliveryIcon} alt="delivery" className="w-4 h-4" />
                    <span className="hidden sm:inline">Delivery</span>
                  </button>
                )}
                {product.pickup && (
                  <button onClick={() => handleOrder('pickup')} className="w-full p-2 md:p-3 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition text-sm md:text-base inline-flex flex-col items-center justify-center gap-1">
                    <img src={boxIcon} alt="pickup" className="w-4 h-4" />
                    <span className="hidden sm:inline">Pickup</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Location Card */}
          <div className="p-4 border rounded-lg bg-white">
            <h4 className="font-semibold mb-3 text-sm md:text-base">Item location</h4>
            {((typeof product.locationLat === 'number' && typeof product.locationLng === 'number') || geoCoords) ? (
              <div className="w-full rounded-lg overflow-hidden border cursor-pointer hover:shadow-lg transition" onClick={() => setMapOpen(true)}>
                <MapEmbed
                  lat={(typeof product.locationLat === 'number' && typeof product.locationLng === 'number') ? product.locationLat : geoCoords?.lat}
                  lng={(typeof product.locationLat === 'number' && typeof product.locationLng === 'number') ? product.locationLng : geoCoords?.lng}
                  height="150px"
                  showLink={false}
                />
              </div>
            ) : product.location ? (
              <div className="text-sm text-gray-700">
                <div className="break-words mb-2">{product.location}</div>
                {geocoding ? (
                  <span className="text-xs text-gray-500">(locating...)</span>
                ) : (
                  <div className="flex flex-col gap-2">
                    <a
                      className="inline-block px-3 py-2 bg-teal-50 text-teal-700 border rounded hover:bg-teal-100 transition text-xs md:text-sm text-center"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(product.location)}`}
                    >
                      Open in OSM
                    </a>
                    {geoCoords && (
                      <button onClick={() => setMapOpen(true)} className="px-3 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition text-xs md:text-sm">View on map</button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No location provided</div>
            )}
          </div>

          {/* Ratings Card */}
          <div className="p-4 border rounded-lg bg-white">
            <h3 className="font-semibold mb-3 text-sm md:text-base">Ratings</h3>
            <div className="space-y-2">
              {seller && (seller.ratings || []).length ? seller.ratings.map((r,i)=> (
                <div key={i} className="border-b pb-2 last:border-b-0">
                  <RatingStars value={r.ratingValue} />
                  <div className="text-xs md:text-sm text-gray-600 mt-1">{r.comment}</div>
                </div>
              )) : <div className="text-sm text-gray-500">No ratings yet</div>}
            </div>
          </div>
        </aside>

        {/* Fullscreen map modal */}
        {mapOpen && ((typeof product.locationLat === 'number' && typeof product.locationLng === 'number') || geoCoords) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl h-96 md:h-[88vh] overflow-hidden relative">
              <button className="absolute top-3 right-3 z-50 bg-white rounded-full p-2 shadow hover:bg-gray-100 transition" onClick={() => setMapOpen(false)} aria-label="Close map">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <MapEmbed
                lat={(typeof product.locationLat === 'number' && typeof product.locationLng === 'number') ? product.locationLat : geoCoords?.lat}
                lng={(typeof product.locationLat === 'number' && typeof product.locationLng === 'number') ? product.locationLng : geoCoords?.lng}
                height="100%"
              />
            </div>
          </div>
        )}

        {notifyModal.open && (
          <AdminNotifiedModal
            open={notifyModal.open}
            type={notifyModal.type}
            productTitle={notifyModal.title}
            productDescription={product.desc || product.description || ''}
            selectedType={notifyModal.type || selectedType}
            supportsDelivery={!!product.delivery}
            supportsPickup={!!product.pickup}
            onClose={() => { setNotifyModal({ open: false, type: 'delivery', title: '' }); }}
          />
        )}
      </div>

      {/* Recommended Products Section */}
      {recommended.length > 0 && (
        <div className="mt-8 md:mt-12">
          <h3 className="text-xl md:text-2xl font-semibold mb-4">Recommended for you</h3>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {recommended.map(r=> <ProductCard key={r._id || r.id} product={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
