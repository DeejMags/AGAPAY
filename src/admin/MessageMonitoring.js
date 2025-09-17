import React from 'react';
export default function MessageMonitoring({ messages, setMessages }) {
  const flagged = messages.filter(m => m.status === 'Flagged');
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Message Monitoring</h2>
      <table className="w-full bg-white rounded-xl shadow mb-8">
        <thead>
          <tr className="bg-teal-100 text-teal-700">
            <th className="p-3 text-left">From</th>
            <th className="p-3 text-left">To</th>
            <th className="p-3 text-left">Content</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {flagged.map(m => (
            <tr key={m.id} className="border-b">
              <td className="p-3">{m.from}</td>
              <td className="p-3">{m.to}</td>
              <td className="p-3">{m.content}</td>
              <td className="p-3">{m.status}</td>
              <td className="p-3">
                <button className="text-red-600 hover:underline">Delete</button>
                <button className="text-blue-600 hover:underline ml-2">Review</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
