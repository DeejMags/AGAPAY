import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FullScreenLoader from '../components/FullScreenLoader'
import { Link } from 'react-router-dom'


import ProductCard from '../components/ProductCard'
// About section details moved here from About.js
import Contact from './Contact'
import FAQs from './FAQs'


export default function Landing(){
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && user.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [navigate]);

  function seedProducts(){
    const demo = [
      { _id: 'p1', title: 'Vintage Camera', price: 2400, desc: 'Classic film camera', category:'electronics', location:'Manila', photo:'https://images.unsplash.com/photo-1519183071298-a2962be90b3b?auto=format&fit=crop&w=800&q=60' },
      { _id: 'p2', title: 'Mountain Bike', price: 12000, desc: 'Used mountain bike in good condition', category:'sports', location:'Cebu', photo:'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=800&q=60' },
      { _id: 'p3', title: 'Wooden Desk', price: 4500, desc: 'Solid wood desk', category:'furniture', location:'Davao', photo:'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=800&q=60' },
      { _id: 'p4', title: 'Smartphone', price: 8000, desc: 'Latest model, barely used', category:'electronics', location:'Quezon City', photo:'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=60' },
      { _id: 'p5', title: 'Running Shoes', price: 2200, desc: 'Comfortable and stylish', category:'fashion', location:'Makati', photo:'https://images.unsplash.com/photo-1519864600265-abb224a0f7c4?auto=format&fit=crop&w=800&q=60' },
      { _id: 'p6', title: 'Coffee Table', price: 3200, desc: 'Modern design, solid wood', category:'furniture', location:'Taguig', photo:'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=60' },
      { _id: 'p7', title: 'Air Conditioner', price: 15000, desc: 'Energy efficient, 1.5HP', category:'home', location:'Pasig', photo:'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=60' },
      { _id: 'p8', title: 'Tennis Racket', price: 1800, desc: 'Lightweight, great for beginners', category:'sports', location:'Caloocan', photo:'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=60' },
      { _id: 'p9', title: 'Designer Bag', price: 6500, desc: 'Authentic, gently used', category:'fashion', location:'San Juan', photo:'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=60' },
      { _id: 'p10', title: 'Guitar', price: 3500, desc: 'Acoustic, perfect for beginners', category:'home', location:'Paranaque', photo:'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=60' }
    ]
    localStorage.setItem('agapay_products', JSON.stringify(demo))
    return demo
  }

  useEffect(()=>{
    const stored = JSON.parse(localStorage.getItem('agapay_products') || 'null')
    if(!stored){
      const seeded = seedProducts()
      setProducts(seeded)
    }else setProducts(stored)
  },[])

  if(loading) {
    return <FullScreenLoader />
  }

  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        {/* About section directly below navbar, inside main container */}
        <section
          id="about"
          className="py-10 md:py-16 px-2 sm:px-4 md:px-8 lg:px-16 xl:px-32 bg-gray-50 text-center flex flex-col items-center w-full mx-auto"
          style={{ width: '100%' }}
        >
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-teal-500 mb-4 flex items-center justify-center gap-2 mt-20"
            data-aos="fade-down"
            data-aos-delay="100"
          >
            <span>About Agapay</span>
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-10 w-full max-w-4xl mx-auto">
            {/* Feature List */}
            <ul className="text-left text-base sm:text-lg text-gray-800 font-semibold space-y-3 sm:space-y-4 flex-1">
              <li className="flex items-center gap-2" data-aos="fade-right" data-aos-delay="200">
                <span role="img" aria-label="Gift">✔️</span>
                Donate & request
              </li>
              <li className="flex items-center gap-2" data-aos="fade-right" data-aos-delay="300">
                <span role="img" aria-label="Location">✔️</span>
                Locate waste facilities
              </li>
              <li className="flex items-center gap-2" data-aos="fade-right" data-aos-delay="400">
                <span role="img" aria-label="Chart">✔️</span>
                Track your waste impact
              </li>
              <li className="flex items-center gap-2" data-aos="fade-right" data-aos-delay="500">
                <span role="img" aria-label="Money">✔️</span>
                Earn cash from trash
              </li>
            </ul>
          </div>
          {/* Key Features */}
          <h3
            className="text-lg sm:text-2xl md:text-3xl font-bold text-teal-400 mt-8 md:mt-12 mb-4 md:mb-6"
            data-aos="fade-down"
            data-aos-delay="400"
          >
            Discover our key features
          </h3>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto w-full"
            data-aos="fade-up"
            data-aos-delay="500"
          >
            <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="600">
              <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Donate">🎁</span>
              <span className="font-semibold text-teal-500 text-base sm:text-lg">Donate</span>
            </div>
            <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="700">
              <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Request">🙋‍♂️</span>
              <span className="font-semibold text-teal-500 text-base sm:text-lg">Request</span>
            </div>
            <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="800">
              <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Earn">💸</span>
              <span className="font-semibold text-teal-500 text-base sm:text-lg">Earn</span>
            </div>
            <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="900">
              <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Track">📊</span>
              <span className="font-semibold text-teal-500 text-base sm:text-lg">Track</span>
            </div>
            <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="1000">
              <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Locate">📍</span>
              <span className="font-semibold text-teal-500 text-base sm:text-lg">Locate</span>
            </div>
            <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="1100">
              <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Circulate">♻️</span>
              <span className="font-semibold text-teal-500 text-base sm:text-lg">Circulate</span>
            </div>
          </div>
        </section>
        <h1 className="text-3xl font-bold mb-4">Discover great deals nearby</h1>
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
          {products
            .filter(p => !p.status || p.status !== 'Delivered')
            .map(p=> <ProductCard key={p._id} product={p} />)}
        </div>
        <div className="mt-6 text-center">
          <button className="px-4 py-2 bg-teal-600 text-white rounded" onClick={()=>{
            setLoading(true);
            setTimeout(()=>{ navigate('/marketplace'); }, 600);
          }}>Browse Marketplace</button>
        </div>
      </div>
      {/* Contact and FAQs sections below the product grid */}
      <Contact />
      <FAQs />
    </div>
  )
}
