import React, { useState } from 'react';

const mockOrders = [
  { id: 1, item: 'Vintage Jacket', status: 'Pending' },
  { id: 2, item: 'iPhone 12', status: 'Completed' },
  { id: 3, item: 'Harry Potter Set', status: 'Canceled' }
];

export default function OrdersPanel() {
  const [orders, setOrders] = useState(mockOrders);

  function updateStatus(id, status) {
    setOrders(orders => orders.map(o => o.id === id ? { ...o, status } : o));
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">Orders</h3>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b">
            <th className="py-2">Item</th>
            <th>Status</th>
            <th>Update</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id} className="border-b">
              <td className="py-2">{order.item}</td>
              <td>{order.status}</td>
              <td>
                <select value={order.status} onChange={e => updateStatus(order.id, e.target.value)} className="border rounded p-1">
                  <option>Pending</option>
                  <option>Completed</option>
                  <option>Canceled</option>
                  <option>Shipped</option>
                  <option>Delivered</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
