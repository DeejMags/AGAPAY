import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import RatingStars from '../components/RatingStars'
import ProductCard from "../components/ProductCard";

export default function ProductDetail(){
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [seller, setSeller] = useState(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()

  useEffect(()=>{
    setLoading(true)
    const t = setTimeout(()=>{
      const products = JSON.parse(localStorage.getItem('agapay_products') || '[]')
      const p = products.find(x=> x._id === id)
      setProduct(p)
      if(p && p.sellerId){
        const users = JSON.parse(localStorage.getItem('agapay_users') || '[]')
        const s = users.find(u=> u.id === p.sellerId)
        setSeller(s)
      }
      setLoading(false)
    }, 600) // simulate loading
    return ()=> clearTimeout(t)
  },[id])

  function submitRating(){
    const cur = JSON.parse(localStorage.getItem('user') || 'null')
    if(!cur) return alert('Login to leave a rating')
    if(!seller) return
    const users = JSON.parse(localStorage.getItem('agapay_users') || '[]')
    const idx = users.findIndex(u=>u.id===seller.id)
    if(idx<0) return
    users[idx].ratings = users[idx].ratings || []
    // dedupe: if reviewer already rated, update their rating
    const existingIdx = users[idx].ratings.findIndex(r => r.reviewerId === cur.id)
    if(existingIdx >= 0){
      users[idx].ratings[existingIdx] = { reviewerId: cur.id, ratingValue: Number(rating), comment }
    } else {
      users[idx].ratings.push({ reviewerId: cur.id, ratingValue: Number(rating), comment })
    }
    localStorage.setItem('agapay_users', JSON.stringify(users))
    setSeller(users[idx])
    setComment('')
    alert('Rating submitted')
  }

  function openChat(){
    // navigate to messages and pre-select product via a query param
    navigate('/messages')
    setTimeout(()=>{
      // store a marker so Messages can auto-select
      localStorage.setItem('agapay_active_conv', id)
      window.location.reload()
    }, 50)
  }

  if(loading) return (
    <div className="py-8 container mx-auto px-4">
      <div className="animate-pulse">
        <div className="h-96 bg-gray-200 rounded" />
        <div className="h-6 bg-gray-200 mt-4 rounded w-1/3" />
        <div className="h-4 bg-gray-200 mt-2 rounded w-1/4" />
      </div>
    </div>
  )

  if(!product) return <div className="py-8 container mx-auto px-4">Product not found</div>

  const images = Array.isArray(product.photo) ? product.photo : (product.photo ? [product.photo] : [])

  const recommended = (JSON.parse(localStorage.getItem('agapay_products') || '[]') || []).filter(p=> p._id !== product._id && p.category === product.category).slice(0,4)

  return (
    <div className="py-8 container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="bg-gray-100 rounded overflow-hidden">
          {images.length > 1 ? (
            <div className="relative">
              <img src={images[index]} alt={`${product.title} - image ${index + 1}`} className="w-full h-96 object-cover" />
              <button onClick={()=>setIndex(i=> Math.max(0,i-1))} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded">‹</button>
              <button onClick={()=>setIndex(i=> Math.min(images.length-1,i+1))} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded">›</button>
              <div className="flex gap-2 p-2 overflow-auto bg-white">
                {images.map((im,i)=> <img key={i} src={im} alt={`${product.title} thumbnail ${i+1}`} onClick={()=>setIndex(i)} className={`w-20 h-14 object-cover rounded cursor-pointer ${i===index? 'ring-2 ring-teal-500' : ''}`} />)}
              </div>
            </div>
          ) : (
            <img src={images[0] || ''} alt={`${product.title} - image 1`} className="w-full h-96 object-cover" />
          )}
        </div>
        <h1 className="text-2xl font-bold mt-4">{product.title}</h1>
        <div className="text-xl text-teal-600">\u20b1{product.price}</div>
        <div className="mt-3 text-gray-700">{product.desc}</div>
        <div className="mt-2 text-sm text-gray-500">Category: {product.category} \u00b7 Location: {product.location}</div>
      </div>
      <aside className="md:col-span-1">
        <div className="p-4 border rounded">
          <div className="flex items-center gap-3">
            <img src={seller?.profilePic || ''} alt={seller ? `${seller.username} profile` : 'Seller profile'} className="w-12 h-12 bg-gray-200 rounded-full object-cover" />
            <div>
              <div className="font-semibold">{seller ? seller.username : 'Seller'}</div>
              <div className="text-xs text-gray-500">{seller ? seller.email : ''}</div>
            </div>
          </div>
          <button onClick={openChat} className="mt-3 w-full p-2 bg-teal-600 text-white rounded">Message Seller</button>
          <button onClick={()=> navigate(`/profile/${seller?.id}`)} className="mt-2 w-full p-2 border rounded">View seller profile</button>
        </div>

        <div className="mt-4 p-4 border rounded">
          <h3 className="font-semibold">Ratings</h3>
          <div className="mt-2">
            {seller && (seller.ratings || []).length ? seller.ratings.map((r,i)=> (
              <div key={i} className="border-b py-2">
                <RatingStars value={r.ratingValue} />
                <div className="text-sm text-gray-600">{r.comment}</div>
              </div>
            )) : <div className="text-sm text-gray-500">No ratings yet</div>}
          </div>

          <div className="mt-3">
            <h4 className="text-sm font-semibold">Leave a rating</h4>
            <select value={rating} onChange={e=>setRating(e.target.value)} className="w-full p-2 border rounded mt-2">
              <option value={5}>5</option>
              <option value={4}>4</option>
              <option value={3}>3</option>
              <option value={2}>2</option>
              <option value={1}>1</option>
            </select>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} className="w-full p-2 border rounded mt-2" placeholder="Optional comment" />
            <button onClick={submitRating} className="mt-2 w-full p-2 bg-teal-600 text-white rounded">Submit rating</button>
          </div>
        </div>
      </aside>

      {recommended.length > 0 && (
        <div className="md:col-span-3 mt-6">
          <h3 className="font-semibold">Recommended for you</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {recommended.map(r=> <ProductCard key={r._id} product={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
