import React from 'react';
export default function Topbar({ onRefresh }) {
  return (
    <header className="w-full bg-white shadow flex items-center justify-between px-4 py-3 mb-4">
      <div className="text-lg font-semibold text-teal-600">AGAPAY Admin</div>
      <div className="flex items-center gap-3">
        {onRefresh && (
          <button className="px-3 py-1 bg-teal-600 text-white rounded" onClick={onRefresh}>Refresh</button>
        )}
      </div>
    </header>
  );
}
