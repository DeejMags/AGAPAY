import React from 'react';
const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'users', label: 'Users', icon: '👥' },
  { key: 'products', label: 'Products', icon: '📦' },
  { key: 'messages', label: 'Messages', icon: '💬' },
  { key: 'orders', label: 'Orders', icon: '🛒' },
  { key: 'points', label: 'Points', icon: '⭐' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];
export default function Sidebar({ activePage, setActivePage, unreadMessages }) {
  // unreadMessages is now passed as a prop from AdminDashboard
  return (
    <aside className="w-64 bg-white shadow-lg flex flex-col py-6 px-4">
      <div className="mb-8 text-2xl font-bold text-teal-600 tracking-wide">Agapay Admin</div>
      <nav className="flex-1">
        {navItems.map(item => (
          <button
            key={item.key}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 text-lg font-medium transition-all ${activePage === item.key ? 'bg-teal-100 text-teal-700' : 'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActivePage(item.key)}
          >
            <span className="text-xl relative">
              {item.icon}
              {item.key === 'messages' && unreadMessages > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow">
                  {unreadMessages}
                </span>
              )}
            </span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
