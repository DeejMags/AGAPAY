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
    // Allow other pages (e.g., Reviews) to request a specific starting view
    const targetView = localStorage.getItem('seller_dashboard_target_view');
    if (targetView) {
      setView(targetView);
      localStorage.removeItem('seller_dashboard_target_view');
    }
    async function loadListings(){
      try {
        // Wait briefly for Firebase auth to initialize so authFetch can obtain a token
        if (!auth.currentUser) {
          await new Promise(resolve => {
            const timeout = setTimeout(() => { resolve(); }, 2500);
            const unsub = auth.onAuthStateChanged(user => { clearTimeout(timeout); unsub(); resolve(); });
          });
        }

        // Try backend first (authenticated seller view)
        let res = await authFetch('/api/products?mine=true');
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
            res = await authFetch('/api/products?mine=true');
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
    return () => { window.removeEventListener('product-updated', onProductUpdated); };
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
            </li>
          </ul>
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
              <li>
                <Link to="/reviews" className="flex items-center gap-2 text-gray-700 hover:text-teal-700 hover:bg-teal-50 px-3 py-2 rounded-md">
                  <span className="w-5 text-lg">⭐</span>
                  <span>Reviews</span>
                </Link>
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
              {/* Available listings (not sold) */}
              <ListingsPanel
                listings={listings.filter(p => (p.status || '').toLowerCase() !== 'sold')}
                disabled={busy}
                onEdit={item => { if (busy) return; setEditItem(item); setModalOpen(true); }}
                onDelete={id => {
                  if (busy) return;
                  setBusy(true);
                  // Remove from local listings and request backend deletion (fallback to Firestore)
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
                  // Navigate to product detail page
                  window.location.href = `/product/${item.id || item._id}`;
                }}
                onMarkSold={(item) => { if (busy) return; setMarkSoldProduct(item); setMarkSoldOpen(true); }}
                onStatusChange={(id, status) => {
                  if (busy) return;
                  setBusy(true);
                  // Optimistic UI update
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
                      // Firestore fallback
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
              {/* Sold items grid */}
              {listings.some(p => (p.status || '').toLowerCase() === 'sold') && (
                <>
                  <h4 className="text-lg font-semibold mt-8 mb-3">Sold Items</h4>
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
                    onView={item => { if (busy) return; window.location.href = `/product/${item.id || item._id}`; }}
                    onMarkSold={(item) => { if (busy) return; setMarkSoldProduct(item); setMarkSoldOpen(true); }}
                    onStatusChange={(id, status) => {
                      if (busy) return;
                      setBusy(true);
                      setListings(prev => prev.map(p => (p.id === id || p._id === id) ? { ...p, status } : p));
                      (async()=>{
                        try {
                          const res = await authFetch(`/api/products/${id}`, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
                          });
                          if (!res.ok) throw new Error('API update failed');
                        } catch (err) {
                          try {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            const { db } = await import('../firebase');
                            await updateDoc(doc(db, 'products', id), { status });
                          } catch (e) { console.warn('Failed to update product status on backend and Firestore', e); }
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
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
            {/* Available listings (not sold) */}
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
            {/* Sold items grid */}
            {listings.some(p => (p.status || '').toLowerCase() === 'sold') && (
              <>
                <h4 className="text-lg font-semibold mt-8 mb-3">Sold Items</h4>
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
                        } catch(e) { console.warn('Failed to delete product on backend and Firestore', e); }
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                  onView={item => { if (busy) return; window.location.href = `/product/${item.id || item._id}`; }}
                  onStatusChange={(id, status) => {
                    if (busy) return;
                    setBusy(true);
                    setListings(prev => prev.map(p => (p.id === id || p._id === id) ? { ...p, status } : p));
                    (async()=>{
                      try {
                        const res = await authFetch(`/api/products/${id}`, {
                          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
                        });
                        if (!res.ok) throw new Error('API update failed');
                      } catch (err) {
                        try {
                          const { doc, updateDoc } = await import('firebase/firestore');
                          const { db } = await import('../firebase');
                          await updateDoc(doc(db, 'products', id), { status });
                        } catch (e) { console.warn('Failed to update product status on backend and Firestore', e); }
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                />
              </>
            )}
          </section>
        )}
  {/* Analytics panel removed per request */}
        {view === 'impact' && <ImpactReportPanel />}
        <MarkSoldModal
          open={markSoldOpen}
          product={markSoldProduct}
          onClose={()=>{ setMarkSoldOpen(false); setMarkSoldProduct(null); }}
          onMarked={({ productId, sellerPoints, alreadyAwarded, badgeNotifications }) => {
            // update product status to sold and bump points
            setListings(prev => prev.map(p => (p.id === productId || p._id === productId) ? { ...p, status: 'sold' } : p));
            if (!alreadyAwarded) {
              setStats(prev => ({ ...prev, points: (Number(prev.points)||0) + (Number(sellerPoints)||0) }));
            }
            const baseMessage = alreadyAwarded ? 'Sale recorded. Points already awarded previously.' : `Sale recorded. You earned +${sellerPoints} pts!`;
            const sellerBadgeNotes = Array.isArray(badgeNotifications?.seller) ? badgeNotifications.seller : [];
            const badgeMessage = sellerBadgeNotes.length
              ? `Unlocked ${sellerBadgeNotes.map(note => note.label || 'a badge').join(', ')} badge${sellerBadgeNotes.length > 1 ? 's' : ''}!`
              : '';
            const message = [baseMessage, badgeMessage].filter(Boolean).join(' ');
            setToast({ open: true, message, variant: 'success' });
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
            // Add new item with status 'pending' for admin approval
            const newId = item.id || item._id || Date.now();
            const newItem = { ...item, id: newId, _id: newId, sellerId: user?.id, status: 'pending' };
            // Update local listings state
            setListings(listings => [...listings, newItem]);
            // Do NOT persist here to avoid double-creating.
            // The modal already handles creating the product via backend (with Firestore fallback).
          }}
        />
      </main>
    </div>
  );
}
