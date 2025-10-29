import React, { useEffect, useState } from 'react'
import FullScreenLoader from '../components/FullScreenLoader'
import { useParams, useNavigate } from 'react-router-dom'
import RatingStars from '../components/RatingStars'
import ProductCard from "../components/ProductCard";

export default function ProductDetail(){
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [seller, setSeller] = useState(null)
  // ...existing code...
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const [recommended, setRecommended] = useState([])

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
            if (json && json.sellerId) {
              try {
                const r2 = await fetch(`/api/users/${json.sellerId}`);
                if (r2.ok) setSeller(await r2.json());
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
        if (res.ok) products = await res.json();
        else throw new Error('API failed');
        setRecommended((products || []).filter(p=> p._id !== product._id && p.category === product.category).slice(0,4))
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
  const { auth } = await import('../firebase');
  const me = JSON.parse(localStorage.getItem('user') || 'null');
        const productId = product ? (product._id || product.id) : null;
        const otherId = (seller && seller.id) ? seller.id : (productId ? `seller_${productId}` : 'unknown');
        const svc = await import('../firebaseMessageService');
        // Prefer backend start API so the collection/doc is created even if it was deleted previously
        const convId = await svc.startConversation(otherId, { productId, productName: product ? product.title : null, productImage: Array.isArray(product?.photo) ? product.photo[0] : product?.photo || null });
        if (convId && typeof convId === 'string') localStorage.setItem('agapay_active_conv', convId);
        else localStorage.setItem('agapay_active_conv', productId || id);
        navigate('/messages');
      } catch (e) {
        localStorage.setItem('agapay_active_conv', id);
        navigate('/messages');
      }
    })();
  }

  if(loading) return <FullScreenLoader />

  if(!product) return <div className="py-8 container mx-auto px-4">Product not found</div>

  const images = Array.isArray(product.photo) ? product.photo : (product.photo ? [product.photo] : [])

  return (
    <div className="py-8 container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
  <div className="md:col-span-2">
        <div className="bg-gray-100 rounded overflow-hidden">
          {images.length > 1 ? (
            <div className="relative">
              <img src={images[index]} alt={product.title} className="w-full h-64 sm:h-96 object-cover" />
              <button onClick={()=>setIndex(i=> Math.max(0,i-1))} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded">‹</button>
              <button onClick={()=>setIndex(i=> Math.min(images.length-1,i+1))} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded">›</button>
              <div className="flex gap-2 p-2 overflow-auto bg-white">
                {images.map((im,i)=> <img key={i} src={im} alt={product.title} onClick={()=>setIndex(i)} className={`w-12 h-8 sm:w-20 sm:h-14 object-cover rounded cursor-pointer ${i===index? 'ring-2 ring-teal-500' : ''}`} />)}
              </div>
            </div>
          ) : (
            <img src={images[0] || ''} alt={product.title} className="w-full h-64 sm:h-96 object-cover" />
          )}
        </div>
        <h1 className="text-2xl font-bold mt-4">{product.title}</h1>
        <div className="text-xl text-teal-600">\u20b1{product.price}</div>
  <div className="mt-3 text-gray-700">{product.desc}</div>
  <div className="mt-2 text-sm text-gray-500">Category: {product.category} \u00b7 Location: {product.location}</div>
      </div>
      <aside className="md:col-span-1">
        <div className="p-4 border rounded">
          <div className="flex items-center gap-3">
            <img src={seller?.profilePic || ''} alt={seller ? `${seller.username} profile` : 'Seller profile'} className="w-12 h-12 bg-gray-200 rounded-full object-cover" />
            <div>
              <div className="font-semibold">{seller ? seller.username : 'Seller'}</div>
              <div className="text-xs text-gray-500">{seller ? seller.email : ''}</div>
            </div>
          </div>
          {/* View Item removed on Product page as requested */}
          <button onClick={openChat} className="mt-3 w-full p-2 bg-teal-600 text-white rounded">Message Seller</button>
          <button
            onClick={() => {
              const target = seller?.id || product?.sellerId || product?.owner;
              if (target) navigate(`/profile/${target}`);
            }}
            className="mt-2 w-full p-2 border rounded"
          >
            View seller profile
          </button>
        </div>

        <div className="mt-4 p-4 border rounded">
          <h3 className="font-semibold">Ratings</h3>
          <div className="mt-2">
            {seller && (seller.ratings || []).length ? seller.ratings.map((r,i)=> (
              <div key={i} className="border-b py-2">
                <RatingStars value={r.ratingValue} />
                <div className="text-sm text-gray-600">{r.comment}</div>
              </div>
            )) : <div className="text-sm text-gray-500">No ratings yet</div>}
          </div>

          <div className="mt-3">
            {/* Rating UI will be shown only after product arrival logic is implemented. */}
          </div>
        </div>
      </aside>

      {recommended.length > 0 && (
        <div className="md:col-span-3 mt-6">
          <h3 className="font-semibold">Recommended for you</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {recommended.map(r=> <ProductCard key={r._id || r.id} product={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
