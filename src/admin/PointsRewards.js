import React from 'react';
export default function PointsRewards({ points, setPoints }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Points & Rewards</h2>
      <table className="w-full bg-white rounded-xl shadow mb-8">
        <thead>
          <tr className="bg-teal-100 text-teal-700">
            <th className="p-3 text-left">User</th>
            <th className="p-3 text-left">Points</th>
            <th className="p-3 text-left">Redeemed</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {points.map(p => (
            <tr key={p.id} className="border-b">
              <td className="p-3">{p.user}</td>
              <td className="p-3">{p.points}</td>
              <td className="p-3">{p.redeemed}</td>
              <td className="p-3">
                <button className="text-blue-600 hover:underline mr-2">Adjust</button>
                <button className="text-green-600 hover:underline">Reward</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
