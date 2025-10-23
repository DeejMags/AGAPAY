import React from 'react';

export default function DenyModal({ open, onClose, onSubmit, initialReason = '' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
        <h3 className="text-lg font-semibold mb-2">Deny product</h3>
        <p className="text-sm text-gray-600 mb-3">Enter a reason for denying this product (will be visible to the seller).</p>
        <textarea defaultValue={initialReason} id="deny-reason" className="w-full p-2 border rounded h-28" />
        <div className="flex justify-end gap-2 mt-3">
          <button className="px-3 py-1 rounded border" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={() => {
            const val = document.getElementById('deny-reason').value;
            onSubmit(val);
          }}>Deny</button>
        </div>
      </div>
    </div>
  );
}
