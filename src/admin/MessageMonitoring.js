import React from 'react';
export default function MessageMonitoring({ messages, setMessages }) {
  const [replyText, setReplyText] = React.useState('');
  const [replyTo, setReplyTo] = React.useState(null);
  function handleReply(to) {
    setReplyTo(to);
  }
  function sendReply() {
    if (!replyText || !replyTo) return;
    // Save reply to localStorage (simulate backend)
    const admin = JSON.parse(localStorage.getItem('user') || 'null');
    const newMsg = {
      id: Date.now(),
      from: admin.email || 'admin',
      to: replyTo,
      content: replyText,
      status: 'Sent'
    };
    const allMsgs = JSON.parse(localStorage.getItem('agapay_messages') || '[]');
    localStorage.setItem('agapay_messages', JSON.stringify([...allMsgs, newMsg]));
    setMessages([...allMsgs, newMsg]);
    setReplyText('');
    setReplyTo(null);
  }
  function handleDelete(id) {
    const updated = messages.filter(m => m.id !== id);
    setMessages(updated);
    localStorage.setItem('agapay_messages', JSON.stringify(updated));
  }
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
          {messages.map(m => (
            <tr key={m.id} className="border-b">
              <td className="p-3">{m.from}</td>
              <td className="p-3">{m.to}</td>
              <td className="p-3">{m.content}</td>
              <td className="p-3">{m.status}</td>
              <td className="p-3">
                <button className="text-red-600 hover:underline" onClick={()=>handleDelete(m.id)}>Delete</button>
                <button className="text-blue-600 hover:underline ml-2" onClick={()=>handleReply(m.from)}>Reply</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {replyTo && (
        <div className="mb-4 flex gap-2 items-center">
          <input value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder={`Reply to ${replyTo}`} className="border rounded px-4 py-2" />
          <button className="bg-teal-600 text-white px-4 py-2 rounded" onClick={sendReply}>Send</button>
          <button className="bg-gray-300 px-4 py-2 rounded" onClick={()=>{setReplyTo(null);setReplyText('')}}>Cancel</button>
        </div>
      )}
    </div>
  );
}
