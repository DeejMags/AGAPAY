import React, { useState } from 'react';
import Sidebar from './Sidebar';
import DashboardOverview from './DashboardOverview';
import UserManagement from './UserManagement';
import ProductManagement from './ProductManagement';
import OrdersManagement from './OrdersManagement';
import Report from './Report';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const validPages = React.useMemo(() => new Set(['dashboard', 'users', 'products', 'orders', 'report', 'points', 'notifications', 'settings']), []);
  const lastSectionRef = React.useRef(null);
  const [users, setUsers] = useState(initialUsers);
  const [products, setProducts] = useState([]);
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
  const [orders, setOrders] = useState(initialOrders);
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
        return <OrdersManagement orders={orders} setOrders={setOrders} />;
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

      <div className="hidden lg:block">
        <Sidebar activePage={activePage} setActivePage={setActivePage} className="h-screen sticky top-0" />
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
            <Sidebar activePage={activePage} setActivePage={(k)=>{ setActivePage(k); setSidebarOpen(false); }} className="h-[calc(100%-48px)] overflow-y-auto" />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col w-full">
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

