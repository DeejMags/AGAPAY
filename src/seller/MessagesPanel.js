import React, { useState } from 'react';

const mockMessages = [
  { id: 1, from: 'Buyer1', text: 'Is the jacket still available?' },
  { id: 2, from: 'Buyer2', text: 'Can you ship to Manila?' }
];

export default function MessagesPanel() {
  const [messages, setMessages] = useState(mockMessages);
  const [reply, setReply] = useState('');

  function handleReply(id) {
    if (!reply) return;
    setMessages(msgs => msgs.map(m => m.id === id ? { ...m, reply } : m));
    setReply('');
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">Messages</h3>
      <ul className="space-y-4">
        {messages.map(m => (
          <li key={m.id} className="border-b pb-2">
            <div className="font-semibold">From: {m.from}</div>
            <div className="mb-2">{m.text}</div>
            {m.reply && <div className="text-green-600">Reply: {m.reply}</div>}
            <div className="flex gap-2 mt-2">
              <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Type reply..." className="border rounded p-1 flex-1" />
              <button className="bg-teal-600 text-white px-2 py-1 rounded" onClick={() => handleReply(m.id)}>Send</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
