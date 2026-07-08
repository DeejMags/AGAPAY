import React from 'react';

export default function ListingsPanel({ listings, onEdit, onDelete, onView, onStatusChange, onMarkSold, disabled = false }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {listings.length ? listings.map(item => {
        const id = item._id || item.id;
        const status = (item.status || '').toLowerCase();
        const statusColor = status === 'active' ? 'bg-green-500' : status === 'pending' ? 'bg-yellow-500' : status === 'sold' ? 'bg-gray-700' : 'bg-red-500';
        const locationLabel = (() => {
          const loc = item && item.location;
          if (!loc && (typeof item.locationLat !== 'number' || typeof item.locationLng !== 'number')) return '';
          if (typeof loc === 'string' && loc.trim()) return loc.trim();
          if (loc && typeof loc === 'object') {
            if (typeof loc.address === 'string' && loc.address.trim()) return loc.address.trim();
            const parts = [loc.barangay || loc.district, loc.city || loc.municipality, loc.state || loc.province, loc.country]
              .map(v => (v ? String(v).trim() : ''))
              .filter(Boolean);
            if (parts.length) return parts.join(', ');
          }
          if (typeof item.locationLat === 'number' && typeof item.locationLng === 'number') {
            return `${item.locationLat.toFixed(3)}, ${item.locationLng.toFixed(3)}`;
          }
          return '';
        })();
        return (
          <div key={id} className={`bg-white rounded-lg shadow p-4 flex flex-col relative ${status === 'sold' ? 'opacity-80' : ''}`}>
            {/* SOLD overlay banner */}
            {status === 'sold' && (
              <div className="absolute top-2 left-2 right-2 z-10 bg-green-600 text-white text-center text-xs font-bold py-1 rounded shadow">
                ✓ SOLD
              </div>
            )}
            {/* Image */}
            <div className="w-full h-40 mb-3 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
              <img src={
                  item.imageUrl || (Array.isArray(item.photo) && item.photo[0]) || item.photo || item.image || 'https://via.placeholder.com/400x300'}
                alt={item.title || 'product'}
                className={`w-full h-full object-cover ${status === 'sold' ? 'grayscale' : ''}`}
              />
            </div>
            <div className="font-semibold mb-1 truncate">{item.title}</div>
            <div className="text-xs text-gray-500 mb-2">
              {item.category}
              <span className={`ml-2 px-2 py-0.5 rounded text-white text-[10px] uppercase ${statusColor}`}>{status || 'pending'}</span>
            </div>
            {locationLabel && (
              <div className="-mt-1 mb-2 text-xs text-gray-600 flex items-center gap-1" title={locationLabel}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-teal-600 flex-shrink-0">
                  <path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
                </svg>
                <span className="truncate max-w-full">{locationLabel}</span>
              </div>
            )}
            <div className="text-sm text-gray-700 mb-3 line-clamp-2">{item.description}</div>
            <div className="mt-auto flex flex-col gap-2 w-full">

              <div className="flex items-center gap-2">
                <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-teal-300 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`} onClick={()=>!disabled && onView(item)}>View</button>
                <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`} onClick={()=>!disabled && onEdit(item)}>Edit</button>
                {status !== 'sold' && (
                  <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`} onClick={()=>!disabled && onDelete(id)}>Delete</button>
                )}
              </div>

              {(() => {
                const hasApproval = !!item.publishedAt || status === 'active';

                if (!hasApproval) return null;
                return (
                  <div className="flex items-center gap-2">
                    {status === 'active' && (
                      <>
                        <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-yellow-300 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600'}`} onClick={()=>!disabled && onStatusChange(id, 'pending')}>Set Pending</button>
                        <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-800'}`} onClick={()=>{
                          if (disabled) return;
                          if (typeof onMarkSold === 'function') onMarkSold(item);
                          else onStatusChange && onStatusChange(id, 'sold');
                        }}>Mark Sold</button>
                      </>
                    )}
                    {status === 'pending' && hasApproval && (
                      <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`} onClick={()=>!disabled && onStatusChange(id, 'active')}>Set Active</button>
                    )}
                  </div>
                );
              })()}
            </div>
            {/* Small static map preview when location is present */}
            {(item.locationLat !== undefined && item.locationLng !== undefined && item.locationLat !== null && item.locationLng !== null) && (
              <div className="mt-3 w-full h-28 rounded overflow-hidden border">
                <img
                  alt="location map"
                  src={`https://staticmap.openstreetmap.de/staticmap.php?center=${item.locationLat},${item.locationLng}&zoom=13&size=600x300&markers=${item.locationLat},${item.locationLng},red-pushpin`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        );
      }) : <div className="p-4 border rounded col-span-3">No listings yet.</div>}
    </div>
  );
}
