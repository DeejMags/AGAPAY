const { admin, db } = require('../config/firebaseAdmin');
const cloudinary = require('../config/cloudinary');
const { sanitizeUnlocked, isValidBadgeTier, BADGE_THRESHOLDS, badgeLabelFromTier } = require('../config/badges');

function isAdminUser(user = {}) {
  if (!user || typeof user !== 'object') return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const claims = user.customClaims || {};
  return Boolean(
    user.isAdmin ||
    user.admin ||
    user.role === 'admin' ||
    roles.includes('admin') ||
    claims.isAdmin ||
    claims.admin ||
    claims.role === 'admin'
  );
}

function matchesUserIdentity(user = {}, identifier) {
  if (!identifier) return false;
  const needle = String(identifier).trim();
  const candidates = [user.id, user.uid, user.authId]
    .filter(Boolean)
    .map(value => String(value).trim());
  return candidates.includes(needle);
}

async function findUserDocument(usersCol, identifier) {
  const key = String(identifier || '').trim();
  if (!key) return null;

  let ref = usersCol.doc(key);
  let snapshot = await ref.get();
  if (snapshot && snapshot.exists) return { ref, snapshot };

  const byAuth = await usersCol.where('authId', '==', key).limit(1).get();
  if (!byAuth.empty) {
    const doc = byAuth.docs[0];
    return { ref: doc.ref, snapshot: doc };
  }

  if (key.includes('@')) {
    const byEmail = await usersCol.where('email', '==', key).limit(1).get();
    if (!byEmail.empty) {
      const doc = byEmail.docs[0];
      return { ref: doc.ref, snapshot: doc };
    }
    const lower = key.toLowerCase();
    if (lower !== key) {
      const byLower = await usersCol.where('email', '==', lower).limit(1).get();
      if (!byLower.empty) {
        const doc = byLower.docs[0];
        return { ref: doc.ref, snapshot: doc };
      }
    }
  }

  return null;
}

function normalizeBadgeSelection(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === 'none' || normalized === 'null') return null;
  return normalized;
}


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
    const incomingId = String(req.params.id || '').trim();
  const payload = { ...(req.body || {}) };
  if (payload.email) payload.email = String(payload.email).trim();
  if (payload.phone) payload.phone = String(payload.phone).trim();
  if (payload.name) payload.name = String(payload.name).trim();
  if (payload.location) payload.location = String(payload.location).trim();

    // Always update timestamps on profile saves
    const now = admin.firestore.FieldValue.serverTimestamp();
    if (!payload.updatedAt) payload.updatedAt = now;

    const usersCol = db.collection('users');
    let targetRef = usersCol.doc(incomingId);
    let snapshot = incomingId ? await targetRef.get() : null;

    // Try matching by authId when the Firestore doc id differs from Firebase UID
    if ((!snapshot || !snapshot.exists) && incomingId) {
      const byAuth = await usersCol.where('authId', '==', incomingId).limit(1).get();
      if (!byAuth.empty) {
        targetRef = byAuth.docs[0].ref;
        snapshot = byAuth.docs[0];
      }
    }

    // Try matching by email when provided
    if ((!snapshot || !snapshot.exists) && payload.email) {
      const byEmail = await usersCol.where('email', '==', payload.email).limit(1).get();
      if (!byEmail.empty) {
        targetRef = byEmail.docs[0].ref;
        snapshot = byEmail.docs[0];
      } else if (payload.email.toLowerCase && payload.email.toLowerCase() !== payload.email) {
        const byLower = await usersCol.where('email', '==', payload.email.toLowerCase()).limit(1).get();
        if (!byLower.empty) {
          targetRef = byLower.docs[0].ref;
          snapshot = byLower.docs[0];
        }
      }
    }

    let existingData = snapshot && snapshot.exists ? snapshot.data() : null;

    // Handle profile photo uploads/removals via Cloudinary when provided
    const rawPic = typeof payload.profilePic === 'string' ? payload.profilePic.trim() : payload.profilePic;
    const wantsRemoval = rawPic === '' || rawPic === null;
    const isDataUri = typeof rawPic === 'string' && rawPic.startsWith('data:image');
    if (wantsRemoval) {
      if (existingData && existingData.profilePicPublicId && cloudinary && process.env.CLOUDINARY_CLOUD_NAME) {
        try {
          await cloudinary.uploader.destroy(existingData.profilePicPublicId, { invalidate: true });
        } catch (e) {
          console.warn('Failed to delete Cloudinary profile image', e?.message || e);
        }
      }
      payload.profilePic = admin.firestore.FieldValue.delete();
      payload.profilePicPublicId = admin.firestore.FieldValue.delete();
    } else if (isDataUri) {
      if (!cloudinary || !process.env.CLOUDINARY_CLOUD_NAME) {
        throw new Error('cloudinary_not_configured');
      }
      const folder = process.env.CLOUDINARY_PROFILE_FOLDER || process.env.CLOUDINARY_FOLDER || 'agapay/users';
      const uploadOpts = { invalidate: true, overwrite: true };
      if (existingData && existingData.profilePicPublicId) uploadOpts.public_id = existingData.profilePicPublicId;
      else uploadOpts.folder = folder;
      const uploadRes = await cloudinary.uploader.upload(rawPic, uploadOpts);
      payload.profilePic = uploadRes.secure_url;
      payload.profilePicPublicId = uploadRes.public_id;
    } else if (typeof rawPic === 'string' && rawPic.startsWith('http')) {
      if (!payload.profilePicPublicId && existingData && existingData.profilePic === rawPic) {
        payload.profilePicPublicId = existingData.profilePicPublicId || null;
      }
    } else if (rawPic === undefined) {
      delete payload.profilePic;
    }

    // If still not found, create or merge into the document keyed by incomingId
    if (!snapshot || !snapshot.exists) {
      const baseCreate = {
        authId: payload.authId || incomingId || null,
        createdAt: now,
      };
      await targetRef.set({ ...baseCreate, ...payload }, { merge: true });
      const created = await targetRef.get();
      return res.json({ id: targetRef.id, ...(created.data() || {}) });
    }

    await targetRef.set(payload, { merge: true });
    const updated = await targetRef.get();
    res.json({ id: targetRef.id, ...(updated.data() || {}) });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.setEquippedBadge = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });

    const targetId = String(req.params.id || '').trim();
    if (!targetId) return res.status(400).json({ error: 'user_id_required' });

    const allowAdmin = isAdminUser(req.user);
    const isSelf = matchesUserIdentity(req.user, targetId);
    if (!allowAdmin && !isSelf) return res.status(403).json({ error: 'forbidden' });

    const body = req.body || {};
    const tierKeys = ['tier', 'badge', 'equippedBadge', 'value'];
    const tierProvided = tierKeys.some(key => Object.prototype.hasOwnProperty.call(body, key));
    const requestedTier = normalizeBadgeSelection(body.tier ?? body.badge ?? body.equippedBadge ?? body.value ?? null);
    if (requestedTier && !isValidBadgeTier(requestedTier)) {
      return res.status(400).json({ error: 'invalid_badge_tier' });
    }
    const visibilityKeys = ['showOnProfile', 'showBadgeOnProfile', 'show', 'visible', 'visibility'];
    const visibilityProvided = visibilityKeys.some(key => Object.prototype.hasOwnProperty.call(body, key));
    let showOnProfile = undefined;
    if (visibilityProvided) {
      const rawVisibility = body.showOnProfile ?? body.showBadgeOnProfile ?? body.show ?? body.visible ?? body.visibility;
      showOnProfile = Boolean(rawVisibility);
    }

    const usersCol = db.collection('users');
    const resolved = await findUserDocument(usersCol, targetId);
    if (!resolved) return res.status(404).json({ error: 'user_not_found' });

    const existing = resolved.snapshot.data() || {};
    const unlocked = sanitizeUnlocked(existing.badgesUnlocked || []);
    if (requestedTier && (unlocked.length === 0 || !unlocked.includes(requestedTier))) {
      return res.status(400).json({ error: 'badge_not_unlocked' });
    }

    const previousEquipped = normalizeBadgeSelection(existing.equippedBadge);
    const previousShow = existing.showBadgeOnProfile === undefined ? true : !!existing.showBadgeOnProfile;
    let mutated = false;
    const update = {};
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (tierProvided) {
      if (requestedTier) {
        if (requestedTier !== previousEquipped) {
          update.equippedBadge = requestedTier;
          mutated = true;
        }
      } else if (previousEquipped) {
        update.equippedBadge = admin.firestore.FieldValue.delete();
        mutated = true;
      }
    }

    if (visibilityProvided) {
      if (showOnProfile !== previousShow) {
        update.showBadgeOnProfile = showOnProfile;
        mutated = true;
      }
    }

    if (mutated) {
      update.updatedAt = now;
      update.badgeUpdatedAt = now;
      await resolved.ref.set(update, { merge: true });
    } else if (tierProvided || visibilityProvided) {
      await resolved.ref.set({ updatedAt: now }, { merge: true });
    }

    const fresh = await resolved.ref.get();
    const payload = fresh.data() || {};
    const sanitized = sanitizeUnlocked(payload.badgesUnlocked || []);
    const equipped = normalizeBadgeSelection(payload.equippedBadge);
    const showFlag = payload.showBadgeOnProfile === undefined ? true : !!payload.showBadgeOnProfile;
    const highestRaw = payload.highestBadgeTier || payload.badgeTier || null;
    const highest = normalizeBadgeSelection(highestRaw);
    const response = {
      id: fresh.id,
      equippedBadge: equipped && isValidBadgeTier(equipped) ? equipped : null,
      badgesUnlocked: sanitized,
      highestBadgeTier: highest,
      showBadgeOnProfile: showFlag,
      badgeUpdatedAt: payload.badgeUpdatedAt && payload.badgeUpdatedAt.toDate
        ? payload.badgeUpdatedAt.toDate().toISOString()
        : null,
    };

    const tierChanged = tierProvided && ((requestedTier && requestedTier !== previousEquipped) || (!requestedTier && !!previousEquipped));
    const visibilityChanged = visibilityProvided && (showOnProfile !== previousShow);
    const shouldRecordHistory = (tierChanged || visibilityChanged) && (matchesUserIdentity(req.user, fresh.id) || isAdminUser(req.user));
    if (shouldRecordHistory) {
      const historyRef = db.collection('points_history').doc(`badgeEquip_${fresh.id}_${Date.now()}`);
      const action = tierChanged
        ? (response.equippedBadge ? 'equip' : 'unequip')
        : (response.showBadgeOnProfile ? 'show' : 'hide');
      await historyRef.set({
        sellerId: fresh.id,
        buyerId: null,
        sellerPoints: 0,
        buyerPoints: 0,
        totalPoints: 0,
        productId: null,
        productTitle: null,
        eventType: 'badge_equip',
        badgeTier: response.equippedBadge || highest || null,
        badgeLabel: badgeLabelFromTier(response.equippedBadge || highest || null) || null,
        badgeAction: action,
        showBadgeOnProfile: response.showBadgeOnProfile,
        equippedBadge: response.equippedBadge || null,
        isBadgeEquipEvent: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json(response);
  } catch (err) {
    console.error('setEquippedBadge error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getBadgeFeed = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });

    const targetId = String(req.params.id || '').trim();
    if (!targetId) return res.status(400).json({ error: 'user_id_required' });

    const allowAdmin = isAdminUser(req.user);
    const isSelf = matchesUserIdentity(req.user, targetId);
    if (!allowAdmin && !isSelf) return res.status(403).json({ error: 'forbidden' });

    const limitParam = Math.min(25, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const fetchLimit = limitParam * 3;
    const historyCol = db.collection('points_history');

    async function fetchHistory(roleField) {
      try {
        return await historyCol.where(roleField, '==', targetId).orderBy('createdAt', 'desc').limit(fetchLimit).get();
      } catch (err) {
        const msg = (err && (err.message || err.code)) || '';
        if (/FAILED_PRECONDITION|requires an index/i.test(msg)) {
          return await historyCol.where(roleField, '==', targetId).limit(fetchLimit).get();
        }
        throw err;
      }
    }

    const [sellerSnap, buyerSnap] = await Promise.all([
      fetchHistory('sellerId'),
      fetchHistory('buyerId'),
    ]);

    const entries = [];

    const toMillis = (value) => {
      if (!value) return Date.now();
      if (typeof value.toDate === 'function') {
        const date = value.toDate();
        return Number.isNaN(date?.getTime()) ? Date.now() : date.getTime();
      }
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? Date.now() : parsed;
    };

    const buildUnlockEntries = (docId, data, role, createdAtMs) => {
      const rawList = role === 'seller' ? data.sellerBadgeUnlocks : data.buyerBadgeUnlocks;
      const unlockedList = Array.isArray(rawList) ? sanitizeUnlocked(rawList) : [];
      if (!unlockedList.length) return;
      const productTitle = data.productTitle || null;
      const totalPoints = data.totalPoints || null;
      unlockedList.forEach((tier, idx) => {
        const label = badgeLabelFromTier(tier) || (tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Badge');
        const createdAtIso = new Date(createdAtMs).toISOString();
        entries.push({
          id: `${docId}:${role}:unlock:${tier || idx}`,
          tier,
          label,
          role,
          type: 'unlock',
          action: 'unlock',
          createdAt: createdAtIso,
          timestamp: createdAtMs,
          totalPoints,
          productTitle,
          title: `${label} badge unlocked`,
          message: productTitle
            ? `You unlocked the ${label} badge after completing "${productTitle}" as a ${role}.`
            : `You unlocked the ${label} badge as a ${role}.`,
        });
      });
    };

    const buildVisibilityEntry = (docId, data, createdAtMs) => {
      if (!(data && (data.isBadgeEquipEvent || data.eventType === 'badge_equip'))) return;
      const createdAtIso = new Date(createdAtMs).toISOString();
      const tier = normalizeBadgeSelection(data.equippedBadge || data.badgeTier || null);
      const label = badgeLabelFromTier(tier) || (tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : null);
      const action = data.badgeAction || (data.showBadgeOnProfile === false ? 'hide' : tier ? 'equip' : 'unequip');
      let title = 'Badge updated';
      let message = '';
      switch (action) {
        case 'hide':
          title = 'Badge hidden';
          message = label ? `${label} is now hidden on your profile.` : 'Your badge is now hidden on your profile.';
          break;
        case 'show':
          title = 'Badge visible';
          message = label ? `${label} is now visible on your profile.` : 'Your badge is now visible on your profile.';
          break;
        case 'unequip':
          title = 'Profile badge cleared';
          message = 'Automatic badge selection has been restored on your profile.';
          break;
        default:
          title = label ? `${label} equipped` : 'Badge equipped';
          message = label ? `You are now showcasing the ${label} badge.` : 'You are now showcasing a badge on your profile.';
      }

      entries.push({
        id: `${docId}:seller:visibility:${createdAtMs}`,
        tier,
        label,
        role: 'seller',
        type: 'visibility',
        action,
        createdAt: createdAtIso,
        timestamp: createdAtMs,
        title,
        message,
      });
    };

    sellerSnap.forEach((doc) => {
      const data = doc.data() || {};
      const createdAtMs = toMillis(data.createdAt);
      buildUnlockEntries(doc.id, data, 'seller', createdAtMs);
      buildVisibilityEntry(doc.id, data, createdAtMs);
    });

    buyerSnap.forEach((doc) => {
      const data = doc.data() || {};
      const createdAtMs = toMillis(data.createdAt);
      buildUnlockEntries(doc.id, data, 'buyer', createdAtMs);
    });

    entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    res.json({ items: entries.slice(0, limitParam) });
  } catch (err) {
    console.error('getBadgeFeed error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Return merged raw points_history documents for a given user (seller or buyer)
exports.getPointsHistory = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });

    const targetId = String(req.params.id || '').trim();
    if (!targetId) return res.status(400).json({ error: 'user_id_required' });

    const allowAdmin = isAdminUser(req.user);
    const isSelf = matchesUserIdentity(req.user, targetId);
    if (!allowAdmin && !isSelf) return res.status(403).json({ error: 'forbidden' });

    const limitParam = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const historyCol = db.collection('points_history');

    async function fetchHistory(roleField) {
      try {
        return await historyCol.where(roleField, '==', targetId).orderBy('createdAt', 'desc').limit(limitParam).get();
      } catch (err) {
        const msg = (err && (err.message || err.code)) || '';
        if (/FAILED_PRECONDITION|requires an index/i.test(msg)) {
          return await historyCol.where(roleField, '==', targetId).limit(limitParam).get();
        }
        throw err;
      }
    }

    const [sellerSnap, buyerSnap] = await Promise.all([
      fetchHistory('sellerId'),
      fetchHistory('buyerId'),
    ]);

    const toIso = (value) => {
      if (!value) return null;
      if (typeof value.toDate === 'function') return value.toDate().toISOString();
      if (typeof value === 'number') return new Date(value).toISOString();
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
    };

    const docs = [...sellerSnap.docs, ...buyerSnap.docs]
      .map(d => {
        const data = d.data() || {};
        return { id: d.id, ...data, createdAt: toIso(data.createdAt) };
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, limitParam);

    res.json({ items: docs });
  } catch (err) {
    console.error('getPointsHistory error:', err);
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

// Admin: ban a user by Firestore doc id, Firebase auth uid, or email
// - Disables Firebase Auth sign-in for the user (updateUser({ disabled: true }) + revoke tokens)
// - Marks Firestore profile as { status: 'banned', banned: true, bannedAt, banReason }
exports.banUser = async (req, res) => {
  try {
    const allowAll = process.env.REPORTS_DEV_ALLOW_ALL === 'true' || process.env.NODE_ENV !== 'production';
    // Basic admin gating: allow non-admins only in dev
    const isAdmin = !!(req.user && (req.user.isAdmin || req.user.admin || req.user.role === 'admin' || (req.user.roles || []).includes('admin') || (req.user.customClaims && (req.user.customClaims.isAdmin || req.user.customClaims.admin || req.user.customClaims.role === 'admin'))));
    if (!isAdmin && !allowAll) return res.status(403).json({ error: 'forbidden' });

    const id = String(req.params.id);
    const reason = (req.body && (req.body.reason || req.body.details)) || null;

    // Resolve user: try by doc id, uid, email, or authId
    let docRef = db.collection('users').doc(id);
    let doc = await docRef.get();
    if (!doc.exists) {
      // try authId == id
      const byAuth = await db.collection('users').where('authId', '==', id).limit(1).get();
      if (!byAuth.empty) { docRef = byAuth.docs[0].ref; doc = byAuth.docs[0]; }
    }
    if (!doc.exists && id.includes('@')) {
      // try email == id
      const byEmail = await db.collection('users').where('email', '==', id).limit(1).get();
      if (!byEmail.empty) { docRef = byEmail.docs[0].ref; doc = byEmail.docs[0]; }
    }
    if (!doc.exists) return res.status(404).json({ error: 'user_not_found' });

    const data = doc.data() || {};
    const uid = data.authId || data.uid || data.userId || doc.id;

    // Disable Firebase Auth (best-effort)
    let disabledAuth = false;
    try {
      await admin.auth().updateUser(uid, { disabled: true });
      try { await admin.auth().revokeRefreshTokens(uid); } catch (e) {}
      disabledAuth = true;
    } catch (e) {
      console.warn('banUser: failed to disable auth user', uid, e && e.message);
    }

    // Update Firestore profile
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    const payload = { status: 'banned', banned: true, bannedAt: stamp, updatedAt: stamp };
    if (reason) payload.banReason = String(reason);
    await docRef.set(payload, { merge: true });

    res.json({ ok: true, userId: docRef.id, disabledAuth });
  } catch (err) {
    console.error('banUser error', err);
    res.status(500).json({ error: err.message });
  }
};
