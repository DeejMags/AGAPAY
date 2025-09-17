import React from 'react';
export default function Topbar() {
  return (
    <header className="w-full bg-white shadow flex items-center justify-end px-6 py-4 mb-4">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-teal-600">Admin</span>
        <img src="/assets/AGAPAY logo.png" alt="Admin" className="w-10 h-10 rounded-full object-contain" />
      </div>
    </header>
  );
}
