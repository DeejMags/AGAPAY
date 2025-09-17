import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from './CartContext';

export default function ProductCard({ product, index }) {
  const navigate = useNavigate();
  const primary = Array.isArray(product.photo) ? product.photo[0] : (product.photo || `https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=60`);
  const [loadingNav, setLoadingNav] = useState(false);
  const { addToCart } = useCart();
  const [delivered, setDelivered] = useState(false); // Simulate delivery
  const [rating, setRating] = useState(0);

  function goToDetail(e) {
    e.preventDefault();
    setLoadingNav(true);
    setTimeout(() => {
      navigate(`/product/${product._id}`);
    }, 450);
  }

  return (
    <a href={`/product/${product._id}`} onClick={goToDetail} className="block border rounded overflow-hidden hover:shadow-lg transform hover:scale-102 transition duration-200 bg-white animate-slideUp" data-index={index}>
      <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden relative">
        <img src={primary} alt={product.title} className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" />
        {loadingNav && <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center"><div className="loader w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>}
      </div>
      <div className="p-3">
        <h3 className="font-semibold truncate">{product.title}</h3>
        <p className="text-sm text-gray-600">₱{product.price} <span className="text-xs text-gray-500">· {product.category}</span></p>
        {product.desc && <p className="text-xs text-gray-500 mt-1 truncate">{product.desc}</p>}
        <div className="mt-2 text-xs text-gray-600">Location: {product.location || 'N/A'}</div>
        <div className="mt-2 text-xs text-blue-600 cursor-pointer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/profile/${product.sellerId}`) }}>View seller</div>
        <button
          className="mt-3 w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700 transition font-semibold"
          onClick={e => { e.preventDefault(); addToCart(product); }}
        >
          Add to Bag
        </button>
        {/* Rating UI only, no delivery button */}
        <div className="mt-2 flex items-center gap-1">
          <span className="text-xs">Rate this product:</span>
          {[1,2,3,4,5].map(star => (
            <button
              key={star}
              className={`text-yellow-400 text-lg ${star <= rating ? '' : 'opacity-30'}`}
              onClick={e => { e.preventDefault(); setRating(star); }}
            >★</button>
          ))}
          {rating > 0 && <span className="ml-2 text-xs text-teal-600">Thank you!</span>}
        </div>
      </div>
    </a>
  );
// ...existing code...
}
