import React, { useState } from 'react';
import Sidebar from './Sidebar';
import DashboardOverview from './DashboardOverview';
import UserManagement from './UserManagement';
import ProductManagement from './ProductManagement';
import OrdersManagement from './OrdersManagement';
import MessageMonitoring from './MessageMonitoring';
import PointsRewards from './PointsRewards';
import Notifications from './Notifications';
import Settings from './Settings';

// Centralized demo data for all modules
const initialUsers = [
  { id: 1, name: 'Admin', email: 'admin@agapay.com', phone: '09170000000', address: 'HQ', status: 'Active' },
  { id: 2, name: 'Juan Dela Cruz', email: 'juan@email.com', phone: '09171234567', address: 'Manila', status: 'Active' },
  { id: 3, name: 'Maria Santos', email: 'maria@email.com', phone: '09181234567', address: 'Cebu', status: 'Suspended' },
];
const initialProducts = [
  { id: 1, title: 'Vintage Camera', price: 2400, status: 'Pending', owner: 'Juan Dela Cruz' },
  { id: 2, title: 'Mountain Bike', price: 12000, status: 'Approved', owner: 'Maria Santos' },
];
const initialOrders = [
  { id: 1, product: 'Vintage Camera', buyer: 'Maria', status: 'Pending' },
  { id: 2, product: 'Mountain Bike', buyer: 'Juan', status: 'Delivered' },
];
const initialMessages = [
  { id: 1, from: 'Juan', to: 'Maria', content: 'Spam message', status: 'Flagged', unread: true },
  { id: 2, from: 'Maria', to: 'Juan', content: 'Hi Juan!', status: 'Read', unread: false },
];
const initialNotifications = [
  { id: 1, type: 'Product Upload', message: 'New product uploaded by Juan', status: 'New' },
  { id: 2, type: 'Flagged User', message: 'User Maria flagged for review', status: 'New' },
];
const initialPoints = [
  { id: 1, user: 'Juan', points: 1200, redeemed: 500 },
  { id: 2, user: 'Maria', points: 800, redeemed: 200 },
];

export default function AdminDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [users, setUsers] = useState(initialUsers);
  const [products, setProducts] = useState(() => {
    // Load products from localStorage for real-time admin approval
    const localProducts = JSON.parse(localStorage.getItem('agapay_products') || '[]');
    return localProducts.length ? localProducts : initialProducts;
  });
  const [orders, setOrders] = useState(initialOrders);
  const [messages, setMessages] = useState(initialMessages);
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
      case 'messages':
        return <MessageMonitoring messages={messages} setMessages={setMessages} />;
      case 'points':
        return <PointsRewards points={points} setPoints={setPoints} />;
      case 'notifications':
        return <Notifications notifications={notifications} setNotifications={setNotifications} />;
      case 'settings':
        return <Settings />;
      default:
        return <DashboardOverview users={users} products={products} orders={orders} messages={messages} points={points} />;
    }
  }

  // Responsive layout
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-teal-100 via-white to-gray-100">
      <Sidebar activePage={activePage} setActivePage={setActivePage} unreadMessages={unreadMessages} />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-2 sm:p-4 md:p-8 lg:p-12 xl:p-16">
          <div className="bg-white rounded-2xl shadow-xl p-2 sm:p-4 md:p-8 min-h-[60vh]">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

