import React, { useEffect, useMemo, useState } from 'react';
import authFetch from '../utils/authFetch';
import { auth } from '../firebase';
import { Link } from 'react-router-dom';
import ListNewItemModal from '../seller/ListNewItemModal';
import ListingsPanel from '../seller/ListingsPanel';
import MarkSoldModal from '../seller/MarkSoldModal';
import ImpactReportPanel from '../seller/ImpactReportPanel';
import FullScreenLoader from '../components/FullScreenLoader';
import Toast from '../components/Toast';


export default function SellerDashboard() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({ points: 0, active: 0, sold: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState('dashboard'); // dashboard, listings, orders, messages, analytics, impact
  const [loadingView, setLoadingView] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [busy, setBusy] = useState(false); // blocks actions and shows fullscreen loader during network ops
  const [markSoldOpen, setMarkSoldOpen] = useState(false);
  const [markSoldProduct, setMarkSoldProduct] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', variant: 'success' });
  const [myDropoffs, setMyDropoffs] = useState([]);
  // Track previous dropoff statuses to fire toasts only on genuine changes
  const prevDropoffStatuses = React.useRef({});

  // Compute nav button classes with a clear active highlight
  const navBtn = useMemo(() => (current) => {
    const base = 'w-full text-left flex items-center gap-2 font-medium px-3 py-2 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-teal-300';
    const inactive = 'text-gray-700 hover:text-teal-700 hover:bg-teal-50';
    const active = 'text-teal-800 bg-teal-100 border border-teal-300 shadow-sm';
    return `${base} ${view===current ? active : inactive}`;
  }, [view]);

  useEffect(() => {
    // Fetch user from localStorage and listings from backend (or Firestore fallback)
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(u);
    // Allow other pages to request a specific starting view via localStorage
    const targetView = localStorage.getItem('seller_dashboard_target_view');
    if (targetView) {
      setView(targetView);
      localStorage.removeItem('seller_dashboard_target_view');
    }
    async function loadListings(){
      try {
        // Firebase auth should already be ready via App.js, but double-check
        if (!auth.currentUser) {
          // Wait up to 3 seconds for Firebase to initialize
          await new Promise(resolve => {
            let done = false;
            const timeout = setTimeout(() => { if (!done) { done = true; resolve(); } }, 3000);
            const unsub = auth.onAuthStateChanged(user => {
              if (!done) { done = true; clearTimeout(timeout); unsub(); resolve(); }
            });
          });
        }

        // Try backend first (authenticated seller view)
        // mine=true returns ALL statuses (active, pending, sold) for this seller
        let res = await authFetch('/api/products/seller/mine?mine=true');
        if (res.ok) {
          const json = await res.json();
          const all = Array.isArray(json) ? json : (json.items || []);
          const myListings = all.filter(p => p.sellerId === u?.id || p.owner === u?.email || (auth.currentUser && p.sellerId === auth.currentUser.uid));
          setListings(myListings);
          return;
        }
        // If unauthorized (401) try forcing a token refresh and retry once
        if (res.status === 401 && auth.currentUser) {
          try {
            // Force refresh ID token
            await auth.currentUser.getIdToken(true);
            // Retry request
            res = await authFetch('/api/products/seller/mine?mine=true');
            if (res.ok) {
              const json = await res.json();
              const all = Array.isArray(json) ? json : (json.items || []);
              const myListings = all.filter(p => p.sellerId === u?.id || p.owner === u?.email || (auth.currentUser && p.sellerId === auth.currentUser.uid));
              setListings(myListings);
              return;
            }
          } catch (e) {
            console.warn('Retry after token refresh failed', e && e.message);
          }
        }

        // If unauthorized or other error, capture status and fall back to Firestore
        console.warn('SellerDashboard backend responded with', res.status);
      } catch (err) {
        console.warn('SellerDashboard backend fetch error', err && err.message);
      }

      // Firestore fallback: filter by localStorage user id OR firebase auth uid OR owner email
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const snap = await getDocs(collection(db, 'products'));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const myListings = all.filter(p => {
          const sellerMatch = (u && p.sellerId && (p.sellerId === u.id || p.sellerId === u.uid)) || (auth.currentUser && p.sellerId === auth.currentUser.uid);
          const ownerMatch = u && (p.owner === u?.email);
          return Boolean(sellerMatch || ownerMatch);
        });
        setListings(myListings);
      } catch (e) {
        console.warn('Failed to load products for seller dashboard', e);
        setListings([]);
      }
    }
    loadListings();
    // Load current points from user profile (backend preferred)
    (async () => {
      try {
        const me = JSON.parse(localStorage.getItem('user') || 'null');
        const id = (me && (me.id || me.uid)) || (auth.currentUser && auth.currentUser.uid) || null;
        if (id) {
          const res = await authFetch(`/api/users/${id}`);
          if (res.ok) {
            const u = await res.json();
            const pts = Number(u.totalPoints || u.sellerPoints || 0) || 0;
            setStats(prev => ({ ...prev, points: pts }));
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    // Listen for product updates from admin and refresh listings
    const onProductUpdated = () => { loadListings(); };
    window.addEventListener('product-updated', onProductUpdated);

    // Real-time listener: watch this seller's products in Firestore directly.
    // When admin approves/declines a drop-off and updates the product status,
    // this listener fires immediately so the seller sees the new status without refresh.
    let unsubProducts = null;
    let unsubDropoffs = null;
    let unsubUser = null;

    async function subscribeRealtime() {
      try {
        // Wait for Firebase Auth to finish initialising (same guard used in loadListings)
        let uid = auth.currentUser?.uid || null;
        if (!uid) {
          uid = await new Promise(resolve => {
            const timeout = setTimeout(() => resolve(null), 4000);
            const unsub = auth.onAuthStateChanged(user => {
              clearTimeout(timeout);
              unsub();
              resolve(user ? user.uid : null);
            });
          });
        }
        if (!uid) return; // not signed in — nothing to listen to

        const { collection, doc, query, where, onSnapshot } = await import('firebase/firestore');
        const { db: firestoreDb } = await import('../firebase');

        // ── User document listener — keeps points stat live ──
        // When the backend updates totalPoints (e.g. after drop-off completion),
        // this fires and updates the dashboard counter immediately.
        unsubUser = onSnapshot(doc(firestoreDb, 'users', uid), userSnap => {
          if (userSnap.exists()) {
            const ud = userSnap.data();
            const pts = Number(ud.totalPoints || ud.sellerPoints || 0) || 0;
            setStats(prev => ({ ...prev, points: pts }));
          }
        }, err => { console.warn('user doc listener error:', err.message); });

        // ── Products listener (no composite index needed: single where clause) ──
        const productsQ = query(
          collection(firestoreDb, 'products'),
          where('sellerId', '==', uid)
        );
        unsubProducts = onSnapshot(productsQ, snap => {
          const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setListings(items);
        }, err => { console.warn('products listener error:', err.message); });

        // ── Drop-offs listener (no orderBy to avoid composite index requirement) ──
        const dropoffsQ = query(
          collection(firestoreDb, 'dropoffs'),
          where('sellerId', '==', uid)
        );
        unsubDropoffs = onSnapshot(dropoffsQ, snap => {
          const items = snap.docs
            .map(d => ({
              id: d.id,
              ...d.data(),
              createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || null,
              updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || null,
            }))
            .sort((a, b) => (b.createdAt || '') < (a.createdAt || '') ? -1 : 1);
          setMyDropoffs(items);

          // Fire toast notifications when a drop-off status changes
          items.forEach(df => {
            const prev = prevDropoffStatuses.current[df.id];
            const curr = df.status;
            if (prev && prev !== curr) {
              if (curr === 'approved') {
                setToast({ open: true, message: `✅ Your drop-off for "${df.productTitle}" has been APPROVED! Please arrive on time.`, variant: 'success' });
              } else if (curr === 'completed') {
                const earned = Number(df.sellerPoints) || 0;
                const pts = earned > 0 ? ` You earned +${earned} pts!` : '';
                setToast({ open: true, message: `🏁 Drop-off for "${df.productTitle}" is complete.${pts}`, variant: 'success' });
                // Immediately bump the displayed points so the counter updates
                // even before the user document listener fires
                if (earned > 0) {
                  setStats(prev => ({ ...prev, points: prev.points + earned }));
                }
              } else if (curr === 'declined') {
                setToast({ open: true, message: `❌ Drop-off for "${df.productTitle}" was declined. Check your appointments for details.`, variant: 'error' });
              }
            }
            prevDropoffStatuses.current[df.id] = curr;
          });
        }, err => { console.warn('dropoffs listener error:', err.message); });
      } catch (e) {
        console.warn('subscribeRealtime error:', e.message);
      }
    }
    subscribeRealtime();

    return () => {
      window.removeEventListener('product-updated', onProductUpdated);
      if (unsubUser) unsubUser();
      if (unsubProducts) unsubProducts();
      if (unsubDropoffs) unsubDropoffs();
    };
  }, []);

  // Derive active/sold counts from listings whenever they change
  useEffect(() => {
    const norm = s => (s || '').toString().toLowerCase();
    const activeCount = listings.filter(p => norm(p.status) === 'active').length;
    const soldCount = listings.filter(p => norm(p.status) === 'sold').length;
    setStats(prev => ({ ...prev, active: activeCount, sold: soldCount }));
  }, [listings]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col py-6 px-4">
        <div className="text-2xl font-bold text-teal-600 mb-8">Seller Dashboard</div>
        <nav className="flex-1">
          <ul className="space-y-2">
            <li>
              <button
                className={`relative ${navBtn('dashboard')}`}
                aria-current={view==='dashboard' ? 'page' : undefined}
                onClick={() => { setLoadingView(true); setTimeout(()=>{ setView('dashboard'); setLoadingView(false); }, 200); }}
              >
                {view==='dashboard' && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-teal-500 rounded-r"></span>}
                <span className="w-5 text-lg">🏠</span>
                <span>Dashboard</span>
              </button>
            </li>
            <li>
              <button
                className={`relative ${navBtn('listings')}`}
                aria-current={view==='listings' ? 'page' : undefined}
                onClick={() => { setLoadingView(true); setTimeout(()=>{ setView('listings'); setLoadingView(false); }, 200); }}
              >
                {view==='listings' && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-teal-500 rounded-r"></span>}
                <span className="w-5 text-lg">📦</span>
                <span>My Listings</span>
              </button>
            </li>            <li>
              <button
                className={`relative ${navBtn('dropoffs')}`}
                aria-current={view==='dropoffs' ? 'page' : undefined}
                onClick={() => { setLoadingView(true); setTimeout(()=>{ setView('dropoffs'); setLoadingView(false); }, 200); }}
              >
                {view==='dropoffs' && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-teal-500 rounded-r"></span>}
                <span className="w-5 text-lg">🏪</span>
                <span>Drop-Off Appointments</span>
                {myDropoffs.some(d => d.status === 'approved') && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-green-500"></span>
                )}
              </button>
            </li>          </ul>
            <div className="mt-8">
            <div className="text-xs text-gray-500 mb-2">Business</div>
            <ul className="space-y-2">
              <li>
                <button
                  className={`relative ${navBtn('impact')}`}
                  aria-current={view==='impact' ? 'page' : undefined}
                  onClick={()=>{ setLoadingView(true); setTimeout(()=>{ setView('impact'); setLoadingView(false); }, 200); }}
                >
                  {view==='impact' && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-teal-500 rounded-r"></span>}
                  <span className="w-5 text-lg">🌱</span>
                  <span>Impact Report</span>
                </button>
              </li>
            </ul>
          </div>
          <div className="mt-8">
            <div className="text-xs text-gray-500 mb-2">Community</div>
            <ul className="space-y-2">
              <li>
                <Link to="/community" className="flex items-center gap-2 text-gray-700 hover:text-teal-700 hover:bg-teal-50 px-3 py-2 rounded-md">
                  <span className="w-5 text-lg">👥</span>
                  <span>Community</span>
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </aside>
      {/* Main Content */}
      <main className="flex-1 p-8">
        {(loadingView || busy) && <FullScreenLoader />}
        
        {/* debug panel removed */}
        {view === 'dashboard' && (
          <>
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Your Marketplace</h2>
              <p className="text-gray-600 mb-6">Manage your listings and track your impact</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow p-6 flex flex-col items-start">
                  <div className="text-xs text-gray-500 mb-1">Points</div>
                  <div className="text-2xl font-bold">{stats.points.toLocaleString()} pts</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6 flex flex-col items-start">
                  <div className="text-xs text-gray-500 mb-1">Active Listings</div>
                  <div className="text-2xl font-bold">{stats.active}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6 flex flex-col items-start">
                  <div className="text-xs text-gray-500 mb-1">Items Sold</div>
                  <div className="text-2xl font-bold">{stats.sold}</div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Your Listings</h3>
                <button className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 font-medium" onClick={()=>{setModalOpen(true); setEditItem(null);}}>+ List New Item</button>
              </div>
              {/* Active listings */}
              <ListingsPanel
                listings={listings.filter(p => (p.status || '').toLowerCase() !== 'sold')}
                disabled={busy}
                onEdit={item => { if (busy) return; setEditItem(item); setModalOpen(true); }}
                onDelete={id => {
                  if (busy) return;
                  setBusy(true);
                  setListings(listings => listings.filter(l => l.id !== id && l._id !== id));
                  (async()=>{
                    try {
                      const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
                      if (!res.ok) throw new Error('API delete failed');
                    } catch (err) {
                      try {
                        const { doc, deleteDoc } = await import('firebase/firestore');
                        const { db } = await import('../firebase');
                        await deleteDoc(doc(db, 'products', id));
                      } catch(e) {
                        console.warn('Failed to delete product on backend and Firestore', e);
                      }
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                onView={item => {
                  if (busy) return;
                  window.location.href = `/product/${item.id || item._id}`;
                }}
                onMarkSold={(item) => { if (busy) return; setMarkSoldProduct(item); setMarkSoldOpen(true); }}
                onStatusChange={(id, status) => {
                  if (busy) return;
                  setBusy(true);
                  setListings(prev => prev.map(p => (p.id === id || p._id === id) ? { ...p, status } : p));
                  (async()=>{
                    try {
                      const res = await authFetch(`/api/products/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status })
                      });
                      if (!res.ok) throw new Error('API update failed');
                    } catch (err) {
                      try {
                        const { doc, updateDoc } = await import('firebase/firestore');
                        const { db } = await import('../firebase');
                        await updateDoc(doc(db, 'products', id), { status });
                      } catch (e) {
                        console.warn('Failed to update product status on backend and Firestore', e);
                      }
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              />
              {/* Sold items section */}
              {listings.some(p => (p.status || '').toLowerCase() === 'sold') && (
                <>
                  <div className="mt-10 mb-4 border-t pt-6">
                    <h3 className="text-xl font-semibold text-gray-500">Sold Items</h3>
                    <p className="text-sm text-gray-400 mt-1">Items you have already sold</p>
                  </div>
                  <ListingsPanel
                    listings={listings.filter(p => (p.status || '').toLowerCase() === 'sold')}
                    disabled={busy}
                    onEdit={item => { if (busy) return; setEditItem(item); setModalOpen(true); }}
                    onDelete={id => {
                      if (busy) return;
                      setBusy(true);
                      setListings(listings => listings.filter(l => l.id !== id && l._id !== id));
                      (async()=>{
                        try {
                          const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
                          if (!res.ok) throw new Error('API delete failed');
                        } catch (err) {
                          try {
                            const { doc, deleteDoc } = await import('firebase/firestore');
                            const { db } = await import('../firebase');
                            await deleteDoc(doc(db, 'products', id));
                          } catch(e) {
                            console.warn('Failed to delete product on backend and Firestore', e);
                          }
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                    onView={item => {
                      if (busy) return;
                      window.location.href = `/product/${item.id || item._id}`;
                    }}
                    onMarkSold={null}
                    onStatusChange={null}
                  />
                </>
              )}
            </section>
          </>
        )}
        {view === 'listings' && (
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">My Listings</h3>
              <button className="bg-teal-700 text-white px-4 py-2 rounded hover:bg-teal-700 font-medium" onClick={()=>{setModalOpen(true); setEditItem(null);}}>+ List New Item</button>
            </div>
            {/* Active listings */}
            <ListingsPanel
              listings={listings.filter(p => (p.status || '').toLowerCase() !== 'sold')}
              disabled={busy}
              onEdit={item => { if (busy) return; setEditItem(item); setModalOpen(true); }}
              onDelete={id => {
                if (busy) return;
                setBusy(true);
                setListings(listings => listings.filter(l => l.id !== id && l._id !== id));
                (async()=>{
                  try {
                    const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error('API delete failed');
                  } catch (err) {
                    try {
                      const { doc, deleteDoc } = await import('firebase/firestore');
                      const { db } = await import('../firebase');
                      await deleteDoc(doc(db, 'products', id));
                    } catch(e) {
                      console.warn('Failed to delete product on backend and Firestore', e);
                    }
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              onView={item => {
                if (busy) return;
                window.location.href = `/product/${item.id || item._id}`;
              }}
              onMarkSold={(item) => { if (busy) return; setMarkSoldProduct(item); setMarkSoldOpen(true); }}
              onStatusChange={(id, status) => {
                if (busy) return;
                setBusy(true);
                setListings(prev => prev.map(p => (p.id === id || p._id === id) ? { ...p, status } : p));
                (async()=>{
                  try {
                    const res = await authFetch(`/api/products/${id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status })
                    });
                    if (!res.ok) throw new Error('API update failed');
                  } catch (err) {
                    try {
                      const { doc, updateDoc } = await import('firebase/firestore');
                      const { db } = await import('../firebase');
                      await updateDoc(doc(db, 'products', id), { status });
                    } catch (e) {
                      console.warn('Failed to update product status on backend and Firestore', e);
                    }
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
            {/* Sold items section */}
            {listings.some(p => (p.status || '').toLowerCase() === 'sold') && (
              <>
                <div className="mt-10 mb-4 border-t pt-6">
                  <h3 className="text-xl font-semibold text-gray-500">Sold Items</h3>
                  <p className="text-sm text-gray-400 mt-1">Items you have already sold</p>
                </div>
                <ListingsPanel
                  listings={listings.filter(p => (p.status || '').toLowerCase() === 'sold')}
                  disabled={busy}
                  onEdit={item => { if (busy) return; setEditItem(item); setModalOpen(true); }}
                  onDelete={id => {
                    if (busy) return;
                    setBusy(true);
                    setListings(listings => listings.filter(l => l.id !== id && l._id !== id));
                    (async()=>{
                      try {
                        const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error('API delete failed');
                      } catch (err) {
                        try {
                          const { doc, deleteDoc } = await import('firebase/firestore');
                          const { db } = await import('../firebase');
                          await deleteDoc(doc(db, 'products', id));
                        } catch(e) {
                          console.warn('Failed to delete product on backend and Firestore', e);
                        }
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                  onView={item => {
                    if (busy) return;
                    window.location.href = `/product/${item.id || item._id}`;
                  }}
                  onMarkSold={null}
                  onStatusChange={null}
                />
              </>
            )}
          </section>
        )}
  {/* Analytics panel removed per request */}
        {view === 'dropoffs' && (
          <section>
            <h3 className="text-xl font-semibold mb-6">Drop-Off Appointments</h3>
            {myDropoffs.length === 0 ? (
              <div className="text-gray-500 bg-white rounded-lg p-8 text-center shadow">No drop-off appointments yet.</div>
            ) : (
              <div className="space-y-5">
                {myDropoffs.map(df => {
                  const s = (df.status || 'pending').toLowerCase();

                  // Step progress: 0=submitted, 1=approved, 2=dropped off/completed, declined=error
                  const stepIndex = s === 'completed' ? 3 : s === 'approved' ? 1 : s === 'declined' ? -1 : 0;
                  const steps = ['Submitted', 'Approved', 'Drop Off', 'Completed'];

                  const statusConfig = {
                    pending: {
                      border: 'border-yellow-300',
                      badge: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
                      label: 'Pending Review',
                      icon: '⏳',
                      message: 'Your appointment has been submitted. The admin will review and approve it soon.',
                    },
                    approved: {
                      border: 'border-green-300',
                      badge: 'bg-green-100 text-green-800 border border-green-300',
                      label: 'Approved',
                      icon: '✅',
                      message: df.dropoffTime
                        ? `Your appointment is confirmed! Please bring the item to the junkshop on ${df.dropoffDate || 'the scheduled date'} at ${df.dropoffTime}.`
                        : `Your appointment is confirmed! Please bring the item to the junkshop on ${df.dropoffDate || 'the scheduled date'}.`,
                    },
                    declined: {
                      border: 'border-red-300',
                      badge: 'bg-red-100 text-red-800 border border-red-300',
                      label: 'Declined',
                      icon: '❌',
                      message: 'Your drop-off request was declined. See the reason below.',
                    },
                    completed: {
                      border: 'border-blue-300',
                      badge: 'bg-blue-100 text-blue-800 border border-blue-300',
                      label: 'Completed — SOLD',
                      icon: '🏁',
                      message: df.sellerPoints
                        ? `Item received and sold! You earned +${df.sellerPoints} points for this drop-off.`
                        : 'Item received and marked as sold. Thank you!',
                    },
                  };
                  const cfg = statusConfig[s] || statusConfig.pending;

                  return (
                    <div key={df.id} className={`bg-white rounded-xl shadow border-l-4 ${cfg.border} overflow-hidden`}>
                      <div className="flex flex-col sm:flex-row gap-4 p-5">

                        {/* Product image */}
                        {df.productImage && (
                          <div className="relative flex-shrink-0 w-full sm:w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
                            <img src={df.productImage} alt={df.productTitle} className="w-full h-full object-cover" />
                            {s === 'completed' && (
                              <div className="absolute inset-0 bg-blue-600 bg-opacity-75 flex items-center justify-center">
                                <span className="text-white font-bold text-sm tracking-wide">SOLD</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          {/* Title row */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-semibold text-gray-900 truncate">{df.productTitle || 'Product'}</span>
                            <span className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                          </div>

                          {/* Date / time */}
                          <div className="text-sm text-gray-500 mb-2">
                            <span className="mr-3">📅 {df.dropoffDate || '—'}</span>
                            {df.dropoffTime && <span className="mr-3">⏰ {df.dropoffTime}</span>}
                          </div>

                          {/* Step progress bar */}
                          {s !== 'declined' && (
                            <div className="flex items-center gap-0 mb-3">
                              {steps.map((step, i) => {
                                const done = i < stepIndex + 1;
                                const active = i === stepIndex;
                                return (
                                  <React.Fragment key={step}>
                                    <div className="flex flex-col items-center">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                                        ${done
                                          ? 'bg-teal-600 border-teal-600 text-white'
                                          : active
                                            ? 'bg-teal-100 border-teal-500 text-teal-700'
                                            : 'bg-gray-100 border-gray-300 text-gray-400'
                                        }`}>
                                        {done ? '✓' : i + 1}
                                      </div>
                                      <span className={`text-[10px] mt-0.5 font-medium ${done ? 'text-teal-700' : 'text-gray-400'}`}>{step}</span>
                                    </div>
                                    {i < steps.length - 1 && (
                                      <div className={`flex-1 h-0.5 mb-3 mx-1 ${i < stepIndex ? 'bg-teal-500' : 'bg-gray-200'}`} />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          )}

                          {/* Status message */}
                          <div className={`text-sm rounded-lg px-3 py-2 ${
                            s === 'approved' ? 'bg-green-50 text-green-800' :
                            s === 'completed' ? 'bg-blue-50 text-blue-800' :
                            s === 'declined' ? 'bg-red-50 text-red-800' :
                            'bg-yellow-50 text-yellow-800'
                          }`}>
                            {cfg.message}
                          </div>

                          {/* Extra details */}
                          {s === 'approved' && df.adminNotes && (
                            <div className="mt-2 text-xs text-green-700 bg-green-50 rounded px-2 py-1 border border-green-200">
                              📋 Admin note: {df.adminNotes}
                            </div>
                          )}
                          {s === 'declined' && (
                            <div className="mt-2 text-xs text-red-700 bg-red-50 rounded px-2 py-1 border border-red-200">
                              Reason: {df.declineReason || df.adminNotes || 'Not specified'}
                            </div>
                          )}
                          {df.notes && s === 'pending' && (
                            <div className="mt-2 text-xs text-gray-600">📝 Your notes: {df.notes}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
        {view === 'impact' && <ImpactReportPanel />}
        <MarkSoldModal
          open={markSoldOpen}
          product={markSoldProduct}
          onClose={()=>{ setMarkSoldOpen(false); setMarkSoldProduct(null); }}
          onMarked={({ productId, sellerPoints, alreadyAwarded, badgeNotifications }) => {
            // Update product status to sold and bump points
            setListings(prev => prev.map(p => (p.id === productId || p._id === productId) ? { ...p, status: 'sold' } : p));
            if (!alreadyAwarded) {
              setStats(prev => ({ ...prev, points: (Number(prev.points)||0) + (Number(sellerPoints)||0) }));
            }
            const baseMessage = alreadyAwarded ? 'Sale recorded. Points already awarded previously.' : `Sale recorded. You earned +${sellerPoints} pts!`;
            const sellerBadgeNotes = Array.isArray(badgeNotifications?.seller) ? badgeNotifications.seller : [];
            const badgeMessage = sellerBadgeNotes.length
              ? `Unlocked ${sellerBadgeNotes.map(note => note.label || 'a badge').join(', ')} badge${sellerBadgeNotes.length > 1 ? 's' : ''}!`
              : '';
            setToast({ open: true, message: [baseMessage, badgeMessage].filter(Boolean).join(' '), variant: 'success' });
          }}
        />
        <Toast open={toast.open} message={toast.message} variant={toast.variant}
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
        />
        <ListNewItemModal
          open={modalOpen}
          onClose={()=>{setModalOpen(false); setEditItem(null);}}
          editItem={editItem}
          onUpdate={(updated)=>{
            setListings(prev => prev.map(p => (p.id === updated.id || p._id === updated.id) ? { ...p, ...updated } : p));
          }}
          onAdd={item => {
            const newId = item.id || item._id || Date.now();
            setListings(prev => {
              // onSnapshot may have already added this item — skip if present to avoid duplicate keys
              if (prev.some(p => p.id === newId || p._id === newId)) return prev;
              const newItem = { ...item, id: newId, _id: newId, sellerId: user?.id, status: 'pending' };
              return [...prev, newItem];
            });
          }}
        />
      </main>
    </div>
  );
}
