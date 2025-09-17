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
            <h2 className="mt-2 text-xl font-semibold">{user.username}</h2>
            <div className="text-sm text-gray-600">{user.email}</div>
            {/* Only show rating stars if user is a seller (has listings) */}
            {myProducts.length > 0 && (
              <div className="mt-2">
                <RatingStars value={(user.ratings||[]).length ? Math.round((user.ratings.reduce((s,r)=>s+r.ratingValue,0))/(user.ratings.length)) : 0} />
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
  // Show profile info only, no edit/upload
  return (
    <div className="bg-white border rounded p-4 flex flex-col items-center">
      <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
        {me && me.profilePic ? <img src={me.profilePic} alt="profile" className="w-full h-full object-cover" /> : <div className="text-gray-500">No photo</div>}
      </div>
      <h2 className="mt-4 text-xl font-semibold">{me ? (me.name || me.username) : 'User'}</h2>
      <div className="text-sm text-gray-600">{me ? me.email : ''}</div>
      {me && me.phone && <div className="text-sm text-gray-600 mt-1">{me.phone}</div>}
      {me && me.location && <div className="text-sm text-gray-600 mt-1">{me.location}</div>}
    </div>
  )
}
