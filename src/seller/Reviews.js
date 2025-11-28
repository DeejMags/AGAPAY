import React, { useEffect, useMemo, useState } from 'react';
import { auth } from '../firebase';
import authFetch from '../utils/authFetch';
import { useNavigate } from 'react-router-dom';

export default function Reviews() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]); // list of purchased items with seller info
  const [ratings, setRatings] = useState({}); // productId -> { rating, comment }
  const [myReviews, setMyReviews] = useState([]); // existing reviews authored by me (as buyer)
  const [reviewMap, setReviewMap] = useState({}); // key: `${productId}_${sellerId}` => review
  const [sellers, setSellers] = useState({}); // sellerId -> { name, email }

  // Sidebar nav button classes (matches SellerDashboard look & feel)
  const navBtn = useMemo(() => (activeKey, currentKey = 'reviews') => {
    const base = 'w-full text-left flex items-center gap-2 font-medium px-3 py-2 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-teal-300';
    const inactive = 'text-gray-700 hover:text-teal-700 hover:bg-teal-50';
    const active = 'text-teal-800 bg-teal-100 border border-teal-300 shadow-sm';
    return `${base} ${currentKey===activeKey ? active : inactive}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Ensure auth ready
        if (!auth.currentUser) {
          await new Promise(resolve => {
            const t = setTimeout(resolve, 1500);
            const unsub = auth.onAuthStateChanged(() => { clearTimeout(t); unsub(); resolve(); });
          });
        }
        // Try backend endpoint if available in future; for now pull from products/transactions in Firestore fallback below
      } catch (e) {}

    // Firestore: find buyer's purchased products and load existing reviews
      try {
  const { db } = await import('../firebase');
  const { collection, getDocs, query, where } = await import('firebase/firestore');
        const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
        if (!uid) { setOrders([]); setLoading(false); return; }
        const q = query(collection(db, 'products'), where('buyerId', '==', uid));
        const snap = await getDocs(q);
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Filter to sold/completed/delivered
        const sold = all.filter(p => isSoldStatus(p.status));
        // Map to order-like objects; include seller information
        const enriched = sold.map(p => ({
          id: p.id,
          productName: p.title || p.name || p.productName || 'Item',
          sellerId: p.sellerId || null,
          sellerName: p.sellerName || (p.owner ? String(p.owner).split('@')[0] : null) || 'Seller',
          soldAt: p.soldAt || p.updatedAt || p.createdAt || Date.now(),
        }));
        if (!cancelled) setOrders(enriched);

        // Load my existing reviews (as buyer)
        const r1 = await getDocs(query(collection(db, 'reviews'), where('buyerId', '==', uid)));
        const r2 = await getDocs(query(collection(db, 'reviews'), where('reviewerId', '==', uid)));
        const combined = [...r1.docs, ...r2.docs].reduce((arr, d) => {
          // de-dupe by doc id
          if (!arr.some(x => x.id === d.id)) arr.push(d);
          return arr;
        }, []);
        const reviews = combined.map(d => ({ id: d.id, ...d.data() }));
        if (!cancelled) setMyReviews(reviews);
        // Build quick lookup map
        const map = {};
        for (const r of reviews) {
          const productId = r.productId || r.itemId;
          const sellerId = r.sellerId || r.revieweeId;
          if (productId && sellerId) map[`${productId}_${sellerId}`] = r;
        }
        if (!cancelled) setReviewMap(map);

        // Fetch seller profiles (from orders and reviews) to show real names
        const sellerIds = Array.from(new Set([
          ...enriched.map(o => o.sellerId).filter(Boolean),
          ...reviews.map(r => r.sellerId || r.revieweeId).filter(Boolean)
        ]));
        if (sellerIds.length > 0) {
          const results = {};
          await Promise.all(sellerIds.map(async (id) => {
            // Try backend profile lookup first
            try {
              const res = await authFetch(`/api/users/${id}`);
              if (res && res.ok) {
                const u = await res.json();
                const name = u.name || u.displayName || u.username || u.fullName || (u.email ? u.email.split('@')[0] : id);
                results[id] = { name, email: u.email || null };
                return;
              }
            } catch (e) { /* fall through to Firestore */ }
            // Firestore fallback
            try {
              const { doc, getDoc } = await import('firebase/firestore');
              const { db } = await import('../firebase');
              const ref = doc(db, 'users', id);
              const usnap = await getDoc(ref);
              if (usnap.exists()) {
                const u = usnap.data() || {};
                const name = u.name || u.displayName || u.username || (u.email ? u.email.split('@')[0] : id);
                results[id] = { name, email: u.email || null };
              } else {
                results[id] = { name: id, email: null };
              }
            } catch (e) {
              results[id] = { name: id, email: null };
            }
          }));
          if (!cancelled) setSellers(results);
        }
      } catch (e) {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function isSoldStatus(status) {
    if (!status) return false;
    const s = String(status).toLowerCase();
    return s === 'sold' || s === 'completed' || s === 'delivered';
  }

  async function submitReview(order) {
    const data = ratings[order.id];
    if (!data || !data.rating) return;
    try {
      const { db } = await import('../firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const review = {
        sellerId: order.sellerId || null,
        buyerId: auth.currentUser.uid,
        productId: order.id,
        rating: Number(data.rating),
        comment: data.comment || '',
        createdAt: serverTimestamp(),
        // canonical fields too
        reviewerId: auth.currentUser.uid,
        revieweeId: order.sellerId || null,
      };
      const docRef = await addDoc(collection(db, 'reviews'), review);
      // Clear local input
      setRatings(prev => ({ ...prev, [order.id]: { rating: '', comment: '' } }));
      const newRev = { id: docRef.id, ...review };
      setMyReviews(prev => [newRev, ...prev]);
      setReviewMap(prev => ({ ...prev, [`${order.id}_${order.sellerId}`]: newRev }));
    } catch (e) {
      console.error('Failed to submit review', e);
      alert('Failed to submit review');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar (reused look from SellerDashboard) */}
      <aside className="w-64 bg-white border-r flex flex-col py-6 px-4">
        <div className="text-2xl font-bold text-teal-600 mb-8">Seller Dashboard</div>
        <nav className="flex-1">
          <ul className="space-y-2">
            <li>
              <button
                className={`relative ${navBtn('dashboard')}`}
                aria-current={undefined}
                onClick={() => { /* default dashboard view */ navigate('/dashboard'); }}
              >
                <span className="w-5 text-lg">🏠</span>
                <span>Dashboard</span>
              </button>
            </li>
            <li>
              <button
                className={`relative ${navBtn('listings')}`}
                aria-current={undefined}
                onClick={() => { localStorage.setItem('seller_dashboard_target_view', 'listings'); navigate('/dashboard'); }}
              >
                <span className="w-5 text-lg">📦</span>
                <span>My Listings</span>
              </button>
            </li>
          </ul>
          <div className="mt-8">
            <div className="text-xs text-gray-500 mb-2">Business</div>
            <ul className="space-y-2">
              <li>
                <button
                  className={`relative ${navBtn('impact')}`}
                  onClick={() => { localStorage.setItem('seller_dashboard_target_view', 'impact'); navigate('/dashboard'); }}
                >
                  <span className="w-5 text-lg">🌱</span>
                  <span>Impact Report</span>
                </button>
              </li>
              <li>
                <button
                  className={`relative ${navBtn('reviews', 'reviews')}`}
                  aria-current={'page'}
                >
                  {/* left accent notch for active */}
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-teal-500 rounded-r"></span>
                  <span className="w-5 text-lg">⭐</span>
                  <span>Reviews</span>
                </button>
              </li>
            </ul>
          </div>
          <div className="mt-8">
            <div className="text-xs text-gray-500 mb-2">Community</div>
            <ul className="space-y-2">
              <li>
                <button
                  className={`relative ${navBtn('community')}`}
                  onClick={() => { navigate('/community'); }}
                >
                  {/* accent notch will render on Community page; leave structure ready */}
                  <span className="w-5 text-lg">👥</span>
                  <span>Community</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="text-xl font-bold mb-4">Review Your Purchases</h3>
          {/* Past reviews */}
          {myReviews.length > 0 && (
            <div className="mb-8">
              <div className="text-sm font-semibold text-gray-700 mb-2">Your Past Reviews (as Buyer)</div>
              <div className="grid gap-3">
                {myReviews.slice(0, 20).map(r => (
                  <div key={r.id} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="font-medium">{(orders.find(o => o.id === r.productId)?.productName) || 'Item'}</span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-gray-600">Seller: {(() => {
                          const sid = r.revieweeId || r.sellerId;
                          if (sid && sellers[sid]?.name) return sellers[sid].name;
                          const o = orders.find(o => o.id === r.productId);
                          return (o && (sellers[o.sellerId]?.name || o.sellerName)) || sid || '—';
                        })()}</span>
                      </div>
                      <div className="text-amber-600 font-semibold">{Number(r.rating) || 0} ★</div>
                    </div>
                    {r.comment && <div className="text-sm text-gray-700 mt-1">{r.comment}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="text-gray-500">No purchases yet.</div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => {
                const key = `${order.id}_${order.sellerId}`;
                const existing = reviewMap[key];
                return (
                <div key={order.id} className="p-4 border rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <div className="text-sm text-gray-500">Item</div>
                      <div className="font-semibold">{order.productName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Seller</div>
                      <div className="font-medium">{sellers[order.sellerId]?.name || order.sellerName}</div>
                    </div>
                  </div>
                  {!existing ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Rating</label>
                          <select
                            className="border rounded px-2 py-1 w-full"
                            value={(ratings[order.id]?.rating) || ''}
                            onChange={e => setRatings(prev => ({ ...prev, [order.id]: { ...(prev[order.id] || {}), rating: e.target.value } }))}
                          >
                            <option value="">Select</option>
                            {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} ★</option>)}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-gray-600 mb-1">Comment (optional)</label>
                          <input
                            className="border rounded px-2 py-1 w-full"
                            placeholder="Share your experience with the seller…"
                            value={(ratings[order.id]?.comment) || ''}
                            onChange={e => setRatings(prev => ({ ...prev, [order.id]: { ...(prev[order.id] || {}), comment: e.target.value } }))}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          className="px-4 py-2 bg-teal-600 text-white rounded"
                          onClick={() => submitReview(order)}
                          disabled={!ratings[order.id]?.rating}
                        >Submit Review</button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded p-3 flex items-center justify-between">
                      <div className="text-sm text-emerald-800">
                        <span className="font-medium">Already reviewed</span>
                        {existing.comment ? <span className="ml-2">— {existing.comment}</span> : null}
                      </div>
                      <div className="text-amber-600 font-semibold">{Number(existing.rating) || 0} ★</div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}