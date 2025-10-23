import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function QuickMessagesButton(){
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  useEffect(()=>{
    function scan(){
      try{
        const me = JSON.parse(localStorage.getItem('user') || 'null');
        const meId = me ? me.id : 'anon';
        let count = 0;
        Object.keys(localStorage).forEach(k=>{
          if(!k.startsWith('conv_meta_')) return;
          const meta = JSON.parse(localStorage.getItem(k) || 'null') || { unreadFor: [] };
          if(meta.unreadFor && meta.unreadFor.includes(meId)) count++;
        });
        setUnread(count);
      }catch(e){ setUnread(0); }
    }
    scan();
    const id = setInterval(scan, 5000); // refresh periodically
    window.addEventListener('storage', scan);
    return ()=>{ clearInterval(id); window.removeEventListener('storage', scan); }
  },[])

  return (
    <button
      onClick={() => navigate('/messages')}
      aria-label="Open messages"
      style={{ zIndex: 99999, pointerEvents: 'auto' }}
      className="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-teal-600 text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
    >
      {/* message bubble icon */}
    <svg xmlns="http://www.w3.org/2000/svg" height="28" viewBox="0 -960 960 960" width="28" fill="currentColor"><path d="M80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z"/></svg>
      {unread > 0 && (
        <span className="absolute -top-2 -right-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-red-500 text-white rounded-full">{unread}</span>
      )}
    </button>
  )
}
