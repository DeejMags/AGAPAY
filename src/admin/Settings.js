import React, { useState } from 'react';
// import { UsersIcon, ShieldCheckIcon, StoreIcon, BellIcon, CogIcon, TrashIcon, LogoutIcon } from '@heroicons/react/24/outline';

export default function AdminSettings() {
  const [autoApprove, setAutoApprove] = useState(false);
  const [broadcast, setBroadcast] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        {/* <CogIcon className="w-7 h-7 text-teal-600" /> */}
        Admin Settings
      </h1>
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {/* <UsersIcon className="w-6 h-6 text-teal-500" /> */}
          User Management
        </h2>
        <button className="px-4 py-2 bg-teal-600 text-white rounded mb-4">Manually Approve Pending Users</button>
        <button className="px-4 py-2 bg-red-600 text-white rounded">Block/Unblock User Accounts</button>
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {/* <StoreIcon className="w-6 h-6 text-teal-500" /> */}
          Listing Management
        </h2>
        <div className="flex items-center gap-4 mb-4">
          <span>Auto-approve Item Listings</span>
          <button type="button" onClick={()=>setAutoApprove(v=>!v)} className={`w-12 h-6 rounded-full border flex items-center ${autoApprove ? 'bg-teal-600' : 'bg-gray-200'}`}>
            <span className={`w-5 h-5 rounded-full bg-white shadow transition-all ${autoApprove ? 'translate-x-6' : ''}`}></span>
          </button>
        </div>
        <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded">Review Reported Items</button>
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {/* <BellIcon className="w-6 h-6 text-teal-500" /> */}
          Messaging & Notifications
        </h2>
        <div className="flex items-center gap-4 mb-4">
          <span>Enable Broadcast Messages</span>
          <button type="button" onClick={()=>setBroadcast(v=>!v)} className={`w-12 h-6 rounded-full border flex items-center ${broadcast ? 'bg-teal-600' : 'bg-gray-200'}`}>
            <span className={`w-5 h-5 rounded-full bg-white shadow transition-all ${broadcast ? 'translate-x-6' : ''}`}></span>
          </button>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <span>Enable In-app Notifications</span>
          <button type="button" onClick={()=>setInAppNotif(v=>!v)} className={`w-12 h-6 rounded-full border flex items-center ${inAppNotif ? 'bg-teal-600' : 'bg-gray-200'}`}>
            <span className={`w-5 h-5 rounded-full bg-white shadow transition-all ${inAppNotif ? 'translate-x-6' : ''}`}></span>
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {/* <ShieldCheckIcon className="w-6 h-6 text-teal-500" /> */}
          Security Controls
        </h2>
        <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded mb-4">Logout All Admins</button>
        <button className="px-4 py-2 bg-teal-600 text-white rounded">Add/Remove Other Admins</button>
      </div>
    </div>
  );
}
