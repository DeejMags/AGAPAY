import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function ProductCard({product, index}){
  const navigate = useNavigate()
  const primary = Array.isArray(product.photo) ? product.photo[0] : (product.photo || `https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=60`)
  const [loadingNav, setLoadingNav] = React.useState(false)

  function goToDetail(e){
    // allow link click to proceed normally
    // but we want a tiny delay to show a loading state for UX
    e.preventDefault()
    setLoadingNav(true)
    setTimeout(()=>{
      navigate(`/product/${product._id}`)
    }, 450)
  }

  return (
    <a href={`/product/${product._id}`} onClick={goToDetail} className={`block border rounded overflow-hidden hover:shadow-lg transform hover:scale-102 transition duration-200 bg-white animate-slideUp`} data-index={index}>
      <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden relative">
        <img src={primary} alt={product.title} className={`w-full h-full object-cover transition-transform duration-300 hover:scale-105`} />
        {loadingNav && <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center"><div className="loader w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>}
      </div>
      <div className="p-3">
        <h3 className="font-semibold truncate">{product.title}</h3>
        <p className="text-sm text-gray-600">\u20b1{product.price} <span className="text-xs text-gray-500">\u00b7 {product.category}</span></p>
        {product.desc && <p className="text-xs text-gray-500 mt-1 truncate">{product.desc}</p>}
        <div className="mt-2 text-xs text-gray-600">Location: {product.location || 'N/A'}</div>
        <div className="mt-2 text-xs text-blue-600 cursor-pointer" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); navigate(`/profile/${product.sellerId}`) }}>View seller</div>
      </div>
    </a>
  )
}
