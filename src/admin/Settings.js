import React from 'react';
// import { UsersIcon, ShieldCheckIcon, StoreIcon, BellIcon, CogIcon, TrashIcon, LogoutIcon } from '@heroicons/react/24/outline';

export default function AdminSettings() {
  // Removed auto-approve setting per request
  // Removed Messaging & Notifications controls per request

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        {/* <CogIcon className="w-7 h-7 text-teal-600" /> */}
        Admin Settings
      </h1>
      {/* Listing Management section removed (auto-approve toggle) */}
      {/* Messaging & Notifications section removed */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {/* <ShieldCheckIcon className="w-6 h-6 text-teal-500" /> */}
          Security Controls
        </h2>
        <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded mb-4">Logout All Admins</button>
      </div>
    </div>
  );
}
