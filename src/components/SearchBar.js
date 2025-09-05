import React from 'react'

export default function SearchBar(){
  return (
    <div className="bg-white p-4 rounded shadow flex gap-2">
      <input className="flex-1 p-2 border rounded" placeholder="Search items, categories..." />
      <input className="w-40 p-2 border rounded" placeholder="Location" />
      <button className="px-4 bg-blue-600 text-white rounded">Search</button>
    </div>
  )
}
