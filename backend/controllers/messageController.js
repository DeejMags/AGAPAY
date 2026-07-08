const { admin, db } = require('../config/firebaseAdmin');
const { FieldValue } = admin && admin.firestore ? admin.firestore : { FieldValue: null };
const { buildUserNameData } = require('../utils/nameUtils');

function millisFromFirestore(ts) {
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

function ensureFirebaseEnabled(res) {
	if (!db) {
		res.status(501).json({ message: 'Firebase disabled on server' });
		return false;
	}
	return true;
}

// Check if a string looks like a Firebase UID (alphanumeric, 20-28 chars)
function looksLikeUid(str) {
	if (!str || typeof str !== 'string') return false;
	return /^[a-zA-Z0-9]{20,28}$/.test(String(str).trim());
}

// Resolve a user's normalized display name and avatar from Firestore
async function resolveUserProfileName(userId) {
	if (!userId) return { name: null, avatar: null };
	try {
		// Try direct doc lookup first
		let uDoc = await db.collection('users').doc(String(userId)).get();
		if (!uDoc.exists) {
			const q = await db.collection('users').where('authId', '==', String(userId)).limit(1).get();
			if (!q.empty) uDoc = q.docs[0];
		}
		
		let ud = {};
		let email = null;
		
		if (uDoc && uDoc.exists) {
			ud = uDoc.data() || {};
			email = ud.email;
		}
		
		// If no email in Firestore, try to fetch from Firebase Auth
		if (!email && admin && admin.auth) {
			try {
				const authUser = await admin.auth().getUser(String(userId));
				email = authUser.email;
			} catch (e) {
				// Auth user not found, continue without email
			}
		}
		
		// Build name data from all available fields
		const nameData = buildUserNameData({
			firstName: ud.firstName,
			lastName: ud.lastName,
			name: ud.name,
			username: ud.username,
			displayName: ud.displayName,
			fullName: ud.fullName,
			email: email,
		});
		
		// Reject UID-looking names and use displayName as fallback
		let name = looksLikeUid(nameData.displayName) ? null : nameData.displayName;
		if (!name && email) {
			name = String(email).split('@')[0];
		}
		
		const avatar = ud.profilePic || ud.avatar || null;
		return { name, avatar };
	} catch (e) { 
		console.error('resolveUserProfileName error:', e);
	}
	return { name: null, avatar: null };
}

// GET /api/messages/conversations
async function listConversations(req, res) {
	if (!ensureFirebaseEnabled(res)) return;
	const uid = req.user && (req.user.uid || req.user.id);
	if (!uid) return res.status(401).json({ message: 'Unauthorized' });
	try {
		const q = db.collection('conversation').where('participants', 'array-contains', uid);
		const snap = await q.get();
		const out = [];
		snap.forEach(doc => {
			const data = doc.data() || {};
			const participants = sanitizeParticipants(data.participants);
			const other = participants.find(p => p !== uid) || null;
			const unreadMap = data.unread || {};
			const unreadCount = Number(unreadMap[uid] || 0);
			const otherUnreadCount = other ? Number(unreadMap[other] || 0) : 0;
			const last = data.lastMessage || null;
			const lastAt = millisFromFirestore(data.lastMessageAt || data.updatedAt || data.lastUpdated || data.updatedAt);
			const participantNames = data.participantNames || {};
			const participantAvatars = data.participantAvatars || {};
			// Store stale values for now; we'll overwrite with fresh lookups below
			const storedName = other ? (participantNames[other] || null) : null;
			const storedAvatar = other ? (participantAvatars[other] || null) : null;
			out.push({ conversationId: doc.id, participants, otherId: other, otherName: storedName, otherAvatar: storedAvatar, title: data.title || data.productName || null, lastMessage: last ? { id: last.id || null, text: last.text || last.message || '', senderId: last.senderId || last.sender || null, createdAt: millisFromFirestore(last.createdAt || last.timeStamp || last.time) } : null, lastMessageAt: lastAt, unreadCount, otherUnreadCount });
		});

		// Batch-resolve participant names/avatars from user profiles (up-to-date, uses first+last name)
		const uniqueOtherIds = [...new Set(out.map(c => c.otherId).filter(Boolean))];
		if (uniqueOtherIds.length > 0) {
			const resolved = await Promise.all(
				uniqueOtherIds.map(async id => ({ id, ...(await resolveUserProfileName(id)) }))
			);
			const profileMap = {};
			resolved.forEach(r => { profileMap[r.id] = r; });
			out.forEach(c => {
				if (c.otherId && profileMap[c.otherId]) {
					// ALWAYS overwrite with fresh profile data to prevent stale UIDs from showing
					if (profileMap[c.otherId].name) {
						c.otherName = profileMap[c.otherId].name;
					} else {
						// If no name found, clear the field to force frontend fallback
						c.otherName = null;
					}
					if (profileMap[c.otherId].avatar) {
						c.otherAvatar = profileMap[c.otherId].avatar;
					}
				}
			});
		}

		// sort by lastMessageAt desc
		out.sort((a,b)=> (b.lastMessageAt||0) - (a.lastMessageAt||0));
		res.json(out);
	} catch (err) {
		console.error('listConversations error', err);
		res.status(500).json({ message: 'Server error' });
	}
}

// GET /api/messages/:id
async function getConversation(req, res) {
	if (!ensureFirebaseEnabled(res)) return;
	const uid = req.user && (req.user.uid || req.user.id);
	const id = req.params.id;
	if (!uid) return res.status(401).json({ message: 'Unauthorized' });
	if (!id) return res.status(400).json({ message: 'Missing id' });
	try {
		const convRef = db.collection('conversation').doc(id);
		const convDoc = await convRef.get();
		if (!convDoc.exists) return res.status(404).json({ message: 'Conversation not found' });
		const conv = convDoc.data() || {};
		const participants = sanitizeParticipants(conv.participants);
		if (!participants.includes(uid)) return res.status(403).json({ message: 'Forbidden' });
			const msgsSnap = await convRef.collection('messages').orderBy('createdAt', 'asc').get();
			const messages = msgsSnap.docs.map(d=>{
			const m = d.data() || {};
			return { id: d.id, senderId: m.senderId || null, receiverId: m.receiverId || null, text: m.text || m.message || '', image: m.image || null, isRead: !!m.isRead, messageType: m.messageType || null, createdAt: millisFromFirestore(m.createdAt || m.timeStamp || m.created) };
		});
			// Best-effort: mark messages addressed to this user as read
			try {
				const batch = db.batch();
				msgsSnap.docs.forEach(d => {
					const m = d.data() || {};
					if (m && m.receiverId && String(m.receiverId) === String(uid) && !m.isRead) {
						batch.update(d.ref, { isRead: true });
					}
				});
				// Only commit if there is something to update
				// Firestore doesn't expose batch length, so we track a flag
				let hasUpdates = false;
				msgsSnap.docs.forEach(d => {
					const m = d.data() || {};
					if (m && m.receiverId && String(m.receiverId) === String(uid) && !m.isRead) hasUpdates = true;
				});
				if (hasUpdates) await batch.commit();
			} catch (e) {
				console.warn('Failed to mark messages read for conversation', id, e && e.message);
			}
		// mark read for this user (best-effort, not transactional)
			const unread = conv.unread || {};
			// Attempt to clear unread for both auth uid and any user doc id mapped to this uid
			let keysToClear = [String(uid)];
			try {
				const q = await db.collection('users').where('authId', '==', String(uid)).limit(1).get();
				if (!q.empty) keysToClear.push(String(q.docs[0].id));
			} catch (e) {}
			const newUnread = Object.assign({}, unread);
			let changed = false;
			keysToClear.forEach(k => { if (newUnread[k]) { delete newUnread[k]; changed = true; } });
			if (changed) await convRef.update({ unread: newUnread });
		res.json(messages);
	} catch (err) {
		console.error('getConversation error', err);
		res.status(500).json({ message: 'Server error' });
	}
}

// POST /api/messages/start
async function startConversation(req, res) {
	if (!ensureFirebaseEnabled(res)) return;
	const uid = req.user && (req.user.uid || req.user.id);
	if (!uid) return res.status(401).json({ message: 'Unauthorized' });
	const { receiverId, productId, productName, productImage } = req.body || {};
	if (!receiverId) return res.status(400).json({ message: 'Missing receiverId' });
	try {
		// Resolve receiver candidates similar to sendMessage
		const candidates = new Set();
		candidates.add(String(receiverId));
		let receiverAuthId = null;
		let receiverDocId = null;
		try {
			const uDoc = await db.collection('users').doc(String(receiverId)).get();
			if (uDoc.exists) {
				receiverDocId = uDoc.id;
				const ud = uDoc.data() || {};
				if (ud.authId) receiverAuthId = ud.authId;
			} else {
				const q = await db.collection('users').where('authId', '==', String(receiverId)).limit(1).get();
				if (!q.empty) {
					receiverDocId = q.docs[0].id;
					const ud = q.docs[0].data() || {};
					if (ud.authId) receiverAuthId = ud.authId;
				}
			}
		} catch (e) { /* ignore */ }
		if (receiverDocId) candidates.add(receiverDocId);
		if (receiverAuthId) candidates.add(receiverAuthId);

		// Try find existing
		const convs = await db.collection('conversation').where('participants', 'array-contains', uid).limit(200).get();
		for (const d of convs.docs) {
			const data = d.data() || {};
			const participants = sanitizeParticipants(data.participants);
			const intersects = participants.some(p => candidates.has(String(p)));
			if (!intersects) continue;
			if (productId && data.productId && data.productId !== productId) continue;
			return res.json({ conversationId: d.id });
		}

		// Create new conversation
		const canonicalReceiver = receiverAuthId || receiverDocId || String(receiverId);
		const participantList = Array.from(new Set([uid, canonicalReceiver].filter(Boolean)));
		const payload = {
			participants: participantList,
			productId: productId || null,
			productName: productName || null,
			productImage: productImage || null,
				participantNames: { [uid]: (req.user && (req.user.displayName || req.user.fullName || req.user.name || req.user.username || req.user.email)) || null },
				participantAvatars: { [uid]: (req.user && (req.user.avatar || req.user.profilePic || null)) || null },
			createdAt: admin.firestore.FieldValue.serverTimestamp(),
			updatedAt: admin.firestore.FieldValue.serverTimestamp(),
			lastMessage: null,
			lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
			unread: {}
		};
		const docRef = await db.collection('conversation').add(payload);
		return res.json({ conversationId: docRef.id });
	} catch (err) {
		console.error('startConversation error', err);
		res.status(500).json({ message: 'Server error' });
	}
}

// POST /api/messages/send
async function sendMessage(req, res) {
	if (!ensureFirebaseEnabled(res)) return;
		const uid = req.user && (req.user.uid || req.user.id);
	if (!uid) return res.status(401).json({ message: 'Unauthorized' });
		const { receiverId, text, productId, image } = req.body || {};
	if (!receiverId) return res.status(400).json({ message: 'Missing receiverId' });
	try {
		// Resolve receiver candidates: try to map receiverId to user doc id and authId
		const candidates = new Set();
		candidates.add(String(receiverId));
		let receiverAuthId = null;
		let receiverDocId = null;
		try {
			// Try direct doc lookup
			const uDoc = await db.collection('users').doc(String(receiverId)).get();
			if (uDoc.exists) {
				receiverDocId = uDoc.id;
				const ud = uDoc.data() || {};
				if (ud.authId) receiverAuthId = ud.authId;
			} else {
				// try lookup where authId == receiverId
				const q = await db.collection('users').where('authId', '==', String(receiverId)).limit(1).get();
				if (!q.empty) {
					receiverDocId = q.docs[0].id;
					const ud = q.docs[0].data() || {};
					if (ud.authId) receiverAuthId = ud.authId;
				}
			}
		} catch (e) {
			// ignore lookup errors
		}
		if (receiverDocId) candidates.add(receiverDocId);
		if (receiverAuthId) candidates.add(receiverAuthId);

		// find existing conversation with both participants and optional productId
		const convs = await db.collection('conversation').where('participants', 'array-contains', uid).limit(200).get();
		let convRef = null;
		for (const d of convs.docs) {
			const data = d.data() || {};
			const participants = sanitizeParticipants(data.participants);
			// check intersection between participants and candidates
			const intersects = participants.some(p => candidates.has(String(p)));
			if (!intersects) continue;
			if (productId && data.productId && data.productId !== productId) continue;
			convRef = db.collection('conversation').doc(d.id);
			break;
		}
			if (!convRef) {
				// prefer canonical receiver identifier (authId, then docId, then provided id)
				const canonicalReceiver = receiverAuthId || receiverDocId || String(receiverId);
				const participantList = Array.from(new Set([uid, canonicalReceiver].filter(Boolean)));
				const docRef = await db.collection('conversation').add({ participants: participantList, productId: productId || null, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), lastMessage: null, lastMessageAt: admin.firestore.FieldValue.serverTimestamp(), unread: {} });
				convRef = docRef;
			}
			// Prepare message payload, handle optional image upload
			let imageUrl = null;
			try {
				if (image && typeof image === 'string') {
					// Accept data URL (base64) or http(s) URL directly
					if (/^data:image\//i.test(image)) {
						const path = require('path');
						const fs = require('fs');
						const uploadDir = path.join(process.cwd(), 'uploads', 'messages');
						if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
						const m = image.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
						const ext = m ? (m[1].split('/')[1] || 'png') : 'png';
						const b64 = m ? m[2] : image.split(',')[1];
						const buf = Buffer.from(b64, 'base64');
						const filename = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
						const filePath = path.join(uploadDir, filename);
						fs.writeFileSync(filePath, buf);
						imageUrl = `/uploads/messages/${filename}`;
					} else if (/^https?:\/\//i.test(image)) {
						imageUrl = image;
					}
				}
			} catch (e) {
				console.warn('Image handling failed:', e && e.message);
			}
			const nowMs = Date.now();
			const msg = { senderId: uid, receiverId, text: text || '', image: imageUrl || null, isRead: false, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdAtMs: nowMs };
		const msgRef = await convRef.collection('messages').add(msg);
		// update conversation meta: lastMessage, lastMessageAt, increment unread for receiver
		const last = { id: msgRef.id, text: (text && text.trim()) ? text : (imageUrl ? '[Photo]' : ''), senderId: uid, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdAtMs: nowMs };
		// atomic update using FieldValue
			const upd = { lastMessage: last, lastMessageAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
		// increment unread for canonical receiver id if present
		const unreadKey = receiverAuthId || receiverDocId || String(receiverId);
		upd[`unread.${unreadKey}`] = admin.firestore.FieldValue.increment(1);
			// best-effort: backfill participant names/avatars if missing
			try {
				const docSnap = await convRef.get();
				const cdata = docSnap.exists ? docSnap.data() : {};
				const names = Object.assign({}, cdata.participantNames || {});
				const avatars = Object.assign({}, cdata.participantAvatars || {});
				// sender
				if (!names[uid]) names[uid] = (req.user && (req.user.displayName || req.user.fullName || req.user.name || req.user.username || req.user.email)) || null;
				// receiver resolve minimal profile
				if (!names[unreadKey]) {
					try {
						const uDoc = await db.collection('users').doc(String(unreadKey)).get();
						if (uDoc.exists) {
							const ud = uDoc.data() || {};
							const nameData = buildUserNameData({
								firstName: ud.firstName,
								lastName: ud.lastName,
								name: ud.name,
								username: ud.username,
								displayName: ud.displayName,
								fullName: ud.fullName,
								email: ud.email,
							});
							names[unreadKey] = nameData.displayName || nameData.username || ud.email || null;
							avatars[unreadKey] = ud.profilePic || ud.avatar || null;
						}
					} catch (e) { /* ignore */ }
				}
				upd.participantNames = names;
				upd.participantAvatars = avatars;
			} catch (e) { /* ignore */ }
		await convRef.update(upd);
		// return normalized message
		res.json({ id: msgRef.id, senderId: uid, receiverId, text: text || '', image: imageUrl || null, createdAt: Date.now() });
	} catch (err) {
		console.error('sendMessage error', err);
		res.status(500).json({ message: 'Server error' });
	}
}

// POST /api/messages/:id/read
async function markRead(req, res) {
	if (!ensureFirebaseEnabled(res)) return;
	const uid = req.user && (req.user.uid || req.user.id);
	const id = req.params.id;
	if (!uid) return res.status(401).json({ message: 'Unauthorized' });
	if (!id) return res.status(400).json({ message: 'Missing id' });
	try {
		const convRef = db.collection('conversation').doc(id);
		const convDoc = await convRef.get();
		if (!convDoc.exists) return res.status(404).json({ message: 'Conversation not found' });
		const conv = convDoc.data() || {};
			const unread = conv.unread || {};
			let keysToClear = [String(uid)];
			try {
				const q = await db.collection('users').where('authId', '==', String(uid)).limit(1).get();
				if (!q.empty) keysToClear.push(String(q.docs[0].id));
			} catch (e) {}
			const newUnread = Object.assign({}, unread);
			let changed = false;
			keysToClear.forEach(k => { if (newUnread[k]) { delete newUnread[k]; changed = true; } });
			if (changed) await convRef.update({ unread: newUnread });
		res.json({ ok: true });
	} catch (err) {
		console.error('markRead error', err);
		res.status(500).json({ message: 'Server error' });
	}
}

// POST /api/messages/upload (multipart form) -> { url }
async function uploadMessageImage(req, res) {
	try {
		if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
		const url = `/uploads/messages/${req.file.filename}`;
		return res.json({ url });
	} catch (err) {
		console.error('uploadMessageImage error', err);
		res.status(500).json({ error: 'Upload failed' });
	}
}

// DELETE /api/messages/:id  (hard delete conversation + messages or soft delete if ?soft=1)
async function deleteConversation(req, res) {
	if (!ensureFirebaseEnabled(res)) return;
	const uid = req.user && (req.user.uid || req.user.id);
	const id = req.params.id;
	if (!uid) return res.status(401).json({ message: 'Unauthorized' });
	if (!id) return res.status(400).json({ message: 'Missing id' });
	try {
		const convRef = db.collection('conversation').doc(id);
		const convDoc = await convRef.get();
		if (!convDoc.exists) return res.status(404).json({ message: 'Conversation not found' });
		const conv = convDoc.data() || {};
		const participants = sanitizeParticipants(conv.participants);
		if (!participants.includes(uid)) return res.status(403).json({ message: 'Forbidden' });
		// Optional soft delete mode
		const soft = (/^(1|true|yes)$/i).test(String(req.query.soft || '')); // ?soft=1
		if (soft) {
			await convRef.update({ deleted: true, deletedAt: admin.firestore.FieldValue.serverTimestamp(), participants: [], lastMessage: null, unread: {} });
			return res.json({ ok: true, deleted: id, mode: 'soft' });
		}
		// Hard delete: delete all messages subcollection docs in batches then conversation doc
		try {
			const msgsSnap = await convRef.collection('messages').get();
			if (!msgsSnap.empty) {
				let batch = db.batch();
				let opCount = 0;
				for (const d of msgsSnap.docs) {
					batch.delete(d.ref);
					opCount++;
					if (opCount >= 450) { // leave headroom under 500 limit
						await batch.commit();
						batch = db.batch();
						opCount = 0;
					}
				}
				if (opCount > 0) await batch.commit();
			}
		} catch (e) {
			console.warn('Failed to delete messages for conversation', id, e && e.message);
		}
		await convRef.delete();
		return res.json({ ok: true, deleted: id, mode: 'hard' });
	} catch (err) {
		console.error('deleteConversation error', err);
		res.status(500).json({ message: 'Server error' });
	}
}

module.exports = { listConversations, getConversation, sendMessage, markRead, startConversation, uploadMessageImage, deleteConversation };
