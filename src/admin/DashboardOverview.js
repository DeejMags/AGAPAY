import React from 'react';
export default function DashboardOverview({ users, products, reports, points, dropoffs }) {
  // normalize inputs: they can be arrays or paged responses { items: [] }
  const usersArr = users ? (Array.isArray(users) ? users : (users.items || [])) : [];
  const productsArr = products ? (Array.isArray(products) ? products : (products.items || [])) : [];
  const reportsArr = reports ? (Array.isArray(reports) ? reports : (reports.items || [])) : [];
  const dropoffsArr = dropoffs ? (Array.isArray(dropoffs) ? dropoffs : (dropoffs.items || [])) : [];

  // Count unresolved reports (status not 'resolved'); default status is 'open'
  const unresolvedReports = reportsArr.filter(r => (r.status || 'open') !== 'resolved').length;

  const stats = [
    { label: 'Total Users', value: usersArr.length },
    { label: 'Total Products', value: productsArr.length },
    { label: 'Total Drop-Offs', value: dropoffsArr.length },
    { label: 'Reports', value: unresolvedReports },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {stats.map((stat, i) => (
        <div key={i} className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <div className="text-2xl font-bold text-teal-600 mb-2">{stat.value}</div>
          <div className="text-gray-700 text-lg">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
