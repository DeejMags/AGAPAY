const { admin, db } = require('../config/firebaseAdmin');

exports.register = async (req, res) => {
  try {
    const { email, password, ...rest } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    // Normalize email for consistent comparisons
    const normalizedEmail = String(email).trim().toLowerCase();

    // Check Firestore users collection first for existing email
    const usersRef = db.collection('users');
    const existingProfileQ = await usersRef.where('email', '==', normalizedEmail).limit(1).get();
    if (!existingProfileQ.empty) return res.status(409).json({ error: 'Email already exists!' });

    // Check Firebase Auth for existing user with this email
    try {
      const existingAuthUser = await admin.auth().getUserByEmail(normalizedEmail);
      if (existingAuthUser) return res.status(409).json({ error: 'Email already exists!' });
    } catch (e) {
      // getUserByEmail throws if not found; ignore that case
      if (e.code && e.code !== 'auth/user-not-found') {
        console.error('Unexpected error checking auth user by email', e);
        return res.status(500).json({ error: 'Server error' });
      }
    }

    // Safe to create a new Auth user
    const userRecord = await admin.auth().createUser({ email: normalizedEmail, password });

    const createdAt = admin.firestore.FieldValue.serverTimestamp();
    // Derive consistent name fields
    const inputFirst = (rest.firstName || '').toString().trim();
    const inputLast = (rest.lastName || '').toString().trim();
    const inputSingle = (rest.name || rest.username || '').toString().trim();
    const firstName = inputFirst || (inputSingle ? inputSingle.split(' ').slice(0, -1).join(' ') : '');
    const lastName = inputLast || (inputSingle ? inputSingle.split(' ').slice(-1).join(' ') : '');
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || inputSingle;
    const displayName = fullName || undefined;
    const baseProfile = {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      name: fullName || undefined,
      username: fullName || rest.username || undefined,
      displayName: displayName || undefined,
      fullName: fullName || undefined,
      role: rest.role || 'user',
      phone: rest.phone || '',
      status: 'Active',
    };
    // Store minimal profile in Firestore and reference the auth uid. If a
    // profile with the same authId already exists, update it; otherwise create.
    // Ensure we perform profile lookup by authId after creating the auth user
    const q = await usersRef.where('authId', '==', userRecord.uid).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      await usersRef.doc(doc.id).update({ email: normalizedEmail, ...baseProfile, updatedAt: createdAt });
      return res.status(200).json({ id: doc.id, authId: userRecord.uid, email: normalizedEmail, ...baseProfile });
    }

    // If no profile exists, create a new one keyed by authId
    const profile = { authId: userRecord.uid, email: normalizedEmail, ...baseProfile, createdAt };
    const ref = await usersRef.add(profile);
    res.status(201).json({ id: ref.id, authId: userRecord.uid, email, ...baseProfile });
  } catch (err) {
    console.error('Auth register error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const norm = String(email || '').trim();
    const lower = norm.toLowerCase();

    // Try exact match first, then lowercase match
    let snapshot = await db.collection('users').where('email', '==', norm).get();
    if (snapshot.empty && lower !== norm) {
      snapshot = await db.collection('users').where('email', '==', lower).get();
    }

    // If not found in Firestore, try to resolve via Firebase Auth then find profile by authId
    if (snapshot.empty) {
      try {
        const authUser = await admin.auth().getUserByEmail(norm).catch(() => null);
        if (authUser) {
          const byAuth = await db.collection('users').where('authId', '==', authUser.uid).limit(1).get();
          if (!byAuth.empty) {
            const doc = byAuth.docs[0];
            return res.json({ id: doc.id, ...doc.data() });
          }
          // If no Firestore profile exists, return a minimal profile built from auth user
          return res.json({ id: authUser.uid, authId: authUser.uid, email: authUser.email || norm, username: authUser.displayName || null });
        }
      } catch (e) {
        // ignore and fall through
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // We don't store plaintext passwords anymore; this endpoint only returns profile by email.
    const user = snapshot.docs[0];
    res.json({ id: user.id, ...user.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Ensure a Firestore profile exists for a Google-signed-in user (or return existing)
exports.google = async (req, res) => {
  try {
    const { email, name, uid } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Try to find an auth user by uid or email
    let userRecord = null;
    try {
      if (uid) userRecord = await admin.auth().getUser(uid);
    } catch (e) {
      // ignore
    }
    if (!userRecord) {
      try {
        userRecord = await admin.auth().getUserByEmail(email);
      } catch (e) {
        // If no auth user exists, we won't create an Auth user here (client already created one)
        // but we'll still create a Firestore profile keyed by authId if possible.
      }
    }

    const usersRef = db.collection('users');
    // If we have an auth uid, try to find profile by authId
    if (userRecord && userRecord.uid) {
      const q = await usersRef.where('authId', '==', userRecord.uid).limit(1).get();
      if (!q.empty) return res.json({ id: q.docs[0].id, ...q.docs[0].data() });
    }

    // If no profile by authId, try to find by email
    const q2 = await usersRef.where('email', '==', email).limit(1).get();
    if (!q2.empty) return res.json({ id: q2.docs[0].id, ...q2.docs[0].data() });

    // Create a new profile (authId if we have it)
    const createdAt = admin.firestore.FieldValue.serverTimestamp();
    const profile = { authId: userRecord ? userRecord.uid : (uid || null), email, username: name || '', role: 'user', status: 'Active', createdAt };
    const ref = await usersRef.add(profile);
    res.status(201).json({ id: ref.id, ...profile });
  } catch (err) {
    console.error('google profile ensure error', err);
    res.status(500).json({ error: err.message });
  }
};

// Check availability of an email address (returns { available: true/false })
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const normalizedEmail = String(email).trim().toLowerCase();
    const usersRef = db.collection('users');
    const q = await usersRef.where('email', '==', normalizedEmail).limit(1).get();
    if (!q.empty) return res.json({ available: false });
    try {
      const u = await admin.auth().getUserByEmail(normalizedEmail);
      if (u) return res.json({ available: false });
    } catch (e) {
      if (e.code && e.code !== 'auth/user-not-found') {
        console.error('Error checking auth for email', e);
        return res.status(500).json({ error: 'Server error' });
      }
    }
    return res.json({ available: true });
  } catch (err) {
    console.error('checkEmail error', err);
    res.status(500).json({ error: err.message });
  }
};
