import React, { useState } from 'react';
import Sidebar from './Sidebar';
import FullScreenLoader from '../components/FullScreenLoader';
import DashboardOverview from './DashboardOverview';
import UserManagement from './UserManagement';
import ProductManagement from './ProductManagement';
import OrdersManagement from './OrdersManagement';
import Report from './Report';
import ArchivePage from './ArchivePage';
import authFetch from '../utils/authFetch';
import PointsRewards from './PointsRewards';
import Notifications from './Notifications';
import Settings from './Settings';
import { getAllProducts } from '../firebaseProductService';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';

const initialUsers = [];
const initialOrders = [];
const initialNotifications = [];
const initialPoints = [];

export default function AdminDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [pageLoading, setPageLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const validPages = React.useMemo(() => new Set(['dashboard', 'users', 'products', 'orders', 'archive', 'report', 'points', 'notifications', 'settings']), []);
  const lastSectionRef = React.useRef(null);
  const [users, setUsers] = useState(initialUsers);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState(initialOrders);
  React.useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('/api/products?admin=true&includeSeller=true');
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.items || []);
          setProducts(items);
          return;
        }
      } catch (err) {
        console.warn('Backend products fetch failed, using client Firestore:', err.message);
      }
      
      try {
        const data = await getAllProducts();
        setProducts(data);
        console.log('Products loaded from Firebase:', data);
      } catch (err) {
        console.error('Error fetching products from Firestore:', err);
        setProducts([]);
      }
    }
    loadProducts();
  }, []);

  React.useEffect(() => {
    async function loadUsers() {
      try {
        const res = await authFetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          setUsers(Array.isArray(data) ? data : []);
          return;
        }
      } catch (err) {
        console.warn('Backend users fetch failed, using client Firestore:', err.message);
      }
      
      try {
        const qs = await getDocs(collection(db, 'users'));
        const list = qs.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(list);
        console.log('Users loaded from Firebase:', list);
      } catch (err) {
        console.error('Error fetching users from Firestore:', err);
        setUsers([]);
      }
    }
    loadUsers();
  }, []);

  const loadOrders = React.useCallback(async () => {
    try {
      const qs = await getDocs(collection(db, 'orders'));
      const list = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      // sort newest first
      list.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setOrders(list);
    } catch (err) {
      console.error('Error loading orders from Firestore:', err);
      setOrders([]);
    }
  }, []);

  React.useEffect(() => {
    loadOrders();
    const onChanged = () => loadOrders();
    window.addEventListener('orders-changed', onChanged);
    const id = window.setInterval(loadOrders, 30000);
    return () => {
      window.removeEventListener('orders-changed', onChanged);
      window.clearInterval(id);
    };
  }, [loadOrders]);

  const refreshOrders = React.useCallback(async () => {
    try {
      setPageLoading(true);
      await loadOrders();
    } catch (e) {
      // ignore
    } finally {
      setPageLoading(false);
    }
  }, [loadOrders]);

  // When active page changes, ensure page loading state clears when data is ready
  React.useEffect(() => {
    let cancelled = false;
    async function onPageChange() {
      // If switching to orders/archive, reload orders and clear loading afterwards
      if (activePage === 'orders' || activePage === 'archive') {
        try {
          await loadOrders();
        } catch (e) {}
        if (!cancelled) setPageLoading(false);
        return;
      }
      // For other pages, hide the loading overlay shortly
      const t = window.setTimeout(() => { if (!cancelled) setPageLoading(false); }, 350);
      return () => window.clearTimeout(t);
    }
    const cleanup = onPageChange();
    return () => { cancelled = true; if (cleanup && typeof cleanup.then !== 'function') cleanup(); };
  }, [activePage, loadOrders]);
  const lastSeenOrderIdRef = React.useRef(null);
  const [orderPopup, setOrderPopup] = useState({ open: false, order: null });
  React.useEffect(() => {
    let cancelled = false;
    async function checkLatest() {
      try {
        const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1));
        const snap = await getDocs(q);
        if (cancelled) return;
        if (!snap || snap.empty) return;
        const d = snap.docs[0];
        const latest = { id: d.id, ...d.data() };
        if (latest.id && latest.id !== lastSeenOrderIdRef.current) {
          lastSeenOrderIdRef.current = latest.id;
          setOrderPopup({ open: true, order: latest });
        }
      } catch (e) {
        console.warn('Failed to fetch latest order for admin popup', e);
      }
    }
    // Initialize last seen order id to avoid popping for existing orders
    (async () => {
      try {
        const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1));
        const snap = await getDocs(q);
        if (!snap || snap.empty) return;
        const d = snap.docs[0];
        lastSeenOrderIdRef.current = d.id;
      } catch (e) { /* ignore init error */ }
    })();

    const handler = () => { checkLatest(); };
    window.addEventListener('orders-changed', handler);
    return () => { cancelled = true; window.removeEventListener('orders-changed', handler); };
  }, []);
  const [reportItems, setReportItems] = useState([]);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [points, setPoints] = useState(initialPoints);

  const loadReports = React.useCallback(async () => {
    try {
      const { auth } = await import('../firebase');
      if (!auth.currentUser) return;
      const res = await authFetch('/api/reports');
      if (res.ok) {
        const json = await res.json();
        const arr = Array.isArray(json) ? json : (json.items || []);
        setReportItems(arr);
      } else {
        setReportItems([]);
      }
    } catch {
      setReportItems([]);
    }
  }, []);

  React.useEffect(() => { loadReports(); }, [loadReports]);

  React.useEffect(() => {
    if (activePage === 'dashboard' || activePage === 'report') {
      loadReports();
    }
  }, [activePage, loadReports]);

  // Listen for navigation events to open the Archive tab when items are archived
  React.useEffect(() => {
    function handleNavigateArchive() {
      setPageLoading(true);
      setActivePage('archive');
    }
    window.addEventListener('navigate-archive', handleNavigateArchive);
    return () => window.removeEventListener('navigate-archive', handleNavigateArchive);
  }, []);

  React.useEffect(() => {
    const stateSection = location && location.state && location.state.adminSection;
    const params = location ? new URLSearchParams(location.search || '') : null;
    const querySection = params ? params.get('section') : null;
    const target = stateSection || querySection;
    if (!target || target === lastSectionRef.current) return;
    if (!validPages.has(target)) return;
    lastSectionRef.current = target;
    setActivePage(target);
  }, [location, validPages]);

  React.useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') loadReports(); };
    const onChanged = () => loadReports();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('reports-changed', onChanged);
    const id = window.setInterval(loadReports, 45000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('reports-changed', onChanged);
      window.clearInterval(id);
    };
  }, [loadReports]);



  function renderPage() {
    switch (activePage) {
      case 'dashboard':
        return <DashboardOverview users={users} products={products} orders={orders} reports={reportItems} points={points} />;
      case 'users':
        return <UserManagement users={users} setUsers={setUsers} />;
      case 'products':
        return <ProductManagement products={products} setProducts={setProducts} />;
      case 'orders':
        return <OrdersManagement orders={orders} setOrders={setOrders} onRefresh={refreshOrders} />;
      case 'archive':
        return (
          <ArchivePage
            orders={orders}
            setOrders={setOrders}
            users={users}
            setUsers={setUsers}
            reports={reportItems}
            setReports={setReportItems}
            refreshOrders={refreshOrders}
          />
        );
      case 'report':
        return <Report />;
      case 'points':
        return <PointsRewards points={points} setPoints={setPoints} />;
      case 'notifications':
        return <Notifications notifications={notifications} setNotifications={setNotifications} />;
      case 'settings':
        return <Settings />;
      default:
        return <DashboardOverview users={users} products={products} orders={orders} reports={reportItems} points={points} />;
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-teal-100 via-white to-gray-100 ml-[-12px] sm:ml-[-16px]">
      <button
        type="button"
        className="lg:hidden fixed top-3 left-3 z-50 rounded-md bg-white/90 border border-gray-200 w-11 h-11 flex flex-col justify-center items-center shadow transition-colors hover:bg-gray-50"
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={sidebarOpen ? 'true' : 'false'}
        onClick={() => setSidebarOpen(v => !v)}
      >
        <span className={`block w-6 h-0.5 bg-teal-700 mb-1 transform transition duration-300 ${sidebarOpen ? 'translate-y-1.5 rotate-45' : ''}`}></span>
        <span className={`block w-6 h-0.5 bg-teal-700 mb-1 transition-opacity duration-300 ${sidebarOpen ? 'opacity-0' : 'opacity-100'}`}></span>
        <span className={`block w-6 h-0.5 bg-teal-700 transform transition duration-300 ${sidebarOpen ? '-translate-y-1.5 -rotate-45' : ''}`}></span>
      </button>

      {orderPopup.open && orderPopup.order && (
        <div className="fixed top-4 right-4 z-50 w-80 bg-white border rounded-lg shadow-lg p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-gray-500">New order received</div>
              <div className="font-semibold mt-1">{orderPopup.order.productTitle || 'Order'}</div>
              <div className="text-xs text-gray-600 mt-1">Type: {orderPopup.order.type || 'delivery'}</div>
              <div className="text-xs text-gray-600">From: {orderPopup.order.buyerName || orderPopup.order.buyerId || 'Unknown'}</div>
            </div>
            <div className="ml-2 flex flex-col items-end">
              <button className="text-sm text-gray-500 mb-2" onClick={() => { setOrderPopup({ open: false, order: null }); }}>Close</button>
              <button className="text-xs bg-teal-600 text-white px-2 py-1 rounded" onClick={() => { setActivePage('orders'); setOrderPopup({ open: false, order: null }); }}>View</button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:block">
        <Sidebar activePage={activePage} setActivePage={(k)=>{ setPageLoading(true); setActivePage(k); }} className="h-screen sticky top-0" />
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40 animate-fadeIn" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl transform animate-slideInLeft">
            <div className="flex items-center justify-between px-3 py-3 border-b">
              <div className="font-semibold text-teal-700">Menu</div>
              <button
                type="button"
                aria-label="Close menu"
                className="rounded p-1 hover:bg-gray-100"
                onClick={() => setSidebarOpen(false)}
              >
                ✕
              </button>
            </div>
            <Sidebar activePage={activePage} setActivePage={(k)=>{ setPageLoading(true); setActivePage(k); setSidebarOpen(false); }} className="h-[calc(100%-48px)] overflow-y-auto" />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col w-full">
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          {pageLoading && <FullScreenLoader />}
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

