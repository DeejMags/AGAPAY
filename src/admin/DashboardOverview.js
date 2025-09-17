import React from 'react';
export default function DashboardOverview({ users, products, orders, messages, points }) {
  const stats = [
    { label: 'Total Users', value: users.length },
    { label: 'Total Products', value: products.length },
    { label: 'Total Transactions', value: orders.length },
    { label: 'Unread Messages', value: messages.filter(m => m.unread || m.status === 'Flagged').length },
    { label: 'Points Summary', value: points.reduce((acc, p) => acc + p.points, 0) + ' pts' },
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
