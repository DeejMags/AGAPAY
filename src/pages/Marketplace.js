import React, { useEffect, useMemo, useState } from 'react'
import ProductCard from '../components/ProductCard'
import SearchIcon from '../components/SearchIcon'

export default function Marketplace(){
  const [products, setProducts] = useState([])
  // main filter state
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  // sidebar filter state (no sidebarQuery)
  const [sidebarLocation, setSidebarLocation] = useState('')
  const [sidebarMinPrice, setSidebarMinPrice] = useState('')
  const [sidebarMaxPrice, setSidebarMaxPrice] = useState('')
  const [sidebarRating, setSidebarRating] = useState('')

  useEffect(()=>{
    const stored = JSON.parse(localStorage.getItem('agapay_products') || '[]')
    setProducts(stored)
  },[])

  const filtered = useMemo(()=>{
  let res = products.filter(p=>{
      if(query && !p.title.toLowerCase().includes(query.toLowerCase()) && !(p.desc||'').toLowerCase().includes(query.toLowerCase())) return false
      if(category && p.category !== category) return false
  // location filter: allow case-insensitive partial matches and handle missing values
  if(location && !((p.location || '').toString().toLowerCase().includes(location.toString().toLowerCase().trim()))) return false
      if(minPrice && Number(p.price) < Number(minPrice)) return false
      if(maxPrice && Number(p.price) > Number(maxPrice)) return false
      return true
  })

  if(sortBy === 'low') res = res.sort((a,b)=>Number(a.price)-Number(b.price))
  if(sortBy === 'high') res = res.sort((a,b)=>Number(b.price)-Number(a.price))
  if(sortBy === 'alpha') res = res.sort((a,b)=> (a.title||'').toString().toLowerCase().localeCompare((b.title||'').toString().toLowerCase()))
  if(sortBy === 'newest') res = res.sort((a,b)=> (b._id||'').localeCompare(a._id||'') )

  return res
  },[products, query, category, location, minPrice, maxPrice, sortBy])

  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        {/* categories pill bar */}
        <div className="overflow-auto py-2">
          <div className="flex gap-2">
            {['All','electronics','fashion','furniture','home','sports','services'].map(cat => (
              <button key={cat} onClick={()=> setCategory(cat==='All' ? '' : cat)} className={`px-3 py-1 rounded-full border ${category === (cat==='All' ? '' : cat) ? 'bg-teal-600 text-white' : 'bg-white text-gray-700'}`}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <aside className="md:col-span-1">
            <div className="p-4 border rounded bg-white">
              <h3 className="font-semibold mb-2">Filters</h3>
              <div className="mb-3">
                <input placeholder="Location" className="w-full p-2 border rounded" value={sidebarLocation} onChange={e=>setSidebarLocation(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="block text-sm mb-1">Price range</label>
                <div className="flex gap-2 mb-2">
                  <input type="number" min="0" placeholder="Min" className="w-1/2 p-2 border rounded" value={sidebarMinPrice} onChange={e=>setSidebarMinPrice(e.target.value)} />
                  <input type="number" min="0" placeholder="Max" className="w-1/2 p-2 border rounded" value={sidebarMaxPrice} onChange={e=>setSidebarMaxPrice(e.target.value)} />
                </div>
                <button className="w-full p-2 bg-teal-600 text-white rounded" onClick={()=>{ setMinPrice(sidebarMinPrice); setMaxPrice(sidebarMaxPrice); }}>Apply</button>
              </div>
              <div className="mb-3">
                <label className="block text-sm mb-1">Ratings</label>
                <select className="w-full p-2 border rounded" value={sidebarRating} onChange={e=>setSidebarRating(e.target.value)}>
                  <option value="">All ratings</option>
                  <option value="1">1 star & up</option>
                  <option value="2">2 stars & up</option>
                  <option value="3">3 stars & up</option>
                  <option value="4">4 stars & up</option>
                  <option value="5">5 stars</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm mb-1">Category</label>
                <select className="w-full p-2 border rounded" value={category} onChange={e=>setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  <option value="electronics">Electronics</option>
                  <option value="furniture">Furniture</option>
                  <option value="sports">Sports</option>
                  <option value="fashion">Fashion</option>
                  <option value="home">Home</option>
                  <option value="services">Services</option>
                </select>
              </div>
            </div>
          </aside>
          <div className="md:col-span-3">
            <div className="flex gap-2 items-center mb-2">
              <div className="relative flex-1">
                <input placeholder="Search products..." className="w-full p-2 border rounded pl-9" value={query} onChange={e=>setQuery(e.target.value)} />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SearchIcon />
                </span>
              </div>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="p-2 border rounded">
                <option value="newest">Newest</option>
                <option value="alpha">Alphabetical (A → Z)</option>
                <option value="low">Lowest price</option>
                <option value="high">Highest price</option>
              </select>
            </div>
            <h2 className="mt-2 text-xl font-semibold">All listings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
              {filtered.map((i, idx)=> <ProductCard key={i._id} product={i} index={idx} style={{ ['--delay']: `${idx * 60}ms` }} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}