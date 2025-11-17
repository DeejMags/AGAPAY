import React, { useEffect, useState, useRef, useCallback } from 'react'
import FullScreenLoader from '../components/FullScreenLoader'
import MessageBubble from '../components/MessageBubble'
import * as msgService from '../firebaseMessageService'
import authFetch from '../utils/authFetch'
import { auth } from '../firebase'

function makeChatId(a,b){
  return [a,b].sort().join('_')
}

export default function Messages(){
  const [conversations, setConversations] = useState([]) // list of { chatId, title, otherId, otherName, otherAvatar, lastMessage }
  const [selectedChat, setSelectedChat] = useState(null) // chatId
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userCache, setUserCache] = useState({}) // id -> { id, username, email, profilePic }
  const [userNotFound, setUserNotFound] = useState({}) // id -> true if 404 or unavailable
  const listRef = useRef()
  

  // Keep only one conversation per contact. Group by stable otherId; never group purely by name.
  // This avoids collapsing different users into one when names are missing (e.g., "User").
  function coalesceByOtherId(items) {
    const best = new Map();
    items.forEach(c => {
      const nameKey = c.otherName ? String(c.otherName).trim().toLowerCase() : '';
      const hasRealName = !!(nameKey && nameKey !== 'user');
      const key = (c.otherId ? String(c.otherId) : null)
        || (hasRealName ? nameKey : null)
        || (c.chatId ? String(c.chatId) : `anon_${Math.random().toString(36).slice(2)}`);
      const ts = c.lastMessage?.createdAt || c.lastMessageAt || 0;
      if (!best.has(key)) best.set(key, c);
      else {
        const prev = best.get(key);
        const prevTs = prev.lastMessage?.createdAt || prev.lastMessageAt || 0;
        if ((ts || 0) > (prevTs || 0)) best.set(key, c);
      }
    });
    return Array.from(best.values());
  }

  // Resolve a user's display info (backend first, then Firestore). Caches results.
  const resolveUserProfile = useCallback(async function(userId) {
    if (!userId) return null;
    // Ignore pseudo IDs like 'seller_' used in legacy/local fallbacks
    if (String(userId).startsWith('seller_')) return null;
    if (userNotFound[userId]) return null;
    if (userCache[userId]) return userCache[userId];
    try {
      const res = await authFetch(`/api/users/${encodeURIComponent(userId)}`);
      if (res && res.ok) {
        const u = await res.json();
        setUserCache(prev => {
          const next = { ...prev, [userId]: u };
          // refresh conversations with new name/avatar
          setConversations(prevConvs => prevConvs.map(c => c.otherId === userId ? { ...c, otherName: displayName(u), otherAvatar: u.profilePic || u.avatar || null } : c));
          return next;
        });
        return u;
      } else if (res && res.status === 404) {
        setUserNotFound(prev => ({ ...prev, [userId]: true }));
        return null;
      }
    } catch (e) { /* ignore and fallback */ }
    try {
      const { doc: fsDoc, getDoc: fsGetDoc, collection, getDocs, query, where, limit } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      // Try direct doc id
      const direct = await fsGetDoc(fsDoc(db, 'users', String(userId)));
      if (direct.exists()) {
        const u = { id: direct.id, ...direct.data() };
        setUserCache(prev => {
          const next = { ...prev, [userId]: u };
          setConversations(prevConvs => prevConvs.map(c => c.otherId === userId ? { ...c, otherName: displayName(u), otherAvatar: u.profilePic || u.avatar || null } : c));
          return next;
        });
        return u;
      }
      // Try where authId == userId
      const q = query(collection(db, 'users'), where('authId', '==', String(userId)), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        const u = { id: d.id, ...d.data() };
        setUserCache(prev => {
          const next = { ...prev, [userId]: u };
          setConversations(prevConvs => prevConvs.map(c => c.otherId === userId ? { ...c, otherName: displayName(u), otherAvatar: u.profilePic || u.avatar || null } : c));
          return next;
        });
        return u;
      }
    } catch (e) { /* ignore */ }
    return null;
  }, [userCache, userNotFound]);

  // Ensure a conversation has a reliable otherId and try to backfill its name/avatar
  const ensureOtherParticipantAndName = useCallback(async (conv) => {
    if (!conv || !conv.chatId) return;
    let otherId = conv.otherId;
    // If otherId is missing or is a legacy pseudo id, try to fetch conversation meta
    if (!otherId || String(otherId).startsWith('seller_')) {
      try {
        const meta = await msgService.getConversationMeta(conv.chatId);
        const meId = (auth && auth.currentUser && auth.currentUser.uid) || (JSON.parse(localStorage.getItem('user')||'null')?.id);
        const parts = (meta && Array.isArray(meta.participants)) ? meta.participants.map(String) : [];
        const resolvedOther = parts.find(p => String(p) !== String(meId));
        if (resolvedOther) otherId = resolvedOther;
      } catch (_) { /* ignore */ }
    }
    if (!otherId) return;
    // Update conv with otherId if it changed
    if (otherId && otherId !== conv.otherId) {
      setConversations(prev => prev.map(c => c.chatId === conv.chatId ? { ...c, otherId } : c));
    }
    // If name is missing, resolve and update
    const hasName = !!(conv.otherName && String(conv.otherName).trim() !== '');
    if (!hasName) {
      const u = await resolveUserProfile(otherId).catch(()=>null);
      if (u) {
        setConversations(prev => prev.map(c => c.chatId === conv.chatId ? { ...c, otherName: displayName(u), otherAvatar: u.profilePic || u.avatar || null } : c));
      }
    }
  }, [resolveUserProfile]);

  function displayName(u) {
    if (!u) return '';
    return (
      u.username
      || u.displayName
      || u.name
      || u.fullName
      || (u.email ? String(u.email).split('@')[0] : '')
    );
  }

  useEffect(()=>{
    // Build the conversations list from backend conversations endpoint, fall back to products + local metadata
    let cancelled = false;
  async function loadConversations() {
  // prefer the canonical Firebase auth uid if available, fall back to localStorage
  const meFromAuth = auth && auth.currentUser ? { id: auth.currentUser.uid, profilePic: auth.currentUser.photoURL || null } : null;
  const me = meFromAuth || JSON.parse(localStorage.getItem('user') || 'null');
      let convs = [];
      // try backend first
      try {
        // Ensure Firebase auth has initialized so we can attach a valid ID token
        if (!auth.currentUser) {
          await new Promise(resolve => {
            const done = () => resolve();
            const t = setTimeout(done, 2000);
            const unsub = auth.onAuthStateChanged(() => { clearTimeout(t); unsub(); done(); });
          });
        }
        const res = await authFetch('/api/messages/conversations', { headers: { 'Content-Type': 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          const myId = me && me.id;
          const enriched = json.map(c => {
            const otherId = c.otherId || (c.participants && c.participants.find(p => p !== myId)) || null;
            const cached = otherId ? userCache[otherId] : null;
            const name = c.otherName || displayName(cached);
            const avatar = c.otherAvatar || (cached ? (cached.profilePic || cached.avatar || null) : null);
            return { chatId: c.conversationId, otherId, otherName: name, otherAvatar: avatar, lastMessage: c.lastMessage, unread: (c.unreadCount || 0) > 0 };
          });
          // Deduplicate by chatId just in case
          const seen = new Set();
          const noDupIds = enriched.filter(c => c.chatId && !seen.has(c.chatId) && seen.add(c.chatId));
          convs = coalesceByOtherId(noDupIds);
        } else if (res.status === 401 && auth.currentUser) {
          // Force token refresh and retry once
          try {
            await auth.currentUser.getIdToken(true);
            const res2 = await authFetch('/api/messages/conversations', { headers: { 'Content-Type': 'application/json' } });
            if (res2.ok) {
              const json = await res2.json();
              const myId = me && me.id;
              const enriched = json.map(c => {
                const otherId = c.otherId || (c.participants && c.participants.find(p => p !== myId)) || null;
                const cached = otherId ? userCache[otherId] : null;
                const name = c.otherName || displayName(cached);
                const avatar = c.otherAvatar || (cached ? (cached.profilePic || cached.avatar || null) : null);
                return { chatId: c.conversationId, otherId, otherName: name, otherAvatar: avatar, lastMessage: c.lastMessage, unread: (c.unreadCount || 0) > 0 };
              });
              const seen = new Set();
              const noDupIds = enriched.filter(c => c.chatId && !seen.has(c.chatId) && seen.add(c.chatId));
              convs = coalesceByOtherId(noDupIds);
            } else {
              throw new Error('messages API unauthorized');
            }
          } catch (e) {
            throw e;
          }
        } else {
          throw new Error('messages API failed');
        }
      } catch (err) {
        // fallback to product-based legacy conversations + localStorage
        try {
          const { collection, getDocs } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          const snap = await getDocs(collection(db, 'products'));
          const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const convsLocal = [];
          const seen = new Set();
          products.forEach(p => {
            const otherId = p.sellerId || 'seller_' + (p._id || '');
            const pid = p._id || p.id || null;
            if (!pid) return; // skip invalid, avoids ::undefined keys
            const chatId = makeChatId(me ? me.id : 'anon', otherId) + `::${pid}`;
            const convKey = `conv_${chatId}`;
            const msgs = JSON.parse(localStorage.getItem(convKey) || '[]');
            const meta = JSON.parse(localStorage.getItem(`conv_meta_${chatId}`) || 'null');
            const cached = otherId ? userCache[otherId] : null;
            if (!seen.has(chatId)) {
              seen.add(chatId);
              convsLocal.push({ chatId, otherId, otherName: displayName(cached), otherAvatar: cached ? (cached.profilePic || cached.avatar || null) : null, lastMessage: msgs.length ? msgs[msgs.length - 1] : null, unread: meta && meta.unreadFor && me ? meta.unreadFor.includes(me.id) : false });
            }
          });
          // also include conv_meta_ keys
          Object.keys(localStorage).forEach(k => {
            if (!k.startsWith('conv_meta_')) return;
            const chatId = k.replace('conv_meta_', '');
            // skip legacy invalid ids ending with ::undefined
            if (/::undefined$/.test(chatId)) return;
            if (convsLocal.find(c => c.chatId === chatId)) return;
            const convKey = `conv_${chatId}`;
            const msgs = JSON.parse(localStorage.getItem(convKey) || '[]');
            const meta = JSON.parse(localStorage.getItem(k) || 'null');
            const parts = chatId.split('::');
            const base = parts[0];
            const ids = base.split('_');
            const meId = (me && me.id) || 'anon';
            const otherId = ids.find(x => x !== meId) || ids[0];
            const cached = otherId ? userCache[otherId] : null;
            convsLocal.push({ chatId, otherId, otherName: displayName(cached), otherAvatar: cached ? (cached.profilePic || cached.avatar || null) : null, lastMessage: msgs.length ? msgs[msgs.length - 1] : null, unread: meta && meta.unreadFor && me ? meta.unreadFor.includes(me.id) : false });
          });
          convs = convsLocal;
        } catch (e) {
          console.warn('Failed to load products for messages', e);
          convs = [];
        }
      }

  // sort by lastMessage timestamp desc
  convs.sort((a, b) => { const ta = a.lastMessage ? (a.lastMessage.createdAt || a.lastMessageAt || a.lastMessage.id) : 0; const tb = b.lastMessage ? (b.lastMessage.createdAt || b.lastMessageAt || b.lastMessage.id) : 0; return (tb || 0) - (ta || 0); });
      if (!cancelled) {
        // Final dedupe before setting state
        const seen = new Set();
  const noDupIds = convs.filter(c => c.chatId && !seen.has(c.chatId) && seen.add(c.chatId));
  const uniqueOthers = coalesceByOtherId(noDupIds);
  setConversations(uniqueOthers);
      }

      // Asynchronously backfill participants and names/avatars per conversation
      try {
        const targets = (convs || []).slice(0, 50); // sane cap
        for (const c of targets) {
          ensureOtherParticipantAndName(c);
        }
      } catch (e) { /* ignore */ }

      // select first if none
      const active = localStorage.getItem('agapay_active_conv');
      if (active) { setSelectedChat(active); localStorage.removeItem('agapay_active_conv'); }
      setTimeout(() => setLoading(false), 700);
    }

    loadConversations();

  // try to subscribe to user conversations for realtime updates
    let unsubConvs = null
    try {
        const meFromAuth = auth && auth.currentUser ? { id: auth.currentUser.uid, profilePic: auth.currentUser.photoURL || null } : null;
        const me = meFromAuth || JSON.parse(localStorage.getItem('user') || 'null')
        if (me && me.id) {
        unsubConvs = msgService.subscribeToUserConversations(me.id, (list) => {
          const mapped = list.map(c => {
            const otherId = (c.participants || []).find(p => p !== me.id) || null;
            const cached = otherId ? userCache[otherId] : null;
            const unreadMap = c.unreadMap || {};
            return { chatId: c.conversationId, otherId, otherName: displayName(cached), otherAvatar: cached ? (cached.profilePic || cached.avatar || null) : null, lastMessage: c.lastMessage, unread: (c.unreadCount || 0) > 0, unreadMap };
          })
          // sort newest first
          mapped.sort((a,b) => ((b.lastMessage?.createdAt||0) - (a.lastMessage?.createdAt||0)) )
          // dedupe by chatId
          const seen = new Set();
          const noDupIds = mapped.filter(c => c.chatId && !seen.has(c.chatId) && seen.add(c.chatId));
          const uniqueOthers = coalesceByOtherId(noDupIds);
          setConversations(uniqueOthers);
          // Backfill profiles/participants more aggressively
          uniqueOthers.forEach(c => {
            ensureOtherParticipantAndName(c);
          });
        })
      }
    } catch (e) {
      // ignore if firebase not available
      console.debug('realtime convs not available', e)
    }

    // Listen for localStorage changes from other tabs/windows to surface incoming messages
    function onStorage(e) {
      if (!e.key) return; // clear event
      if (e.key.startsWith('conv_') || e.key.startsWith('conv_meta_')) {
        loadConversations();
      }
    }
    window.addEventListener('storage', onStorage);
    return () => { cancelled = true; window.removeEventListener('storage', onStorage); if (unsubConvs) unsubConvs(); };
    // We intentionally run this effect once on mount; nested logic handles live updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  // When selected chat changes, ensure we resolve and cache the other participant's profile so the header shows their name
  useEffect(() => {
    if (!selectedChat) return;
    const conv = conversations.find(c => c.chatId === selectedChat);
    const otherId = conv && conv.otherId;
    if (!otherId) return;
    // Always call resolver; it internally checks cache/not-found to avoid redundant work
    resolveUserProfile(otherId).catch(()=>{});
  }, [selectedChat, conversations, resolveUserProfile]);

  useEffect(()=>{
  if(!selectedChat){ setMessages([]); return }
  setLoading(true)
    const convId = selectedChat
    const me = JSON.parse(localStorage.getItem('user') || 'null')

    let cancelled = false
    let unsub = null
    async function loadMessages(){
      // (no-op) conversation meta fetch removed; we use realtime subscription and conversations list for participant info
      // try backend conversation fetch
      try {
        const res = await authFetch(`/api/messages/${encodeURIComponent(convId)}`, { headers: { 'Content-Type': 'application/json' } });
        if (res.ok) {
          const msgs = await res.json();
          if (!cancelled) setMessages(msgs.map(m => ({ id: m.id, text: m.text, me: m.senderId === ((auth && auth.currentUser && auth.currentUser.uid) || (me && me.id)), avatar: m.senderAvatar || null, image: m.image, createdAt: m.createdAt || Date.now(), isRead: !!m.isRead })));
          // refresh conversations unread flag
          setConversations(prev => prev.map(c => c.chatId === convId ? { ...c, unread: false } : c))
        } else throw new Error('fetch conv failed')
      } catch (err) {
        // fallback to localStorage
        const convKey = `conv_${convId}`
        const stored = JSON.parse(localStorage.getItem(convKey) || '[]')
  if (!cancelled) setMessages(stored)
        // mark as read in local meta
        const metaKey = `conv_meta_${convId}`
        const meta = JSON.parse(localStorage.getItem(metaKey) || 'null') || { unreadFor: [] }
        if(meta && me){
          meta.unreadFor = (meta.unreadFor || []).filter(id => id !== me.id)
          localStorage.setItem(metaKey, JSON.stringify(meta))
          setConversations(prev => prev.map(c => c.chatId === convId ? { ...c, unread: false } : c))
        }
      }
      // subscribe to realtime conversation updates via Firestore SDK if available
      try {
        const me = JSON.parse(localStorage.getItem('user') || 'null')
        // selectedChat is now the conversationId (doc id in `conversation` collection)
        unsub = msgService.subscribeToConversation(selectedChat, (msgs) => {
          const myId = (auth && auth.currentUser && auth.currentUser.uid) || (me && me.id);
          if (!cancelled) setMessages(msgs.map(m => ({ id: m.id, text: m.text, me: m.senderId === myId, avatar: m.senderAvatar || null, image: m.image, createdAt: m.createdAt || Date.now(), isRead: !!m.isRead })));
        })
      } catch (e) {
        // ignore
      }

      setTimeout(()=>{ if(listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; setLoading(false); }, 300)
    }
    loadMessages()
    return () => { cancelled = true; if (unsub) unsub(); }
  },[selectedChat])

  async function send(){
    if(!selectedChat) return
    const localUser = JSON.parse(localStorage.getItem('user') || 'null')
    const myId = (auth && auth.currentUser && auth.currentUser.uid) || (localUser && localUser.id) || null;
    const image = imageFile || null

    // determine receiverId robustly
    let receiverId = null;
    // prefer from conversations list
    const convFromList = conversations.find(c => c.chatId === selectedChat);
    if (convFromList && convFromList.otherId) receiverId = convFromList.otherId;
    // legacy chatId format a_b::productId
    if (!receiverId && selectedChat.includes('::')) {
      const base = selectedChat.split('::')[0];
      const ids = base.split('_');
      receiverId = ids.find(x=> String(x) !== String(myId)) || ids[0];
    }
    // fetch conversation meta to resolve participants when selectedChat is a Firestore doc id
    if (!receiverId) {
      try {
        const meta = await msgService.getConversationMeta(selectedChat);
        const parts = (meta && Array.isArray(meta.participants)) ? meta.participants.map(String) : [];
        receiverId = parts.find(p => String(p) !== String(myId)) || null;
      } catch (e) { /* ignore */ }
    }
    if (!receiverId) {
      console.warn('Unable to resolve receiverId for conversation', selectedChat);
      return; // do not attempt send without a receiver
    }

    try {
      const saved = await msgService.sendMessage(myId || 'anon', receiverId, text || '', { productId: (selectedChat && selectedChat.split('::')[1]) || null, image });
      const now = Date.now();
      // Optimistic local append with createdAt so sorting and ticks are immediate
      const appended = { id: saved.id, text: saved.text || text, me: true, avatar: localUser ? localUser.profilePic : null, image: saved.image || image, createdAt: saved.createdAt || now, isRead: false };
      const next = [...messages, appended]
      setMessages(next)
      setText('')
      setImageFile(null)
      // Optimistically bump this conversation to the top with a proper lastMessage meta
      setConversations(prev => {
        const updated = prev.map(c => c.chatId === selectedChat ? { ...c, lastMessage: { id: appended.id, text: appended.text, senderId: myId, createdAt: appended.createdAt }, unread: false } : c)
        // Re-sort by lastMessage.createdAt desc for instant UI response
        updated.sort((a,b) => ((b.lastMessage?.createdAt||0) - (a.lastMessage?.createdAt||0)) )
        return updated
      })
      return
    } catch (err) {
    // fallback to local optimistic update
  const nowMs = Date.now();
  const m = { id: nowMs, text: text || '', me: myId || 'me', avatar: localUser ? localUser.profilePic : null, image: (typeof image === 'string' ? image : (image ? URL.createObjectURL(image) : null)), createdAt: nowMs, isRead: false }
  const next = [...messages, m]
  setMessages(next)
      setText('')
      setImageFile(null)
      // mark unread for other user in meta
      const metaKey = `conv_meta_${selectedChat}`
      const meta = JSON.parse(localStorage.getItem(metaKey) || 'null') || { unreadFor: [] }
      const base = selectedChat.split('::')[0]
      const ids = base.split('_')
      const otherId = ids.find(x=> String(x) !== String(myId)) || ids[0]
      if(!meta.unreadFor) meta.unreadFor = []
      if(!meta.unreadFor.includes(otherId)) meta.unreadFor.push(otherId)
      localStorage.setItem(metaKey, JSON.stringify(meta))
      setConversations(prev => {
        const updated = prev.map(c => c.chatId === selectedChat ? { ...c, lastMessage: { id: m.id, text: m.text, senderId: myId, createdAt: m.createdAt }, unread: false } : c)
        updated.sort((a,b) => ((b.lastMessage?.createdAt||0) - (a.lastMessage?.createdAt||0)) )
        return updated
      })
    }
  }

  // removed unused helper fileToBase64 (not used)

  return (
    <div className="py-8 container mx-auto px-4">
      {loading && <FullScreenLoader />}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar - always rendered for layout stability */}
        <div className="md:col-span-1">
          <div>
            <div className="static bg-gradient-to-r from-teal-500 to-teal-400 rounded-t-xl px-4 py-4 flex items-center gap-2 shadow-sm">
              <div className="relative flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" height="18" viewBox="0 -960 960 960" width="18" fill="white"><path d="M80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z"/></svg>
                <h3 className="font-semibold text-lg text-white">Conversations</h3>
              </div>
            </div>
          </div>
          <div className="space-y-2 max-h-[48rem] overflow-auto pr-1 bg-white rounded-b-xl shadow border border-blue-100">
            {conversations.length ? conversations.map(c=> (
              <button key={c.chatId} onClick={()=>setSelectedChat(c.chatId)} className={`w-full text-left p-3 border-b last:border-b-0 flex items-center gap-3 transition duration-150 rounded-none ${selectedChat===c.chatId ? 'bg-blue-50 border-blue-400' : 'hover:bg-blue-100'}`} style={{borderRadius: selectedChat===c.chatId ? '12px' : '0'}}>
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 overflow-hidden flex items-center justify-center shadow">
                    {c.otherAvatar ? <img src={c.otherAvatar} alt={c.otherName} className="w-full h-full object-cover" /> : <span className="text-blue-500 text-xl">👤</span>}
                  </div>
                  {c.unread && (
                    <span className="absolute -bottom-0 -right-0 translate-x-1/4 translate-y-1/4 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold truncate ${selectedChat===c.chatId ? 'text-blue-700' : 'text-gray-800'}`}>
                    {c.otherName || displayName(userCache[c.otherId]) || 'Loading…'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {(() => {
                      const meId = (auth && auth.currentUser && auth.currentUser.uid) || (JSON.parse(localStorage.getItem('user')||'null')?.id);
                      const last = c.lastMessage;
                      if (!last) return 'New conversation';
                      const base = (last.text && String(last.text).trim()) ? last.text : '[Photo]';
                      const fromMe = last.senderId && meId && String(last.senderId) === String(meId);
                      const youPrefix = fromMe ? 'You: ' : '';
                      // If last is from me and the other user's unread is zero, show ✓✓, else ✓; otherwise no mark
                      let ticks = '';
                      if (fromMe) {
                        const parts = [meId, c.otherId].filter(Boolean).map(String);
                        const otherKey = parts.find(p => p !== String(meId));
                        const otherUnread = (c.unreadMap && otherKey) ? Number(c.unreadMap[otherKey] || 0) : null;
                        ticks = otherUnread === 0 ? ' ✓✓' : ' ✓';
                      }
                      return `${youPrefix}${base}${ticks}`;
                    })()}
                  </div>
                </div>
                {/* Single unread indicator (dot on avatar); remove trailing badge for cleaner UI */}
              </button>
            )) : (
              <div className="p-6 text-center text-gray-500">No conversations yet</div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="md:col-span-3">
          {selectedChat ? (
            <div className="flex flex-col gap-4 bg-white rounded-xl shadow p-6 border min-h-[48rem]">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                    {/* avatar placeholder - could resolve other user's avatar */}
                  </div>
                  <div className="font-semibold text-lg">
                    {(() => {
                      const conv = conversations.find(x => x.chatId === selectedChat);
                      const nm = conv?.otherName || displayName(userCache[conv?.otherId]) || '';
                      return nm || 'Chat';
                    })()}
                  </div>
                </div>
                <div className="text-xs text-gray-500">Messages</div>
              </div>

              <div ref={listRef} className="p-3 border rounded flex-1 overflow-auto flex flex-col gap-3 bg-gray-50">
                {(() => {
                  let lastDate = null;
                  return messages.map((m) => {
                    const rawTs = m.createdAt || m.timestamp || m.id;
                    const ts = Number.isFinite(rawTs) ? rawTs : (new Date(rawTs).getTime() || Date.now());
                    const dateObj = new Date(ts);
                    const dateStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                    const showDate = dateStr && lastDate !== dateStr;
                    if (dateStr) lastDate = dateStr;
                    return (
                      <React.Fragment key={m.id}>
                        {showDate && (
                          <div className="flex justify-center my-2">
                            <span className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full shadow">{dateStr}</span>
                          </div>
                        )}
                        <MessageBubble text={m.text} me={m.me} avatar={m.avatar} image={m.image} timestamp={ts} isRead={m.isRead} />
                      </React.Fragment>
                    );
                  });
                })()}
              </div>

              <div className="flex gap-2 mt-2 items-center">
                <input id="chat-image-input" type="file" accept="image/*" className="hidden" onChange={e=> setImageFile(e.target.files && e.target.files[0])} />
                <label htmlFor="chat-image-input" className="cursor-pointer p-2 rounded hover:bg-gray-100">
                  <svg className="w-6 h-6 text-teal-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h600q24 0 42 18t18 42v600q0 24-18 42t-42 18H180Zm0-60h600v-600H180v600Zm56-97h489L578-473 446-302l-93-127-117 152Zm-56 97v-600 600Z"/></svg>
                </label>
                <input
                  className="flex-1 p-2 border rounded"
                  value={text}
                  onChange={e=>setText(e.target.value)}
                  placeholder="Type a message"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button onClick={send} className="px-6 py-2 bg-teal-600 text-white rounded text-base font-medium">Send</button>
              </div>
              {/* Show image preview if selected */}
              {imageFile && (
                <div className="flex items-center gap-2 mt-2">
                  <img src={URL.createObjectURL(imageFile)} alt="preview" className="w-40 h-24 object-cover rounded-xl" />
                  <button className="text-red-600 text-xs" onClick={()=>setImageFile(null)}>Remove</button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 border rounded bg-white text-center text-gray-500 min-h-[48rem] flex items-center justify-center">Select a conversation to start chatting.</div>
          )}
        </div>
      </div>
    </div>
  )
}
