import React from 'react';
const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'users', label: 'Users', icon: '👥' },
  { key: 'products', label: 'Products', icon: '📦' },
  { key: 'dropoffs', label: 'Drop-Offs', icon: '🏪' },
  { key: 'appeals', label: 'Appeals', icon: '⚖️' },
  { key: 'archive', label: 'Archived', icon: '🗄️' },
  { key: 'report', label: 'Report', icon: '❗' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];
export default function Sidebar({ activePage, setActivePage, className = '' }) {
  return (
    <aside className={`w-64 bg-white shadow-lg flex flex-col py-5 px-3 border-r border-teal-100 ${className}`}>
      <nav className="flex-1">
        {navItems.map(item => (
          <button
            key={item.key}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-2 text-base font-medium transition-all ${activePage === item.key ? 'bg-teal-100 text-teal-700' : 'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActivePage(item.key)}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
