import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FullScreenLoader from '../components/FullScreenLoader'
// ...existing code...


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

  useEffect(()=>{
    async function fetchFromApi(){
      try{
        setLoading(true)
        const res = await fetch('/api/products')
        if(!res.ok) throw new Error('API fetch failed')
  const data = await res.json()
  // Backend may return a paged response { items: [...], page, pageSize }
  const items = Array.isArray(data) ? data : (data.items || []);
  setProducts(items)
      }catch(err){
        // fallback to Firestore client only (do not use localStorage demo data)
        try {
          const { collection, getDocs } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          const snap = await getDocs(collection(db, 'products'));
          const firebaseProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setProducts(firebaseProducts);
        } catch (e) {
          console.warn('Failed to load products from backend and Firestore', e);
          setProducts([]);
        }
      }finally{
        setLoading(false)
      }
    }
    fetchFromApi()
  },[])

  if(loading) {
    return <FullScreenLoader />
  }

  return (
    <div className="pt-0 overflow-x-clip">
      {/* Full-bleed About/Hero section */}
      <section id="about" className="relative w-full bg-gray-50 full-bleed overflow-x-clip">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-teal-500 mb-6 flex items-center justify-center gap-2"
            data-aos="fade-down"
            data-aos-delay="100"
          >
            <span>About Agapay</span>
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 w-full max-w-4xl mx-auto">
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
            className="text-lg sm:text-2xl md:text-3xl font-bold text-teal-400 mt-10 mb-6"
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
        </div>
      </section>

      {/* Products grid section inside centered container */}
      <div className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-4">Discover great deals nearby</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
          {(Array.isArray(products) ? products : [])
            .filter(p => !p.status || p.status !== 'Delivered')
            .map(p=> <ProductCard key={p._id || p.id} product={p} />)}
        </div>
        <div className="mt-6 text-center">
          <button
            className="px-4 py-2 bg-teal-600 text-white rounded"
            onClick={() => {
              setLoading(true);
              setTimeout(() => { navigate('/marketplace'); }, 600);
            }}
          >
            Browse Marketplace
          </button>
        </div>
      </div>

      {/* Contact and FAQs sections below the product grid */}
      <Contact />
      <FAQs />
    </div>
  )
}
