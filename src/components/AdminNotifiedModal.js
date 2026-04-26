import React from 'react';

export default function AdminNotifiedModal({ open, onClose, type = 'delivery', productTitle = '' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-2">Request sent</h3>
        <p className="text-sm text-gray-700 mb-4">Your {type} request for <span className="font-medium">{productTitle || 'this item'}</span> has been sent. An admin will review this and follow up if needed.</p>
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-teal-600 text-white rounded" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
