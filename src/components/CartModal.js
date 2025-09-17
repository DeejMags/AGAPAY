import React from 'react';
import { useCart } from './CartContext';

export default function CartModal({ open, onClose }) {
  const { cart } = useCart();
  if (!open) return null;
  // Group items by _id and count quantity
  const grouped = cart.reduce((acc, item) => {
    const id = item._id;
    if (!acc[id]) acc[id] = { ...item, quantity: 0 };
    acc[id].quantity += 1;
    return acc;
  }, {});
  const items = Object.values(grouped);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative">
        <button className="absolute top-2 right-2 text-gray-500 hover:text-teal-600" onClick={onClose}>&times;</button>
        <h2 className="text-xl font-bold mb-4">Shopping Bag</h2>
        {items.length === 0 ? (
          <div className="text-gray-500">Your bag is empty.</div>
        ) : (
          <ul className="divide-y">
            {items.map(item => (
              <li key={item._id} className="py-3 flex justify-between items-center">
                <div>
                  <div className="font-semibold">{item.title}</div>
                  <div className="text-xs text-gray-500">₱{item.price} x {item.quantity}</div>
                </div>
                <div className="text-sm font-bold text-teal-600">₱{item.price * item.quantity}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
