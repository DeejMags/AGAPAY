import React from 'react';
import ReactDOM from 'react-dom';
import deliveryIcon from '../deliverytruck.svg';
import boxIcon from '../box.svg';

export default function AdminNotifiedModal({ open, onClose, type = 'delivery', productTitle = '', productDescription = '', selectedType = null, supportsDelivery = false, supportsPickup = false }) {
  if (!open) return null;
  const which = selectedType || type;
  const node = (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 99999 }}>
      <div className="absolute inset-0 bg-black bg-opacity-40" aria-hidden="true" />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-2">Request sent</h3>
        <div className="flex items-start gap-3 mb-3">
          <img src={which === 'delivery' ? deliveryIcon : boxIcon} alt={which} className="w-6 h-6 mt-1" />
          <div className="text-sm text-gray-700">
            <div className="mb-1">Your <span className="font-medium">{which === 'delivery' ? 'Delivery' : 'Pickup'}</span> request for <span className="font-medium">{productTitle || 'this item'}</span> has been sent.</div>
            {productDescription && <div className="text-xs text-gray-500 mb-2">{productDescription}</div>}
            <div className="flex items-center gap-3 text-xs mb-2">
              <span className={`px-2 py-1 rounded ${supportsDelivery ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>Delivery: {supportsDelivery ? 'Yes' : 'No'}</span>
              <span className={`px-2 py-1 rounded ${supportsPickup ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>Pickup: {supportsPickup ? 'Yes' : 'No'}</span>
            </div>
            <div className="mt-2">An admin will review this and follow up if needed.</div>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-teal-600 text-white rounded" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return ReactDOM.createPortal(node, document.body);
  }
  return node;
}
