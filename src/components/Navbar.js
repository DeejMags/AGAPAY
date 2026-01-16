import React, { useState, useRef, useEffect, useCallback } from 'react';
import FullScreenLoader from './FullScreenLoader';
import { useNavigate } from 'react-router-dom';
import SearchIcon from './SearchIcon';
import AuthModal from './AuthModal';
import QuickMessagesButton from './QuickMessagesButton';
import useUnreadMessages from './useUnreadMessages';
import NotificationsPopover from './NotificationsPopover';
import authFetch from '../utils/authFetch';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (err) {
    console.warn('Unable to parse stored user', err);
    return null;
  }
}

export default function Navbar(){
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('login')
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userData, setUserData] = useState(getStoredUser);
  const user = userData;
  const ref = useRef()
  const notifRef = useRef()
  const { totalUnread } = useUnreadMessages();

  const [notifOpen, setNotifOpen] = useState(false)
  const [adminCounts, setAdminCounts] = useState({ pendingProducts: 0, openReports: 0 })
  const mountedRef = useRef(true)
  const isAdmin = user && user.role === 'admin'

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, [])

  const fetchAdminCounts = useCallback(async () => {
    if (!isAdmin) {
      if (mountedRef.current) setAdminCounts({ pendingProducts: 0, openReports: 0 });
      return;
    }
    try {
      const [prodRes, reportRes] = await Promise.all([
        authFetch('/api/products?admin=true&status=pending&pageSize=100').catch(() => null),
        authFetch('/api/reports').catch(() => null)
      ]);
      let pendingProducts = 0;
      let openReports = 0;
      if (prodRes && prodRes.ok) {
        const data = await prodRes.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        pendingProducts = items.length;
      }
      if (reportRes && reportRes.ok) {
        const data = await reportRes.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        openReports = items.filter(r => String(r.status || 'open').toLowerCase() !== 'resolved' && String(r.status || 'open').toLowerCase() !== 'closed').length;
      }
      if (mountedRef.current) setAdminCounts({ pendingProducts, openReports });
    } catch (err) {
      if (mountedRef.current) setAdminCounts(prev => prev);
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) {
      setAdminCounts({ pendingProducts: 0, openReports: 0 });
      return;
    }
    let intervalId;
    fetchAdminCounts();
    intervalId = window.setInterval(fetchAdminCounts, 60000);
    return () => { if (intervalId) window.clearInterval(intervalId); };
  }, [isAdmin, fetchAdminCounts])

  useEffect(() => {
    if (notifOpen && isAdmin) {
      fetchAdminCounts();
    }
  }, [notifOpen, isAdmin, fetchAdminCounts])

  useEffect(()=>{
    function onDoc(e){
      if(ref.current && !ref.current.contains(e.target)) setMenuOpen(false)
      if(notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('click', onDoc)
    return ()=>document.removeEventListener('click', onDoc)
  },[])

  useEffect(() => {
    function handleStorage(e) {
      if (!e || e.key === 'user' || e.type === 'agapay-user-update') {
        setUserData(getStoredUser());
      }
    }
    function handleCustomUpdate() {
      setUserData(getStoredUser());
    }
    window.addEventListener('storage', handleStorage);
    window.addEventListener('agapay:user-update', handleCustomUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('agapay:user-update', handleCustomUpdate);
    };
  }, []);

  function handleLogout(){
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.dispatchEvent(new Event('agapay:user-update'));
    setUserData(null)
    navigate('/')
    window.location.reload()
  }

  function handleMarketClick() {
    navigateWithLoading('/marketplace');
  }

  function navigateWithLoading(path) {
    if (!path) return;
    setLoading(true);
    setTimeout(() => {
      navigate(path);
      setLoading(false);
    }, 700);
  }

  // Shopping bag icon removed from navbar per request

  const messageCount = Number.isFinite(totalUnread) ? totalUnread : 0;
  const adminAlertCount = isAdmin ? (adminCounts.pendingProducts + adminCounts.openReports) : 0;
  const combinedBadgeCount = messageCount + adminAlertCount;
  const badgeLabel = combinedBadgeCount > 99 ? '99+' : combinedBadgeCount;

  return (
    <>
      {loading && <FullScreenLoader />}
    <nav className="w-full bg-white border-b animate-fadeIn fixed top-0 left-0 z-50 shadow-lg">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between relative">
          <div className="flex items-center gap-4">
            {/* Logo no longer navigates; Home icon handles navigation */}
            <div className="flex items-center gap-3 select-none">
              <img src="/assets/agapay-logo.png" alt="Agapay" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
              <span className="font-bold text-xl text-teal-600 tracking-wide" style={{letterSpacing:'2px'}}>AGAPAY</span>
            </div>
            {/* Mobile hamburger (hidden for admin to avoid duplicate with AdminDashboard) */}
            {(!user || user.role !== 'admin') && (
              <button
                type="button"
                className="md:hidden ml-2 inline-flex flex-col justify-center items-center w-10 h-10 rounded-md border border-gray-200 bg-white shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen ? 'true' : 'false'}
                onClick={()=>setMobileMenuOpen(v=>!v)}
              >
                <span className="block w-5 h-0.5 bg-teal-700 mb-1 transition" style={{transform: mobileMenuOpen ? 'translateY(6px) rotate(45deg)' : 'none'}} />
                <span className="block w-5 h-0.5 bg-teal-700 mb-1 transition" style={{opacity: mobileMenuOpen ? 0 : 1}} />
                <span className="block w-5 h-0.5 bg-teal-700 transition" style={{transform: mobileMenuOpen ? 'translateY(-6px) rotate(-45deg)' : 'none'}} />
              </button>
            )}
          </div>

    {(!user || user.role !== 'admin') && (
            <form
              onSubmit={e=>{e.preventDefault(); navigate(`/marketplace?search=${encodeURIComponent(search)}`);}}
              className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-full max-w-3xl px-4"
            >
            <div className="relative w-full max-w-xs sm:max-w-lg mx-auto flex items-center gap-3">
              {/* Home icon with label */}
              <button
                type="button"
                className="flex flex-col items-center justify-center cursor-pointer select-none"
                onClick={()=>navigateWithLoading('/')}
                aria-label="Home"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="#036c5f" aria-hidden="true">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
                <span className="text-[11px] leading-3 mt-1 text-teal-700">Home</span>
              </button>

              {/* Marketplace icon with label (between Home and Dashboard) */}
              <button
                type="button"
                className="flex flex-col items-center justify-center cursor-pointer select-none"
                onClick={handleMarketClick}
                aria-label="Marketplace"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 -960 960 960" width="30" fill="#036c5f">
                  <path d="M160-740v-60h642v60H160Zm5 580v-258h-49v-60l44-202h641l44 202v60h-49v258h-60v-258H547v258H165Zm60-60h262v-198H225v198Zm-50-258h611-611Zm0 0h611l-31-142H206l-31 142Z"/>
                </svg>
                <span className="text-[11px] leading-3 mt-1 text-teal-700">Marketplace</span>
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  className="w-full p-2 pl-9 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Search products..."
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SearchIcon />
                </span>
              </div>
              {/* Shopping bag icon removed */}
              {/* Seller Dashboard quick link with label (non-admin users) */}
              {user && user.role !== 'admin' && (
                <button
                  type="button"
                  onClick={()=>navigateWithLoading('/dashboard')}
                  className="flex flex-col items-center justify-center cursor-pointer select-none"
                  aria-label="Dashboard"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="#036c5f" aria-hidden="true">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                  </svg>
                  <span className="text-[11px] leading-3 mt-1 text-teal-700">Dashboard</span>
                </button>
              )}
            </div>
          </form>
        )}

  <div className="hidden md:flex items-center gap-4">
          {!user ? (
            <>
              <button onClick={()=>{ setModalType('login'); setModalOpen(true) }} className="text-sm">Login</button>
              <button onClick={()=>{ setModalType('signup'); setModalOpen(true) }} className="text-sm font-semibold px-3 py-1 bg-teal-600 text-white rounded">Sign up</button>
            </>
          ) : (
            <>
              {/* Notifications bell next to profile (all logged-in users) */}
              {user && (
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={(e)=>{
                      e.preventDefault();
                      setNotifOpen(v=>!v);
                    }}
                    className="relative cursor-pointer"
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={notifOpen ? 'true' : 'false'}
                    aria-label="Notifications"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 -960 960 960" width="30" fill="#036c5f">
                      <path d="M160-200v-60h80v-304q0-84 49.5-150.5T420-798v-22q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v22q81 17 130.5 83.5T720-564v304h80v60H160Zm320-302Zm0 422q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM300-260h360v-304q0-75-52.5-127.5T480-744q-75 0-127.5 52.5T300-564v304Z"/>
                    </svg>
                    {combinedBadgeCount > 0 && (
                      <span
                        className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] leading-none bg-red-600 text-white rounded-full"
                        aria-label={`${combinedBadgeCount} pending notifications`}
                      >
                        {badgeLabel}
                      </span>
                    )}
                  </button>
                  <NotificationsPopover
                    open={notifOpen}
                    onClose={()=>setNotifOpen(false)}
                    adminCounts={isAdmin ? adminCounts : null}
                  />
                </div>
              )}

              <div className="relative" ref={ref}>
                <button onClick={()=>setMenuOpen(v=>!v)} className="flex items-center gap-2">
                {user && user.profilePic ? (
                  <img src={user.profilePic} alt={`${user.username} avatar`} className="w-9 h-9 object-cover rounded-full" />
                ) : (
                  // render teal circular avatar with person svg for logged-in users without a profilePic
                  <div className="w-9 h-9 bg-teal-600 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-user">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                )}
                <span className="hidden sm:inline">{user.username}</span>
                </button>
                {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow py-2">
                  {user.role !== 'admin' && (
                    <button onClick={() => { setMenuOpen(false); navigateWithLoading('/profile'); }} className="block w-full text-left px-4 py-2 hover:bg-gray-50">Profile</button>
                  )}
                  {user.role === 'admin' && (
                    <button onClick={() => { setMenuOpen(false); navigateWithLoading('/admin'); }} className="block w-full text-left px-4 py-2 hover:bg-gray-50">Admin Dashboard</button>
                  )}
                  {user.role !== 'admin' && (
                    <button onClick={() => { setMenuOpen(false); navigateWithLoading('/settings'); }} className="block w-full text-left px-4 py-2 hover:bg-gray-50">Settings</button>
                  )}
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-gray-50">Logout</button>
                </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
  </nav>
  {/* Mobile slide-down menu */}
  {mobileMenuOpen && (
    <div className="md:hidden fixed top-[72px] left-0 w-full bg-white border-b border-teal-100 shadow-lg z-40 animate-slideDown">
      <div className="px-4 py-4 space-y-4">
        {(!user || user.role !== 'admin') && (
          <div className="space-y-3">
            <form onSubmit={e=>{e.preventDefault(); navigate(`/marketplace?search=${encodeURIComponent(search)}`); setMobileMenuOpen(false);}}>
              <div className="relative w-full flex items-center">
                <input
                  type="text"
                  className="w-full p-2 pl-9 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Search products..."
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"><SearchIcon /></span>
              </div>
            </form>
            <div className="grid grid-cols-3 gap-4 text-center">
              <button onClick={()=>{navigateWithLoading('/'); setMobileMenuOpen(false);}} className="flex flex-col items-center text-teal-700 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#036c5f"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                Home
              </button>
              <button onClick={()=>{handleMarketClick(); setMobileMenuOpen(false);}} className="flex flex-col items-center text-teal-700 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" height="28" viewBox="0 -960 960 960" width="28" fill="#036c5f"><path d="M160-740v-60h642v60H160Zm5 580v-258h-49v-60l44-202h641l44 202v60h-49v258h-60v-258H547v258H165Zm60-60h262v-198H225v198Zm-50-258h611-611Zm0 0h611l-31-142H206l-31 142Z"/></svg>
                Market
              </button>
              {user && user.role !== 'admin' && (
                <button onClick={()=>{navigateWithLoading('/dashboard'); setMobileMenuOpen(false);}} className="flex flex-col items-center text-teal-700 text-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#036c5f"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
                  Dashboard
                </button>
              )}
            </div>
          </div>
        )}
        {/* Auth / profile section */}
        <div className="border-t pt-4">
          {!user ? (
            <div className="flex gap-3">
              <button onClick={()=>{ setModalType('login'); setModalOpen(true); setMobileMenuOpen(false); }} className="flex-1 border rounded p-2 text-sm">Login</button>
              <button onClick={()=>{ setModalType('signup'); setModalOpen(true); setMobileMenuOpen(false); }} className="flex-1 bg-teal-600 text-white rounded p-2 text-sm font-semibold">Sign up</button>
            </div>
          ) : (
            <div className="space-y-2">
              {user.role !== 'admin' && (
                <button onClick={()=>{ navigateWithLoading('/profile'); setMobileMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50">Profile</button>
              )}
              {user.role === 'admin' && (
                <button onClick={()=>{ navigateWithLoading('/admin'); setMobileMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50">Admin Dashboard</button>
              )}
              {user.role !== 'admin' && (
                <button onClick={()=>{ navigateWithLoading('/settings'); setMobileMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50">Settings</button>
              )}
              <button onClick={()=>{ handleLogout(); setMobileMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50">Logout</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )}
  {/* Hide message bubble on admin pages */}
  {(!user || user.role !== 'admin') && <QuickMessagesButton />}
  <AuthModal open={modalOpen} type={modalType} onClose={(user)=>{
      setModalOpen(false);
      setUserData(getStoredUser());
      // If user is admin, redirect to /admin
      if(user && user.role === 'admin') {
        localStorage.setItem('admin', 'true');
        navigate('/admin');
      }
    }} />
      {/* Removed notification and points from sidebar as requested */}
    </>
  )
}
