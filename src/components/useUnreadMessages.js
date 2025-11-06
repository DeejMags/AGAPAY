import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { subscribeToUserConversations } from '../firebaseMessageService';

// Subscribes to user's conversations and computes total unread for this user.
// Returns { totalUnread, hasUnread }
export default function useUnreadMessages() {
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    (async () => {
      // Wait briefly for Firebase auth to initialize so we can get currentUser
      if (!auth.currentUser) {
        await new Promise(resolve => {
          const done = () => resolve();
          const t = setTimeout(done, 2000);
          const off = auth.onAuthStateChanged(() => { clearTimeout(t); off(); done(); });
        });
      }
      const me = (auth && auth.currentUser && auth.currentUser.uid) || (JSON.parse(localStorage.getItem('user') || 'null')?.id);
      if (!me) { setTotalUnread(0); return; }
      try {
        unsub = subscribeToUserConversations(String(me), (list) => {
          try {
            // Sum unread messages targeted to me from unread map
            const sum = list.reduce((acc, c) => acc + Number((c.unreadMap || {})[String(me)] || 0), 0);
            if (!cancelled) setTotalUnread(sum);
          } catch {
            if (!cancelled) setTotalUnread(0);
          }
        });
      } catch {
        // Fallback: scan localStorage meta for unread flags
        try {
          const meId = String(me);
          let count = 0;
          Object.keys(localStorage).forEach(k => {
            if (!k.startsWith('conv_meta_')) return;
            const meta = JSON.parse(localStorage.getItem(k) || 'null') || { unreadFor: [] };
            if (meta.unreadFor && meta.unreadFor.includes(meId)) count++;
          });
          if (!cancelled) setTotalUnread(count);
        } catch {
          if (!cancelled) setTotalUnread(0);
        }
      }
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
  }, []);

  return { totalUnread, hasUnread: totalUnread > 0 };
}
