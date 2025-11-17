import React, { useState, useRef, useEffect } from 'react';
// Use the image from the public folder via an absolute URL at runtime
import FullScreenLoader from './FullScreenLoader';
import { useNavigate } from 'react-router-dom';
import SearchIcon from './SearchIcon';
import AuthModal from './AuthModal';
import QuickMessagesButton from './QuickMessagesButton';
import useUnreadMessages from './useUnreadMessages';
import NotificationsPopover from './NotificationsPopover';

export default function Navbar(){
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('login')
  const [menuOpen, setMenuOpen] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const ref = useRef()
  const notifRef = useRef()
  const { totalUnread, hasUnread } = useUnreadMessages();

  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(()=>{
    function onDoc(e){
      if(ref.current && !ref.current.contains(e.target)) setMenuOpen(false)
      if(notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('click', onDoc)
    return ()=>document.removeEventListener('click', onDoc)
  },[])

  function handleLogout(){
    localStorage.removeItem('token')
    localStorage.removeItem('user')
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

  return (
    <>
      {loading && <FullScreenLoader />}
  <nav className="w-full bg-white border-b animate-fadeIn fixed top-0 left-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo no longer navigates; Home icon handles navigation */}
            <div className="flex items-center gap-3 select-none">
              <img src="/assets/agapay-logo.png" alt="Agapay" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
              <span className="font-bold text-xl text-teal-600 tracking-wide" style={{letterSpacing:'2px'}}>AGAPAY</span>
            </div>
          </div>

        {(!user || user.role !== 'admin') && (
            <form className="flex-1 mx-2 sm:mx-8" onSubmit={e=>{e.preventDefault(); navigate(`/marketplace?search=${encodeURIComponent(search)}`);}}>
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

        <div className="flex items-center gap-4">
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
                    {hasUnread && (
                      <span
                        className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] leading-none bg-red-600 text-white rounded-full"
                        aria-label={`${totalUnread} unread messages`}
                      >
                        {totalUnread > 9 ? '9+' : totalUnread}
                      </span>
                    )}
                  </button>
                  <NotificationsPopover open={notifOpen} onClose={()=>setNotifOpen(false)} />
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
  {/* Hide message bubble on admin pages */}
  {(!user || user.role !== 'admin') && <QuickMessagesButton />}
  <AuthModal open={modalOpen} type={modalType} onClose={(user)=>{
      setModalOpen(false);
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
