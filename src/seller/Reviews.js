import React, { useEffect, useMemo, useState } from 'react';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Reviews() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]); // list of sold items with buyer info
  const [ratings, setRatings] = useState({}); // buyerId -> { rating, comment }

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

      // Firestore fallback: find seller's sold products and mock buyer (to be replaced with real order data)
      try {
  const { db } = await import('../firebase');
  const { collection, getDocs, query, where } = await import('firebase/firestore');
        const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
        if (!uid) { setOrders([]); setLoading(false); return; }
        const q = query(collection(db, 'products'), where('sellerId', '==', uid));
        const snap = await getDocs(q);
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Filter to sold/completed/delivered
        const sold = all.filter(p => isSoldStatus(p.status));
        // Map to order-like objects; replace this with real buyer data when your Orders schema exists
        const enriched = sold.map(p => ({
          id: p.id,
          productName: p.title || p.name || p.productName || 'Item',
          buyerId: p.buyerId || null,
          buyerName: p.buyerName || (p.buyerEmail ? p.buyerEmail.split('@')[0] : null) || 'Buyer',
          soldAt: p.soldAt || p.updatedAt || p.createdAt || Date.now(),
        }));
        if (!cancelled) setOrders(enriched);
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
    const data = ratings[order.buyerId || order.id];
    if (!data || !data.rating) return;
    try {
      const { db } = await import('../firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const review = {
        sellerId: auth.currentUser.uid,
        buyerId: order.buyerId || null,
        productId: order.id,
        rating: Number(data.rating),
        comment: data.comment || '',
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'reviews'), review);
      // Clear local input
      setRatings(prev => ({ ...prev, [order.buyerId || order.id]: { rating: '', comment: '' } }));
      alert('Review submitted');
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
          <h3 className="text-xl font-bold mb-4">Buyer Reviews</h3>
          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="text-gray-500">No sold items yet.</div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="p-4 border rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <div className="text-sm text-gray-500">Item</div>
                      <div className="font-semibold">{order.productName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Buyer</div>
                      <div className="font-medium">{order.buyerName}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Rating</label>
                      <select
                        className="border rounded px-2 py-1 w-full"
                        value={(ratings[order.buyerId || order.id]?.rating) || ''}
                        onChange={e => setRatings(prev => ({ ...prev, [order.buyerId || order.id]: { ...(prev[order.buyerId || order.id] || {}), rating: e.target.value } }))}
                      >
                        <option value="">Select</option>
                        {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} ★</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Comment (optional)</label>
                      <input
                        className="border rounded px-2 py-1 w-full"
                        placeholder="Leave a note for the buyer…"
                        value={(ratings[order.buyerId || order.id]?.comment) || ''}
                        onChange={e => setRatings(prev => ({ ...prev, [order.buyerId || order.id]: { ...(prev[order.buyerId || order.id] || {}), comment: e.target.value } }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      className="px-4 py-2 bg-teal-600 text-white rounded"
                      onClick={() => submitReview(order)}
                      disabled={!ratings[order.buyerId || order.id]?.rating}
                    >Submit Review</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
