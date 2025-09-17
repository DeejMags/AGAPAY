import React from 'react';

export default function ImpactReportPanel() {
  // Mock sustainability stats
  const stats = {
    recycled: 12,
    donated: 5,
    reused: 8
  };
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">Impact Report</h3>
      <ul className="space-y-2">
        <li>Items Recycled: <span className="font-bold text-teal-600">{stats.recycled}</span></li>
        <li>Items Donated: <span className="font-bold text-green-600">{stats.donated}</span></li>
        <li>Items Reused: <span className="font-bold text-blue-600">{stats.reused}</span></li>
      </ul>
    </div>
  );
}
