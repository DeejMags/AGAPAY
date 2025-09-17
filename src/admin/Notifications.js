import React from 'react';
export default function Notifications({ notifications, setNotifications }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">System Notifications</h2>
      <ul className="space-y-4">
        {notifications.map(n => (
          <li key={n.id} className="bg-white rounded-xl shadow p-4 flex flex-col">
            <div className="font-semibold text-teal-600">{n.type}</div>
            <div className="text-gray-700">{n.message}</div>
            <div className="text-xs text-gray-400 mt-1">Status: {n.status}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
