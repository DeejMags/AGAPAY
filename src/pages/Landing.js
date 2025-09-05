import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'

function seedProducts(){
  const demo = [
    { _id: 'p1', title: 'Vintage Camera', price: 2400, desc: 'Classic film camera', category:'electronics', location:'Manila', photo:'https://images.unsplash.com/photo-1519183071298-a2962be90b3b?auto=format&fit=crop&w=800&q=60' },
    { _id: 'p2', title: 'Mountain Bike', price: 12000, desc: 'Used mountain bike in good condition', category:'sports', location:'Cebu', photo:'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=800&q=60' },
    { _id: 'p3', title: 'Wooden Desk', price: 4500, desc: 'Solid wood desk', category:'furniture', location:'Davao', photo:'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=800&q=60' }
  ]
  localStorage.setItem('agapay_products', JSON.stringify(demo))
  return demo
}

export default function Landing(){
  const [products, setProducts] = useState([])

  useEffect(()=>{
    const stored = JSON.parse(localStorage.getItem('agapay_products') || 'null')
    if(!stored){
      const seeded = seedProducts()
      setProducts(seeded)
    }else setProducts(stored)
  },[])

  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-4">Discover great deals nearby</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {products.map(p=> <ProductCard key={p._id} product={p} />)}
        </div>
        <div className="mt-6 text-center">
          <Link to="/marketplace" className="px-4 py-2 bg-teal-600 text-white rounded">Browse Marketplace</Link>
        </div>
      </div>
    </div>
  )
}
