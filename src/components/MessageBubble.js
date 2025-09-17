import React from 'react'
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default function MessageBubble({ text, me, avatar, image, timestamp }){
  return (
    <div className={`flex items-end gap-2 ${me ? 'justify-end' : 'justify-start'}`}>
      {!me && (
        avatar ? <img src={avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 bg-gray-200 rounded-full" />
      )}

      <div className={`relative bg-white text-black rounded-2xl shadow max-w-md px-4 py-3 self-start`} style={{borderRadius: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
        {image && <img src={image} alt="sent" className="mb-2 rounded-xl w-full max-h-48 object-cover" />}
        <div className="whitespace-pre-line text-base leading-relaxed">{text}</div>
  <div className="absolute bottom-1 right-3 text-xs text-gray-400">{formatTime(timestamp)}</div>
      </div>

      {me && (
        avatar ? <img src={avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 bg-gray-200 rounded-full" />
      )}
    </div>
  )
}
