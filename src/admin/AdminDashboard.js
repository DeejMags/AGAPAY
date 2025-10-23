import React, { useState } from 'react';
import Sidebar from './Sidebar';
import DashboardOverview from './DashboardOverview';
import UserManagement from './UserManagement';
import ProductManagement from './ProductManagement';
import OrdersManagement from './OrdersManagement';
import Report from './Report';
import PointsRewards from './PointsRewards';
import Notifications from './Notifications';
import Settings from './Settings';
import { getAllProducts } from '../firebaseProductService';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

// Dashboard state initial values (no demo data)
const initialUsers = [];
const initialOrders = [];
const initialMessages = [];
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
  const [messages, setMessages] = useState(initialMessages);
  // 'report' replaces the previous 'message' naming; keep both name and setter for clarity
  const [report, setReport] = useState(null);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [points, setPoints] = useState(initialPoints);

  // Calculate unread/flagged messages for Sidebar badge
  const unreadMessages = messages.filter(m => m.unread || m.status === 'Flagged').length;


  // Main render logic
  function renderPage() {
    switch (activePage) {
      case 'dashboard':
        return <DashboardOverview users={users} products={products} orders={orders} messages={messages} points={points} />;
      case 'users':
        return <UserManagement users={users} setUsers={setUsers} />;
      case 'products':
        return <ProductManagement products={products} setProducts={setProducts} />;
      case 'orders':
        return <OrdersManagement orders={orders} setOrders={setOrders} />;
      case 'report':
        // Sidebar uses 'report' as the key. Render the Report component with messages data
        return <Report messages={messages} setMessages={setMessages} />;
      case 'points':
        return <PointsRewards points={points} setPoints={setPoints} />;
      case 'notifications':
        return <Notifications notifications={notifications} setNotifications={setNotifications} />;
      case 'settings':
        return <Settings />;
      default:
        return <DashboardOverview users={users} products={products} orders={orders} messages={messages} points={points} report={report} setReport={setReport} />;
    }
  }

  // Responsive layout
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-teal-100 via-white to-gray-100 ml-[-12px] sm:ml-[-16px]">
      <Sidebar activePage={activePage} setActivePage={setActivePage} unreadMessages={unreadMessages} />
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

