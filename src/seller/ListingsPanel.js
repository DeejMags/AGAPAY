import React from 'react';

export default function ListingsPanel({ listings, onEdit, onDelete, onView, onStatusChange, disabled = false }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {listings.length ? listings.map(item => {
        const id = item._id || item.id;
        const status = (item.status || '').toLowerCase();
        const statusColor = status === 'active' ? 'bg-green-500' : status === 'pending' ? 'bg-yellow-500' : status === 'sold' ? 'bg-gray-700' : 'bg-red-500';
        return (
          <div key={id} className="bg-white rounded-lg shadow p-4 flex flex-col">
            <div className="font-semibold mb-1 truncate">{item.title}</div>
            <div className="text-xs text-gray-500 mb-2">
              {item.category}
              <span className={`ml-2 px-2 py-0.5 rounded text-white text-[10px] uppercase ${statusColor}`}>{status || 'pending'}</span>
            </div>
            <div className="text-sm text-gray-700 mb-3 line-clamp-2">{item.description}</div>
            <div className="mt-auto flex flex-col gap-2 w-full">

              <div className="flex items-center gap-2">
                <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-teal-300 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`} onClick={()=>!disabled && onView(item)}>View</button>
                <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`} onClick={()=>!disabled && onEdit(item)}>Edit</button>
                <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`} onClick={()=>!disabled && onDelete(id)}>Delete</button>
              </div>

              {(() => {
                const hasApproval = !!item.publishedAt || status === 'active';

                if (!hasApproval) return null;
                return (
                  <div className="flex items-center gap-2">
                    {status === 'active' && (
                      <>
                        <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-yellow-300 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600'}`} onClick={()=>!disabled && onStatusChange(id, 'pending')}>Set Pending</button>
                        <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-800'}`} onClick={()=>!disabled && onStatusChange(id, 'sold')}>Mark Sold</button>
                      </>
                    )}
                    {status === 'pending' && hasApproval && (
                      <button disabled={disabled} className={`px-3 py-1.5 text-xs rounded text-white ${disabled ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`} onClick={()=>!disabled && onStatusChange(id, 'active')}>Set Active</button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      }) : <div className="p-4 border rounded col-span-3">No listings yet.</div>}
    </div>
  );
}
