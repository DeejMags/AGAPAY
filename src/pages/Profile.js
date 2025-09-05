import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import RatingStars from '../components/RatingStars'
import ProductCard from '../components/ProductCard'

export default function Profile(){
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [myProducts, setMyProducts] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  useEffect(()=>{
    const products = JSON.parse(localStorage.getItem('agapay_products') || '[]')
    if(id){
      const users = JSON.parse(localStorage.getItem('agapay_users') || '[]')
      const u = users.find(x=>x.id === id) || null
      setUser(u)
      if(u) setMyProducts(products.filter(p=> p.sellerId === u.id))
    } else {
      const u = JSON.parse(localStorage.getItem('user') || 'null')
      setUser(u)
      if(u) setMyProducts(products.filter(p=> p.sellerId === u.id))
    }
  },[id])

  if(!user) return <div className="py-8 container mx-auto px-4">User not found or please log in to see your profile.</div>

  return (
    <div className="py-8 container mx-auto px-4">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/4">
          {/* Profile header: circular image with edit overlay */}
          <ProfileHeader me={user} onPicChange={(u)=>{ setUser(u); setForm(fr=> ({ ...fr, profilePic: u.profilePic || fr.profilePic })) }} />

          {/* View / Edit area under header */}
          <div className="mt-4">
            {!editing ? (
              <>
                <h2 className="mt-2 text-xl font-semibold">{user.username}</h2>
                <div className="text-sm text-gray-600">{user.email}</div>
                <div className="mt-2"><RatingStars value={(user.ratings||[]).length ? Math.round((user.ratings.reduce((s,r)=>s+r.ratingValue,0))/(user.ratings.length)) : 0} /></div>
                {!id && <button onClick={()=>{ setEditing(true); setForm({ name: user.username, email: user.email, phone: user.phone||'', address: user.address||'', profilePic: user.profilePic||'' }) }} className="mt-3 p-2 bg-teal-600 text-white rounded">Edit Profile</button>}
              </>
            ) : (
              <div className="mt-4">
                <div className="text-xs text-gray-500">Change profile picture using the edit icon on the photo above.</div>
                {form.profilePic && <img src={form.profilePic} alt="profile preview" className="w-24 h-24 object-cover rounded-full mt-2" />}
                <label className="block text-sm">Name</label>
                <input value={form.name || ''} onChange={e=>setForm(f=>({...f, name: e.target.value}))} className="p-2 border rounded w-full" />
                <label className="block text-sm mt-2">Email</label>
                <input value={form.email || ''} onChange={e=>setForm(f=>({...f, email: e.target.value}))} className="p-2 border rounded w-full" />
                <label className="block text-sm mt-2">Phone</label>
                <input value={form.phone || ''} onChange={e=>setForm(f=>({...f, phone: e.target.value}))} className="p-2 border rounded w-full" />
                <label className="block text-sm mt-2">Address</label>
                <input value={form.address || ''} onChange={e=>setForm(f=>({...f, address: e.target.value}))} className="p-2 border rounded w-full" />
                <div className="flex gap-2 mt-3">
                  <button onClick={async ()=>{
                    // save
                    const updated = { ...user, username: form.name, email: form.email, phone: form.phone, address: form.address }
                    if(form.profilePic) updated.profilePic = form.profilePic
                    const users = JSON.parse(localStorage.getItem('agapay_users') || '[]')
                    const idx = users.findIndex(u=>u.id===user.id)
                    if(idx>=0) users[idx] = updated
                    localStorage.setItem('agapay_users', JSON.stringify(users))
                    localStorage.setItem('user', JSON.stringify(updated))
                    setUser(updated)
                    setEditing(false)
                  }} className="p-2 bg-teal-600 text-white rounded">Save</button>
                  <button onClick={()=>setEditing(false)} className="p-2 bg-gray-200 rounded">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">My listings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {myProducts.length ? myProducts.map(p=> <ProductCard key={p._id} product={p} />) : <div className="p-4 border rounded">No listings yet.</div>}
          </div>
        </div>
      </div>
    </div>
  )

  async function fileToBase64(file){
    return new Promise((res, rej)=>{
      const r = new FileReader()
      r.onload = ()=>res(r.result)
      r.onerror = ()=>rej(new Error('file read'))
      r.readAsDataURL(file)
    })
  }
}

function ProfileHeader({ me, onPicChange }){
  const [preview, setPreview] = useState(me && me.profilePic ? me.profilePic : null)
  const fileRef = useRef()

  useEffect(()=>{
    setPreview(me && me.profilePic ? me.profilePic : null)
  },[me])

  async function handleFile(e){
    const f = e.target.files && e.target.files[0]
    if(!f) return
    const reader = new FileReader()
    reader.onload = ()=>{
      setPreview(reader.result)
      // notify parent to update user and persist
      if(typeof onPicChange === 'function'){
        const u = { ...(me||{}), profilePic: reader.result }
        // persist in localStorage
        try{
          const users = JSON.parse(localStorage.getItem('agapay_users') || '[]')
          const idx = users.findIndex(x=>x.id === u.id)
          if(idx>=0){ users[idx].profilePic = reader.result; localStorage.setItem('agapay_users', JSON.stringify(users)) }
        }catch(e){}
        localStorage.setItem('user', JSON.stringify(u))
        onPicChange(u)
      }
    }
    reader.readAsDataURL(f)
  }

  function triggerFile(){ if(fileRef.current) fileRef.current.click() }

  return (
    <div className="bg-white border rounded p-4 flex flex-col items-center">
      <div className="relative">
        <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
          {preview ? <img src={preview} alt="profile" className="w-full h-full object-cover" /> : <div className="text-gray-500">No photo</div>}
        </div>
        <button onClick={triggerFile} aria-label="Edit profile picture" className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow hover:scale-105 transition text-teal-500">
          {/* user-provided edit pencil icon, color via currentColor */}
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M180-180h44l472-471-44-44-472 471v44Zm-60 60v-128l575-574q8-8 19-12.5t23-4.5q11 0 22 4.5t20 12.5l44 44q9 9 13 20t4 22q0 11-4.5 22.5T823-694L248-120H120Zm659-617-41-41 41 41Zm-105 64-22-22 44 44-22-22Z"/></svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      <h2 className="mt-4 text-xl font-semibold">{me ? me.username : 'User'}</h2>
      <div className="text-sm text-gray-600">{me ? me.email : ''}</div>
    </div>
  )
}
