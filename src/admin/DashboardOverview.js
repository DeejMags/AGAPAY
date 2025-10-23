import React from 'react';
export default function DashboardOverview({ users, products, orders, messages, points }) {
  // normalize inputs: they can be arrays or paged responses { items: [] }
  const usersArr = users ? (Array.isArray(users) ? users : (users.items || [])) : [];
  const productsArr = products ? (Array.isArray(products) ? products : (products.items || [])) : [];
  const messagesArr = messages ? (Array.isArray(messages) ? messages : (messages.items || [])) : [];

  const stats = [
    { label: 'Total Users', value: usersArr.length },
    { label: 'Total Products', value: productsArr.length },
    { label: 'Unread Messages', value: messagesArr.filter(m => m.unread || m.status === 'Flagged').length },
    
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {stats.map((stat, i) => (
        <div key={i} className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <div className="text-2xl font-bold text-teal-600 mb-2">{stat.value}</div>
          <div className="text-gray-700 text-lg">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
