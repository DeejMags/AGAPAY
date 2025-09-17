import React, { useState, useRef, useEffect } from 'react';
import FullScreenLoader from './FullScreenLoader';
import { Link, useNavigate } from 'react-router-dom';
import SearchIcon from './SearchIcon';
import AuthModal from './AuthModal';
import { useCart } from './CartContext';
import CartModal from './CartModal';

export default function Navbar(){
  const { cart } = useCart();
  const [loading, setLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('login')
  const [menuOpen, setMenuOpen] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const ref = useRef()

  useEffect(()=>{
    function onDoc(e){ if(ref.current && !ref.current.contains(e.target)) setMenuOpen(false) }
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
    setLoading(true);
    setTimeout(() => {
      navigate('/marketplace');
      setLoading(false);
    }, 700);
  }

  function handleBagClick(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      navigate('/shopping-bag');
      setLoading(false);
    }, 700);
  }

  function handleMessagesClick(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      navigate('/messages');
      setLoading(false);
    }, 700);
  }

  return (
    <>
      {loading && <FullScreenLoader />}
  <nav className="w-full bg-white border-b animate-fadeIn fixed top-0 left-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3" onClick={() => { window.scrollTo({top: 0, behavior: 'smooth'}); }}>
              <img src="/assets/AGAPAY logo.png" alt="Agapay" className="w-16 h-16 object-contain" />
              <span className="font-bold text-xl text-teal-600 tracking-wide" style={{letterSpacing:'2px'}}>AGAPAY</span>
            </Link>
          </div>

        {(!user || user.role !== 'admin') && (
          <form className="flex-1 mx-8" onSubmit={e=>{e.preventDefault(); navigate(`/marketplace?search=${encodeURIComponent(search)}`);}}>
            <div className="relative w-full max-w-lg mx-auto flex items-center gap-2">
              <span className="cursor-pointer" onClick={handleMarketClick} aria-label="Marketplace">
                <svg xmlns="http://www.w3.org/2000/svg" height="36" viewBox="0 -960 960 960" width="36" fill="#036c5f">
                  <path d="M160-740v-60h642v60H160Zm5 580v-258h-49v-60l44-202h641l44 202v60h-49v258h-60v-258H547v258H165Zm60-60h262v-198H225v198Zm-50-258h611-611Zm0 0h611l-31-142H206l-31 142Z"/>
                </svg>
              </span>
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
              <Link to="/shopping-bag" className="relative ml-3 cursor-pointer" aria-label="Shopping Bag" onClick={handleBagClick}>
                <svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 -960 960 960" width="32" fill="#036c5f">
                  <path d="M220-80q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h110v-10q0-63 43.5-106.5T480-880q63 0 106.5 43.5T630-730v10h110q24 0 42 18t18 42v520q0 24-18 42t-42 18H220Zm0-60h520v-520H630v90q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-90H390v90q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-90H220v520Zm170-580h180v-10q0-38-26-64t-64-26q-38 0-64 26t-26 64v10ZM220-140v-520 520Z"/>
                </svg>
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-teal-600 text-white rounded-full">{cart.length}</span>
                )}
              </Link>
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
            <div className="relative" ref={ref}>
              <button onClick={()=>setMenuOpen(v=>!v)} className="flex items-center gap-2">
                {user && user.profilePic ? (
                  <img src={user.profilePic} alt={`${user.username} avatar`} className="w-8 h-8 object-cover rounded-full" />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                )}
                <span className="hidden sm:inline">{user.username}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow py-2">
                  <Link to="/profile" className="block px-4 py-2 hover:bg-gray-50">Profile</Link>
                  {user.role === 'admin' ? (
                    <Link to="/admin" className="block px-4 py-2 hover:bg-gray-50">Admin Dashboard</Link>
                  ) : (
                    <Link to="/dashboard" className="block px-4 py-2 hover:bg-gray-50">Dashboard</Link>
                  )}
                  <Link to="/settings" className="block px-4 py-2 hover:bg-gray-50">Settings</Link>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-gray-50">Logout</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  </nav>
  <CartModal open={cartOpen} onClose={()=>setCartOpen(false)} />
    <AuthModal open={modalOpen} type={modalType} onClose={(user)=>{
      setModalOpen(false);
      // If user is admin, redirect to /admin
      if(user && user.role === 'admin') {
        localStorage.setItem('admin', 'true');
        navigate('/admin');
      }
    }} />
    {/* Floating message icon bottom right */}
  <Link to="/messages" className="fixed bottom-6 right-6 z-50" onClick={handleMessagesClick}>
      <div className="bg-teal-600 rounded-full shadow-lg w-16 h-16 flex items-center justify-center hover:bg-teal-700 transition-all relative">
        <svg className="w-8 h-8 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z"/></svg>
        {(() => {
          try{
            const me = JSON.parse(localStorage.getItem('user') || 'null')
            if(!me) return null
            let unread = 0
            Object.keys(localStorage).forEach(k=>{
              if(!k.startsWith('conv_meta_')) return
              try{
                const meta = JSON.parse(localStorage.getItem(k) || 'null')
                if(meta && meta.unreadFor && meta.unreadFor.includes(me.id)) unread += 1
              }catch(e){}
            })
            return unread > 0 ? <span className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-red-600 text-white rounded-full">{unread}</span> : null
          }catch(e){ return null }
        })()}
      </div>
    </Link>
    <CartModal open={cartOpen} onClose={()=>setCartOpen(false)} />
    </>
  )
}
