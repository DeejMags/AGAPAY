import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProductCard({ product, index }) {
  const navigate = useNavigate();
  const primary = (product.imageUrl && String(product.imageUrl))
    || (Array.isArray(product.photo) ? product.photo[0] : product.photo)
    || `https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=60`;
  const [loadingNav, setLoadingNav] = useState(false);
  const [rating, setRating] = useState(0);

  function goToDetail(e) {
    e.preventDefault();
    setLoadingNav(true);
    setTimeout(() => {
      navigate(`/product/${product._id || product.id}`);
    }, 450);
  }

  // Derive a concise, human-friendly location label
  const locationLabel = useMemo(() => {
    const loc = product && product.location;
    if (!loc) return '';
    if (typeof loc === 'string') return loc.trim();
    if (typeof loc === 'object') {
      if (loc.address && typeof loc.address === 'string') return loc.address;
      const parts = [loc.barangay || loc.district, loc.city || loc.municipality, loc.state || loc.province, loc.country]
        .map(v => (v ? String(v).trim() : ''))
        .filter(Boolean);
      if (parts.length) return parts.join(', ');
      if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}`;
      }
    }
    return '';
  }, [product]);

  return (
  <a href={`/product/${product._id || product.id}`} onClick={goToDetail} className="block border rounded overflow-hidden hover:shadow-lg transform hover:scale-102 transition duration-200 bg-white animate-slideUp" data-index={index}>
    <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden relative">
      <img src={primary} alt={product.title} className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" />
      {loadingNav && <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center"><div className="loader w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>}
    </div>
    <div className="p-3">
      <h3 className="font-semibold truncate">{product.title}</h3>
      <p className="text-sm text-gray-600">₱{product.price} <span className="text-xs text-gray-500">· {product.category}</span></p>
      {product.desc && <p className="text-xs text-gray-500 mt-1 truncate">{product.desc}</p>}
      {locationLabel && (
        <div className="mt-2 text-xs text-gray-600 flex items-center gap-1" title={locationLabel}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-teal-600 flex-shrink-0">
            <path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
          </svg>
          <span className="truncate max-w-full">{locationLabel}</span>
        </div>
      )}
      <div className="mt-2 text-xs text-blue-600 cursor-pointer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/profile/${product.sellerId}`) }}>View seller</div>
      {(product.delivery || product.pickup) && (
        <div className="mt-2 flex gap-2">
          {product.delivery && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM5 11l1.5-4.5h11L19 11H5z"/></svg>
              Delivery
            </span>
          )}
          {product.pickup && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-teal-600 text-xs rounded">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 16V8a2 2 0 0 0-1-1.73L13 3 4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73L11 21l9-3.27A2 2 0 0 0 21 16z" stroke-width="1.5"/>
        <path d="M3.27 6.96L12 10l8.73-3.04" stroke-width="1.2"/>
</svg>              Pickup
            </span>
          )}
        </div>
      )}
      <button
        className="mt-3 w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700 transition font-semibold"
        onClick={e => {
          e.preventDefault();
          navigate(`/product/${product._id || product.id}`);
        }}
      >
        View Item
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
}
