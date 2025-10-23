const { admin, db } = require('../config/firebaseAdmin');

exports.getAllUsers = async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Remove sensitive fields and normalize timestamps
    const safe = users.map(u => {
      const { password, ...rest } = u;
      return {
        ...rest,
        createdAt: rest.createdAt ? (rest.createdAt.toDate ? rest.createdAt.toDate().toISOString() : new Date(rest.createdAt).toISOString()) : null
      };
    });
    res.json(safe);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const data = req.body;
    const createdAt = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection('users').add({ ...data, createdAt });
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const id = req.params.id;
    // Try direct doc lookup first
    let docRef = db.collection('users').doc(id);
    let doc = await docRef.get();
    if (doc.exists) return res.json({ id: doc.id, ...doc.data() });

    // If not found, allow lookup by authId (Firebase UID) or email as fallback
    // This handles cases where the frontend passes Firebase auth uid instead of Firestore doc id
    const byAuth = await db.collection('users').where('authId', '==', id).limit(1).get();
    if (!byAuth.empty) return res.json({ id: byAuth.docs[0].id, ...byAuth.docs[0].data() });

    // Lastly, try email lookup if the id looks like an email
    if (typeof id === 'string' && id.includes('@')) {
      const byEmail = await db.collection('users').where('email', '==', id).limit(1).get();
      if (!byEmail.empty) return res.json({ id: byEmail.docs[0].id, ...byEmail.docs[0].data() });
    }

    // As a last resort, try to fetch Firebase Auth user with this id
    try {
      if (admin && admin.auth) {
        const authUser = await admin.auth().getUser(id);
        if (authUser) {
          const profile = { id: id, authId: authUser.uid, email: authUser.email || null, username: authUser.displayName || null, profilePic: authUser.photoURL || null };
          return res.json(profile);
        }
      }
    } catch (e) {
      // ignore
    }

    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('Error fetching user by ID:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const data = req.body;
    await db.collection('users').doc(req.params.id).update(data);
    res.json({ id: req.params.id, ...data });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: err.message });
  }
};

// Admin helper: list users missing authId so we can migrate or inspect them before destructive ops
exports.getUsersMissingAuthId = async (req, res) => {
  try {
    const snapshot = await db.collection('users').where('authId', '==', null).get();
    // Note: Firestore stores absent fields differently; we will check for documents where authId is not present or is null
    // To handle missing field, retrieve all users and filter
    if (snapshot.empty) {
      // fallback: fetch all and filter missing
      const allSnap = await db.collection('users').get();
      const missing = allSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => !u.authId);
      return res.json(missing);
    }
    const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(users);
  } catch (err) {
    console.error('Error fetching users missing authId:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const docRef = db.collection('users').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });

    const data = doc.data() || {};

    // If the Firestore profile includes an authId, attempt to delete that Auth user.
    // This is the authoritative path: authId was stored during registration.
    if (data.authId) {
      try {
        // Attempt to delete the corresponding Firebase Auth user
        await admin.auth().deleteUser(data.authId);
        console.log(`Deleted Firebase Auth user ${data.authId}`);
      } catch (err) {
        // If deletion fails (user not found or other), log and continue to delete Firestore doc
        console.warn(`Failed to delete Firebase Auth user ${data.authId}:`, err.message || err);
      }
    } else {
      // As a fallback, try other candidate fields but don't fail the whole operation when missing
      const candidateUids = [data.uid, data.userId, data.firebaseUid, data.sellerId, doc.id]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);
      for (const uid of candidateUids) {
        try {
          await admin.auth().deleteUser(uid);
          console.log(`Deleted Firebase Auth user ${uid} (fallback)`);
          break;
        } catch (err) {
          console.log(`Fallback auth delete attempt for ${uid} failed: ${err.message}`);
        }
      }
    }

    // Delete Firestore profile doc
    await docRef.delete();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: err.message });
  }
};

// Deactivate the currently authenticated user's account
// - Disables Firebase Auth sign-in for the user (admin.auth().updateUser({ disabled: true }))
// - Marks the Firestore user profile as { status: 'deactivated', active: false, deactivatedAt: serverTimestamp() }
exports.deactivateSelf = async (req, res) => {
  try {
    const uid = (req.user && (req.user.uid || req.user.id)) || null;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    // Disable Firebase Auth user (best-effort)
    let disabledAuth = false;
    try {
      await admin.auth().updateUser(uid, { disabled: true });
      // Revoke all refresh tokens to force sign-out across devices
      try { await admin.auth().revokeRefreshTokens(uid); } catch (e) {}
      disabledAuth = true;
    } catch (e) {
      console.warn('Failed to disable Firebase Auth user', uid, e && e.message);
    }

    // Update Firestore profile
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    const payload = { status: 'deactivated', active: false, deactivatedAt: stamp, updatedAt: stamp };
    let updatedDocId = null;
    // Prefer doc by id == req.user.id if present
    try {
      const primaryId = req.user && req.user.id;
      if (primaryId) {
        const ref = db.collection('users').doc(String(primaryId));
        const snap = await ref.get();
        if (snap.exists) { await ref.set(payload, { merge: true }); updatedDocId = ref.id; }
      }
    } catch (e) { /* ignore */ }
    // Fall back to doc id == uid
    if (!updatedDocId) {
      try {
        const ref = db.collection('users').doc(String(uid));
        const snap = await ref.get();
        if (snap.exists) { await ref.set(payload, { merge: true }); updatedDocId = ref.id; }
      } catch (e) {}
    }
    // Fall back to lookup by authId
    if (!updatedDocId) {
      try {
        const q = await db.collection('users').where('authId', '==', String(uid)).limit(1).get();
        if (!q.empty) { const ref = q.docs[0].ref; await ref.set(payload, { merge: true }); updatedDocId = ref.id; }
      } catch (e) {}
    }

    res.json({ ok: true, disabledAuth, updatedDocId });
  } catch (err) {
    console.error('deactivateSelf error', err);
    res.status(500).json({ error: err.message });
  }
};
