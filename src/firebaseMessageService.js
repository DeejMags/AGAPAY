// Firebase message service for React + Firebase v9 modular SDK
import { db, auth } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, onSnapshot, doc, getDoc, updateDoc, limit } from 'firebase/firestore';
import authFetch from './utils/authFetch';

function millisFromTs(ts) {
  if (!ts) return null;
  if (typeof ts === 'number') return ts;
  if (ts.toMillis) return ts.toMillis();
  try { return new Date(ts).getTime(); } catch (e) { return null; }
}

function sanitizeParticipants(p) {
  if (!p) return [];
  if (Array.isArray(p)) return p.filter(Boolean).map(String);
  if (typeof p === 'string') return p ? p.split(/[,_:\-\s]+/).map(s=>s.trim()).filter(Boolean) : [];
  return [];
}

// Send a message
// Find or create a conversation then add a message
export async function sendMessage(senderId, receiverId, content, opts = {}) {
  const actualSender = senderId || (auth && auth.currentUser && auth.currentUser.uid) || 'anon';
  const { productId } = opts;
  let imageUrl = null;
  // If opts.image is a File/Blob or dataURL, prefer uploading via multipart to avoid 413/Firestore size limits
  if (opts && opts.image) {
    try {
      if (typeof opts.image !== 'string' || /^data:image\//i.test(opts.image)) {
        const form = new FormData();
        // Convert data URL to Blob if needed
        if (typeof opts.image === 'string' && /^data:image\//i.test(opts.image)) {
          const res = await fetch(opts.image);
          const blob = await res.blob();
          form.append('file', blob, 'image.png');
        } else {
          form.append('file', opts.image);
        }
        const up = await authFetch('/api/messages/upload', { method: 'POST', body: form });
        if (up.ok) {
          const j = await up.json();
          imageUrl = j.url || null;
        }
      } else if (/^https?:\/\//i.test(opts.image)) {
        imageUrl = opts.image;
      }
    } catch (e) {
      console.warn('Image upload failed, will try inline send', e);
    }
  }
  // prefer backend API when available (authFetch adds ID token)
  try {
    if (typeof authFetch === 'function') {
      const body = { receiverId, text: content, productId };
      if (imageUrl) body.image = imageUrl;
      const res = await authFetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        const json = await res.json();
        return { id: json.id, senderId: json.senderId || actualSender, receiverId: json.receiverId || receiverId, text: json.text || content, image: json.image || imageUrl || null, createdAt: json.createdAt || Date.now() };
      }
    }
  } catch (err) {
    console.debug('Backend send failed, falling back to client SDK', err);
  }

  // Fallback to client Firestore write
  try {
    let convRef = null;
    const convsQ = query(collection(db, 'conversation'), where('participants', 'array-contains', actualSender), limit(50));
    const convsSnap = await getDocs(convsQ);
    for (const d of convsSnap.docs) {
      const p = sanitizeParticipants(d.data().participants);
      if (p.includes(receiverId)) {
        if (productId && d.data().productId && d.data().productId !== productId) continue;
        convRef = doc(db, 'conversation', d.id);
        break;
      }
    }

    if (!convRef) {
      const convData = { participants: [actualSender, receiverId], productId: productId || null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessage: null, lastMessageAt: serverTimestamp(), unread: {} };
      const r = await addDoc(collection(db, 'conversation'), convData);
      convRef = doc(db, 'conversation', r.id);
    }

  const nowMs = Date.now();
  const messageData = { senderId: actualSender, receiverId, text: content, image: imageUrl || null, status: 'sent', createdAt: serverTimestamp(), createdAtMs: nowMs };
    const msgRef = await addDoc(collection(convRef, 'messages'), messageData);
  const lastMessageObj = { id: msgRef.id, text: (messageData.text && messageData.text.trim()) ? messageData.text : (messageData.image ? '[Photo]' : ''), senderId: messageData.senderId, createdAt: serverTimestamp(), createdAtMs: nowMs };
    // best-effort increment unread counter
    try {
      const convSnap = await getDoc(convRef);
      const curUnread = convSnap.data()?.unread || {};
      const nextCount = (curUnread && curUnread[receiverId]) ? (curUnread[receiverId] + 1) : 1;
      await updateDoc(convRef, { lastMessage: lastMessageObj, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp(), [`unread.${receiverId}`]: nextCount });
    } catch (e) {
      // ignore
    }
    const docSnap = await getDoc(msgRef);
    const data = docSnap.data() || {};
  return { id: docSnap.id, senderId: data.senderId || null, receiverId: data.receiverId || null, text: data.text || '', image: data.image || null, status: data.status || null, createdAt: Number(data.createdAtMs || 0) || millisFromTs(data.createdAt) };
  } catch (err) {
    console.error('Error sending message (client fallback):', err);
    throw err;
  }
}

// Get conversation between two users
export async function getConversation(conversationId) {
  try {
    const convRef = doc(db, 'conversation', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return [];
    const msgsQ = query(collection(convRef, 'messages'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(msgsQ);
    return snap.docs.map(d => {
      const data = d.data() || {};
      const ts = millisFromTs(data.createdAt || data.timeStamp || data.created);
      return { id: d.id, senderId: data.senderId || null, senderName: data.senderName || null, senderAvatar: data.senderAvatar || null, receiverId: data.receiverId || null, text: data.text || '', image: data.image || null, status: data.status || null, createdAt: ts || Date.now() };
    });
  } catch (err) {
    console.error('Error fetching conversation:', err);
    throw err;
  }
}

// Get all conversations for a user
export async function getUserConversations(userId) {
  try {
    // Avoid ordering in the query to prevent composite index requirement (order client-side)
    const actualUser = userId || (auth && auth.currentUser && auth.currentUser.uid);
    const q = query(collection(db, 'conversation'), where('participants', 'array-contains', actualUser));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => {
      const raw = d.data() || {};
      const participants = sanitizeParticipants(raw.participants);
      const unreadCount = Number((raw.unread || {})[actualUser] || 0);
      const lm = raw.lastMessage || null;
  const lastMessage = lm ? { id: lm.id || null, text: lm.text || lm.message || '', senderId: lm.senderId || lm.sender || null, createdAt: Number(lm.createdAtMs || 0) || millisFromTs(lm.createdAt) } : null;
      const lastMessageAt = millisFromTs(raw.lastMessageAt || raw.updatedAt);
      return { conversationId: d.id, participants, lastMessage, lastMessageAt, unreadCount, productId: raw.productId || null, title: raw.title || raw.productName || null };
    });
    list.sort((a,b) => (b.lastMessageAt||0) - (a.lastMessageAt||0));
    return list;
  } catch (err) {
    console.error('Error fetching user conversations:', err);
    throw err;
  }
}

// Get conversation document metadata (participants, productId, etc.)
export async function getConversationMeta(conversationId) {
  try {
    const convRef = doc(db, 'conversation', conversationId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) return null;
    return { conversationId: snap.id, ...snap.data() };
  } catch (err) {
    console.error('Error fetching conversation meta:', err);
    throw err;
  }
}

// Find existing conversation for participants (and optional productId) or create one. Returns conversationId
export async function findOrCreateConversation(senderId, receiverId, productId = null) {
  try {
    const actualSender = senderId || (auth && auth.currentUser && auth.currentUser.uid) || 'anon';
    // search conversations where senderId is a participant
    const convsQ = query(collection(db, 'conversation'), where('participants', 'array-contains', actualSender), limit(50));
    const convsSnap = await getDocs(convsQ);
    for (const d of convsSnap.docs) {
      const data = d.data();
      const parts = sanitizeParticipants(data.participants);
      if (parts.includes(receiverId)) {
        if (productId && data.productId && data.productId !== productId) continue;
        return d.id;
      }
    }

    // create new conversation
    const convData = {
      participants: [actualSender, receiverId],
      productId: productId || null,
      createdAt: serverTimestamp(),
      lastMessage: null,
      lastMessageAt: serverTimestamp(),
      unread: {}
    };
    const r = await addDoc(collection(db, 'conversation'), convData);
    return r.id;
  } catch (err) {
    console.error('findOrCreateConversation error', err);
    throw err;
  }
}

// Start a conversation via backend (preferred). Returns conversationId
export async function startConversation(receiverId, opts = {}) {
  const { productId, productName, productImage } = opts || {};
  try {
    if (typeof authFetch === 'function') {
      const res = await authFetch('/api/messages/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId, productId, productName, productImage })
      });
      if (res.ok) {
        const json = await res.json();
        return json.conversationId;
      }
    }
  } catch (e) {
    // fall through to client fallback
  }

  // Fallback: create in Firestore directly
  try {
    const me = (auth && auth.currentUser && auth.currentUser.uid) || 'anon';
    const convData = { participants: [me, receiverId], productId: productId || null, productName: productName || null, productImage: productImage || null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessage: null, lastMessageAt: serverTimestamp(), unread: {} };
    const r = await addDoc(collection(db, 'conversation'), convData);
    return r.id;
  } catch (err) {
    console.error('startConversation fallback error', err);
    throw err;
  }
}

// Subscribe to a conversation in real-time. callback receives array of messages
export function subscribeToConversation(conversationId, callback) {
  const convRef = doc(db, 'conversation', conversationId);
  // Unordered snapshot to avoid latency from serverTimestamp-based ordering; we'll sort client-side
  const colRef = collection(convRef, 'messages');
  const unsub = onSnapshot(colRef, snapshot => {
    const msgs = snapshot.docs.map(d => {
      const data = d.data() || {};
      const tsMs = Number(data.createdAtMs || 0);
      const ts = tsMs || millisFromTs(data.createdAt || data.timeStamp || data.created);
      return {
        id: d.id,
        senderId: data.senderId || null,
        senderName: data.senderName || null,
        senderAvatar: data.senderAvatar || null,
        receiverId: data.receiverId || null,
        text: data.text || '',
        image: data.image || null,
        status: data.status || null,
        isRead: !!data.isRead,
        createdAt: ts || Date.now()
      };
    }).sort((a,b) => (a.createdAt||0) - (b.createdAt||0));
    callback(msgs);
  }, err => {
    console.error('Realtime convo error', err);
  });
  return unsub;
}

// Subscribe to all conversations for a user (last message updates)
export function subscribeToUserConversations(userId, callback) {
  // Avoid ordering in the query to prevent composite index requirement; sort client-side in callback
  const q = query(collection(db, 'conversation'), where('participants', 'array-contains', userId));
  const unsub = onSnapshot(q, snapshot => {
    const list = snapshot.docs.map(d => {
      const raw = d.data() || {};
      const participants = sanitizeParticipants(raw.participants);
      const unreadCount = Object.values(raw.unread || {}).reduce((s,x)=>s + (Number(x)||0), 0);
      const lm = raw.lastMessage || null;
      const lastMessage = lm ? { id: lm.id || null, text: lm.text || lm.message || '', senderId: lm.senderId || lm.sender || null, createdAt: Number(lm.createdAtMs || 0) || millisFromTs(lm.createdAt) } : null;
      // Prefer client-stamped ms for immediate ordering to avoid serverTimestamp delay
  const lastMessageAt = Number((lm && lm.createdAtMs) || 0) || millisFromTs(raw.lastMessageAt || raw.updatedAt);
      return { conversationId: d.id, participants, lastMessage, lastMessageAt, unreadCount, unreadMap: raw.unread || {}, productId: raw.productId || null, title: raw.title || raw.productName || null };
    });
    list.sort((a,b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
    callback(list);
  }, err => console.error('Realtime user convs error', err));
  return unsub;
}

// Delete a conversation (backend preferred). Returns true if deleted.
export async function deleteConversation(conversationId, opts = {}) {
  if (!conversationId) return false;
  // Try backend hard delete first
  try {
    if (typeof authFetch === 'function') {
      const q = opts.soft ? '?soft=1' : '';
      const res = await authFetch(`/api/messages/${encodeURIComponent(conversationId)}${q}`, { method: 'DELETE' });
      if (res.ok) return true;
    }
  } catch (e) { /* fallback */ }
  // Fallback: client-side Firestore delete (hard)
  try {
    const convRef = doc(db, 'conversation', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return false;
    // Delete messages subcollection in batches
    try {
      const msgsCol = collection(convRef, 'messages');
      const msgsSnap = await getDocs(msgsCol);
      if (!msgsSnap.empty) {
        // Firestore web SDK writeBatch import on demand
        const { writeBatch } = await import('firebase/firestore');
        let batch = writeBatch(db);
        let count = 0;
        for (const d of msgsSnap.docs) {
          batch.delete(d.ref);
          count++;
          if (count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
        }
        if (count > 0) await batch.commit();
      }
    } catch (e) { /* ignore message deletes */ }
    // Delete conversation doc
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(convRef);
    return true;
  } catch (err) {
    console.error('deleteConversation fallback error', err);
    return false;
  }
}
