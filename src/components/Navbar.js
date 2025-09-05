import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthModal from './AuthModal'

export default function Navbar(){
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

  return (
    <>
  <nav className="w-full bg-white border-b animate-fadeIn">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/assets/AGAPAY logo.png" alt="Agapay" className="w-8 h-8 object-contain" />
            <span className="font-bold text-lg">Agapay</span>
          </Link>
        </div>

        <div className="flex items-right gap-6">
          <Link to="/marketplace" className="text-sm flex items-center gap-2 text-gray-700 hover:text-teal-600" aria-label="Marketplace">
            <svg className="w-8 h-8" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M160-740v-60h642v60H160Zm5 580v-258h-49v-60l44-202h641l44 202v60h-49v258h-60v-258H547v258H165Zm60-60h262v-198H225v198Zm-50-258h611-611Zm0 0h611l-31-142H206l-31 142Z" /></svg>
          </Link>
          <Link to="/messages" className="relative text-sm flex items-center gap-2 text-gray-700 hover:text-teal-600" aria-label="Messages">
            <svg className="w-8 h-8" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z"/></svg>
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
                return unread > 0 ? <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs bg-red-600 text-white rounded-full">{unread}</span> : null
              }catch(e){ return null }
            })()}
          </Link>
        </div>

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
                  <Link to="/upload" className="block px-4 py-2 hover:bg-gray-50">Upload Product</Link>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-gray-50">Logout</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
    <AuthModal open={modalOpen} type={modalType} onClose={()=>setModalOpen(false)} />
    </>
  )
}
