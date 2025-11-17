const { admin, db } = require('../config/firebaseAdmin');

exports.register = async (req, res) => {
  try {
    const { email, password, ...rest } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    // Try to create user in Firebase Auth. If the email already exists in Auth
    // we will return a helpful message and ensure the Firestore profile exists.
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({ email, password });
    } catch (err) {
      // If the user already exists in Firebase Auth, ensure a profile exists in Firestore
      if (err.code === 'auth/email-already-exists' || (err.message && err.message.includes('email already exists'))) {
        // Try to lookup the existing auth user
        try {
          userRecord = await admin.auth().getUserByEmail(email);
        } catch (e) {
          console.error('Failed to get existing auth user for email already-in-use case', e);
          return res.status(409).json({ error: 'Email already exists' });
        }
      } else {
        throw err;
      }
    }

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
    const usersRef = db.collection('users');
    const q = await usersRef.where('authId', '==', userRecord.uid).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      await usersRef.doc(doc.id).update({ email, ...baseProfile, updatedAt: createdAt });
      return res.status(200).json({ id: doc.id, authId: userRecord.uid, email, ...baseProfile });
    }

    // If no profile exists, create a new one keyed by authId
    const profile = { authId: userRecord.uid, email, ...baseProfile, createdAt };
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
    const snapshot = await db
      .collection('users')
      .where('email', '==', email)
      .get();
    if (snapshot.empty) return res.status(401).json({ error: 'Invalid credentials' });

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
