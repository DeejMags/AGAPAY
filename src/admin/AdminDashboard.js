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

// Dashboard state initial values (no demo data)
const initialUsers = [];
const initialOrders = [];
const initialNotifications = [];
const initialPoints = [];

export default function AdminDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [users, setUsers] = useState(initialUsers);
  const [products, setProducts] = useState([]);
  React.useEffect(() => {
    async function loadProducts() {
      try {
        // Try backend first — request admin view so dashboard shows pending/denied items and seller info
        const res = await fetch('/api/products?admin=true&includeSeller=true');
        if (res.ok) {
          const data = await res.json();
          // Backend may return a paged object { items: [...], page, pageSize }
          const items = Array.isArray(data) ? data : (data.items || []);
          setProducts(items);
          return;
        }
      } catch (err) {
        console.warn('Backend products fetch failed, using client Firestore:', err.message);
      }
      
      // Fallback to client-side Firestore
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

  // Fetch users: try backend first, then fallback to client Firestore
  React.useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          setUsers(Array.isArray(data) ? data : []);
          return;
        }
      } catch (err) {
        console.warn('Backend users fetch failed, using client Firestore:', err.message);
      }
      
      // Fallback to client-side Firestore
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

  // Load reports for sidebar badge (count open/in_review)
  const loadReports = React.useCallback(async () => {
    try {
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

  // Initial load
  React.useEffect(() => { loadReports(); }, [loadReports]);

  // Refresh when returning to dashboard/report, or when tab visibility changes
  React.useEffect(() => {
    if (activePage === 'dashboard' || activePage === 'report') {
      loadReports();
    }
  }, [activePage, loadReports]);

  React.useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') loadReports(); };
    const onChanged = () => loadReports();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('reports-changed', onChanged);
    // light polling as a fallback every 45s
    const id = window.setInterval(loadReports, 45000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('reports-changed', onChanged);
      window.clearInterval(id);
    };
  }, [loadReports]);



  // Main render logic
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

  // Responsive layout
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-teal-100 via-white to-gray-100 ml-[-12px] sm:ml-[-16px]">
  <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="flex-1 flex flex-col">
        {/* Tighter paddings to remove excessive gaps */}
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          {/* Render pages directly; individual pages provide their own containers */}
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

