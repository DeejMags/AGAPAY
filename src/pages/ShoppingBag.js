import React, { useState } from 'react';
import { useCart } from '../components/CartContext';
import { Link } from 'react-router-dom';

export default function ShoppingBag() {
  const { cart, setCart } = useCart();
  // Group items by _id and count quantity
  function getGrouped(cartArr) {
    return Object.values(cartArr.reduce((acc, item) => {
      const id = item._id;
      if (!acc[id]) acc[id] = { ...item, quantity: 0 };
      acc[id].quantity += 1;
      return acc;
    }, {}));
  }
  const items = getGrouped(cart);

  // Selection state for each item
  const [selected, setSelected] = useState(() => {
    const obj = {};
    items.forEach(item => { obj[item._id] = true; });
    return obj;
  });

  // Always update selection state if items change (e.g. after remove)
  React.useEffect(() => {
    setSelected(prev => {
      const obj = { ...prev };
      items.forEach(item => {
        if (!(item._id in obj)) obj[item._id] = true;
      });
      // Remove keys for items no longer present
      Object.keys(obj).forEach(id => {
        if (!items.find(i => i._id === id)) delete obj[id];
      });
      return obj;
    });
  }, [items.length]);

  function updateQuantity(id, qty) {
    if (qty < 1) return;
    setCart(prev => {
      const groupedPrev = getGrouped(prev);
      const item = groupedPrev.find(i => i._id === id);
      const others = prev.filter(i => i._id !== id);
      return [...others, ...Array(qty).fill(item)];
    });
  }

  function removeItem(id) {
    setCart(prev => prev.filter(item => item._id !== id));
    setSelected(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function toggleSelect(id) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAll(val) {
    const obj = {};
    items.forEach(item => { obj[item._id] = val; });
    setSelected(obj);
  }

  // Only selected items are included in checkout/total
  const selectedItems = items.filter(item => selected[item._id]);
  const total = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="py-4 flex justify-center items-start w-full min-h-[60vh]">
      <div className="w-full max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Shopping Bag</h1>
        {items.length === 0 ? (
          <div className="text-gray-500">Your bag is empty.</div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-0 border border-gray-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100 text-gray-700 border-b">
                  <th className="p-3 text-center w-10">
                    <input type="checkbox" checked={Object.values(selected).every(Boolean)} onChange={e => selectAll(e.target.checked)} />
                  </th>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-center">Unit Price</th>
                  <th className="p-3 text-center">Quantity</th>
                  <th className="p-3 text-center">Total Price</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item._id} className="bg-white hover:bg-gray-50 transition border-b last:border-b-0">
                    <td className="p-3 text-center align-middle">
                      <input type="checkbox" checked={!!selected[item._id]} onChange={() => toggleSelect(item._id)} />
                    </td>
                    <td className="p-3 align-middle">
                      <div className="flex items-center gap-3">
                        <img src={item.photo || '/assets/AGAPAY logo.png'} alt={item.title} className="w-16 h-16 object-cover rounded border" />
                        <div className="flex flex-col justify-center">
                          <span className="font-semibold text-base leading-tight">{item.title}</span>
                          <span className="text-xs text-gray-500 leading-tight">{item.desc}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center align-middle">₱{item.price}</td>
                    <td className="p-3 text-center align-middle">
                      <div className="inline-flex items-center gap-1 border rounded px-2 py-1 bg-gray-50">
                        <button className="px-2 py-1 bg-gray-200 rounded font-bold" onClick={()=>updateQuantity(item._id, item.quantity-1)} disabled={item.quantity <= 1}>-</button>
                        <span className="font-bold px-2">{item.quantity}</span>
                        <button className="px-2 py-1 bg-gray-200 rounded font-bold" onClick={()=>updateQuantity(item._id, item.quantity+1)}>+</button>
                      </div>
                    </td>
                    <td className="p-3 text-center font-bold text-teal-600 align-middle">₱{item.price * item.quantity}</td>
                    <td className="p-3 text-center align-middle">
                      <button className="text-red-600 hover:underline font-semibold" onClick={()=>removeItem(item._id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-col sm:flex-row justify-between items-center mt-2 mb-1 gap-2 border-t pt-4 px-4">
              <div className="font-bold text-lg">Total: ₱{total}</div>
              <Link to={selectedItems.length > 0 ? "/checkout" : "#"} className={`px-4 py-2 bg-teal-600 text-white rounded shadow min-w-[180px] text-center ${selectedItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>Proceed to Checkout</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
