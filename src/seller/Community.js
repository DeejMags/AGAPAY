import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Community() {
  const navigate = useNavigate();
  // Sidebar styles with active notch
  const navBtn = useMemo(() => (activeKey, currentKey = 'community') => {
    const base = 'w-full text-left flex items-center gap-2 font-medium px-3 py-2 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-teal-300';
    const inactive = 'text-gray-700 hover:text-teal-700 hover:bg-teal-50';
    const active = 'text-teal-800 bg-teal-100 border border-teal-300 shadow-sm';
    return `${base} ${currentKey===activeKey ? active : inactive}`;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col py-6 px-4">
        <div className="text-2xl font-bold text-teal-600 mb-8">Agapay</div>
        <nav className="flex-1">
          <ul className="space-y-2">
            <li>
              <button
                className={`relative ${navBtn('dashboard')}`}
                onClick={() => navigate('/dashboard')}
              >
                <span className="w-5 text-lg">🏠</span>
                <span>Dashboard</span>
              </button>
            </li>
            <li>
              <button
                className={`relative ${navBtn('listings')}`}
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

            </ul>
          </div>
          <div className="mt-8">
            <div className="text-xs text-gray-500 mb-2">Community</div>
            <ul className="space-y-2">
              <li>
                <button
                  className={`relative ${navBtn('community', 'community')}`}
                  aria-current={'page'}
                >
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-teal-500 rounded-r"></span>
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
          <h3 className="text-xl font-bold mb-4">Community</h3>
          <p className="text-gray-600">Welcome to the community! You can place your community features here.</p>
        </div>
      </main>
    </div>
  );
}
