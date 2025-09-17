import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ListNewItemModal from '../seller/ListNewItemModal';
import ListingsPanel from '../seller/ListingsPanel';
import OrdersPanel from '../seller/OrdersPanel';
import MessagesPanel from '../seller/MessagesPanel';
import AnalyticsPanel from '../seller/AnalyticsPanel';
import ImpactReportPanel from '../seller/ImpactReportPanel';

export default function SellerDashboard() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, active: 0, views: 0, sold: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState('dashboard'); // dashboard, listings, orders, messages, analytics, impact
  const [editItem, setEditItem] = useState(null);

  useEffect(() => {
    // Simulate fetching user and listings from localStorage
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(u);
    const products = JSON.parse(localStorage.getItem('agapay_products') || '[]');
    const myListings = products.filter(p => p.sellerId === u?.id);
    setListings(myListings);
    // Simulate stats
    setStats({
      revenue: 2847,
      active: myListings.length,
      views: 1847,
      sold: myListings.filter(p => p.status === 'sold').length
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col py-6 px-4">
        <div className="text-2xl font-bold text-teal-600 mb-8">Agapay</div>
        <nav className="flex-1">
          <ul className="space-y-2">
            <li><button className={`w-full text-left flex items-center gap-2 text-gray-700 hover:text-teal-600 font-medium ${view==='dashboard'?'font-bold':''}`} onClick={()=>setView('dashboard')}><span>🏠</span> Dashboard</button></li>
            <li><button className={`w-full text-left flex items-center gap-2 text-gray-700 hover:text-teal-600 font-medium ${view==='listings'?'font-bold':''}`} onClick={()=>setView('listings')}><span>📦</span> My Listings</button></li>
            <li><button className={`w-full text-left flex items-center gap-2 text-gray-700 hover:text-teal-600 font-medium ${view==='orders'?'font-bold':''}`} onClick={()=>setView('orders')}><span>🛒</span> Orders</button></li>
            <li><button className={`w-full text-left flex items-center gap-2 text-gray-700 hover:text-teal-600 font-medium ${view==='messages'?'font-bold':''}`} onClick={()=>setView('messages')}><span>💬</span> Messages</button></li>
          </ul>
          <div className="mt-8">
            <div className="text-xs text-gray-500 mb-2">Business</div>
            <ul className="space-y-2">
              <li><button className={`w-full text-left flex items-center gap-2 text-gray-700 hover:text-teal-600 font-medium ${view==='analytics'?'font-bold':''}`} onClick={()=>setView('analytics')}><span>📊</span> Analytics</button></li>
              <li><button className={`w-full text-left flex items-center gap-2 text-gray-700 hover:text-teal-600 font-medium ${view==='impact'?'font-bold':''}`} onClick={()=>setView('impact')}><span>🌱</span> Impact Report</button></li>
              <li><Link to="/performance" className="flex items-center gap-2 text-gray-700 hover:text-teal-600 font-medium"><span>📈</span> Performance</Link></li>
              <li><Link to="/reviews" className="flex items-center gap-2 text-gray-700 hover:text-teal-600 font-medium"><span>⭐</span> Reviews</Link></li>
            </ul>
          </div>
          <div className="mt-8">
            <div className="text-xs text-gray-500 mb-2">Community</div>
            <ul className="space-y-2">
              <li><Link to="/community" className="flex items-center gap-2 text-gray-700 hover:text-teal-600 font-medium"><span>👥</span> Community</Link></li>
              <li><Link to="/settings" className="flex items-center gap-2 text-gray-700 hover:text-teal-600 font-medium"><span>⚙️</span> Settings</Link></li>
            </ul>
          </div>
        </nav>
      </aside>
      {/* Main Content */}
      <main className="flex-1 p-8">
        {view === 'dashboard' && (
          <>
            <div className="bg-teal-100 rounded-xl p-8 mb-8">
              <h1 className="text-3xl font-bold text-teal-900 mb-2">Welcome back to your sustainable marketplace</h1>
              <p className="text-teal-800">Continue building the circular economy, one item at a time</p>
            </div>
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Your Marketplace</h2>
              <p className="text-gray-600 mb-6">Manage your listings and track your impact</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow p-6 flex flex-col items-start">
                  <div className="text-xs text-gray-500 mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold">${stats.revenue.toLocaleString()}</div>
                  <div className="text-green-600 text-xs mt-1">+12.5% from last month</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6 flex flex-col items-start">
                  <div className="text-xs text-gray-500 mb-1">Active Listings</div>
                  <div className="text-2xl font-bold">{stats.active}</div>
                  <div className="text-green-600 text-xs mt-1">+8 items from last month</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6 flex flex-col items-start">
                  <div className="text-xs text-gray-500 mb-1">Views</div>
                  <div className="text-2xl font-bold">{stats.views.toLocaleString()}</div>
                  <div className="text-green-600 text-xs mt-1">+32.1% from last month</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6 flex flex-col items-start">
                  <div className="text-xs text-gray-500 mb-1">Items Sold</div>
                  <div className="text-2xl font-bold">{stats.sold}</div>
                  <div className="text-green-600 text-xs mt-1">+4 this week from last month</div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Your Listings</h3>
                <button className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 font-medium" onClick={()=>{setModalOpen(true); setEditItem(null);}}>+ List New Item</button>
              </div>
              <ListingsPanel
                listings={listings}
                onEdit={item => {setEditItem(item); setModalOpen(true);}}
                onDelete={id => setListings(listings => listings.filter(l => l.id !== id))}
                onView={item => alert('View: ' + item.title)}
              />
            </section>
          </>
        )}
        {view === 'listings' && (
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">My Listings</h3>
              <button className="bg-teal-700 text-white px-4 py-2 rounded hover:bg-teal-700 font-medium" onClick={()=>{setModalOpen(true); setEditItem(null);}}>+ List New Item</button>
            </div>
            <ListingsPanel
              listings={listings}
              onEdit={item => {setEditItem(item); setModalOpen(true);}}
              onDelete={id => setListings(listings => listings.filter(l => l.id !== id))}
              onView={item => alert('View: ' + item.title)}
            />
          </section>
        )}
        {view === 'orders' && <OrdersPanel />}
        {view === 'messages' && <MessagesPanel />}
        {view === 'analytics' && <AnalyticsPanel />}
        {view === 'impact' && <ImpactReportPanel />}
        <ListNewItemModal
          open={modalOpen}
          onClose={()=>{setModalOpen(false); setEditItem(null);}}
          onAdd={item => {
            // Add new item with status 'pending' for admin approval
            const newItem = { ...item, sellerId: user?.id, status: 'pending' };
            // Update local listings state
            setListings(listings => [...listings, newItem]);
            // Update global products in localStorage
            const products = JSON.parse(localStorage.getItem('agapay_products') || '[]');
            localStorage.setItem('agapay_products', JSON.stringify([...products, newItem]));
          }}
        />
      </main>
    </div>
  );
}
