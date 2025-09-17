import React from 'react';

export default function ListingsPanel({ listings, onEdit, onDelete, onView }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {listings.length ? listings.map(item => (
        <div key={item.id} className="bg-white rounded-lg shadow p-4 flex flex-col">
          <div className="font-semibold mb-1 truncate">{item.title}</div>
          <div className="text-xs text-gray-500 mb-2">{item.category} <span className={`ml-2 px-2 py-1 rounded text-white text-xs ${item.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}>{item.status}</span></div>
          <div className="text-sm text-gray-700 mb-2">{item.description}</div>
          <div className="flex gap-2 mt-auto">
            <button className="text-teal-600 hover:underline text-sm" onClick={()=>onView(item)}>View</button>
            <button className="text-blue-600 hover:underline text-sm" onClick={()=>onEdit(item)}>Edit</button>
            <button className="text-red-600 hover:underline text-sm" onClick={()=>onDelete(item.id)}>Delete</button>
          </div>
        </div>
      )) : <div className="p-4 border rounded col-span-3">No listings yet.</div>}
    </div>
  );
}
