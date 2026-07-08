const { admin, findRecordByField, addRecord, updateRecord } = require('../config/rtdbHelpers');
const { buildUserNameData } = require('../utils/nameUtils');

exports.register = async (req, res) => {
  try {
    const { email, password, ...rest } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    // Normalize email for consistent comparisons
    const normalizedEmail = String(email).trim().toLowerCase();

    // Check RTDB users for existing email
    const existingProfile = await findRecordByField('users', 'email', normalizedEmail);
    if (existingProfile) return res.status(409).json({ error: 'Email already exists!' });

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

    const createdAt = Date.now();
    const nameData = buildUserNameData({
      firstName: rest.firstName,
      lastName: rest.lastName,
      name: rest.name,
      username: rest.username,
      displayName: rest.displayName,
      fullName: rest.fullName,
      email: normalizedEmail,
    });
    const baseProfile = {
      firstName: nameData.firstName || undefined,
      lastName: nameData.lastName || undefined,
      name: nameData.fullName || undefined,
      username: nameData.username || undefined,
      displayName: nameData.displayName || undefined,
      fullName: nameData.fullName || undefined,
      role: rest.role || 'user',
      phone: rest.phone || '',
      status: 'Active',
    };
    
    // Check if profile with same authId already exists
    const existingByAuth = await findRecordByField('users', 'authId', userRecord.uid);
    if (existingByAuth) {
      await updateRecord('users', existingByAuth.id, { email: normalizedEmail, ...baseProfile, updatedAt: Date.now() });
      return res.status(200).json({ id: existingByAuth.id, authId: userRecord.uid, email: normalizedEmail, ...baseProfile });
    }

    // Create a new profile
    const profile = { authId: userRecord.uid, email: normalizedEmail, ...baseProfile, createdAt };
    const id = await addRecord('users', profile);
    res.status(201).json({ id, authId: userRecord.uid, email: normalizedEmail, ...baseProfile });
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
    let user = await findRecordByField('users', 'email', norm);
    if (!user && lower !== norm) {
      user = await findRecordByField('users', 'email', lower);
    }

    // If not found in RTDB, try to resolve via Firebase Auth then find profile by authId
    if (!user) {
      try {
        const authUser = await admin.auth().getUserByEmail(norm).catch(() => null);
        if (authUser) {
          const byAuth = await findRecordByField('users', 'authId', authUser.uid);
          if (byAuth) {
            return res.json({ id: byAuth.id, ...byAuth });
          }
          // If no RTDB profile exists, return a minimal profile built from auth user
          return res.json({ id: authUser.uid, authId: authUser.uid, email: authUser.email || norm, username: authUser.displayName || null });
        }
      } catch (e) {
        // ignore and fall through
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // We don't store plaintext passwords anymore; this endpoint only returns profile by email.
    res.json({ id: user.id, ...user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Ensure a RTDB profile exists for a Google-signed-in user (or return existing)
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
        // but we'll still create a RTDB profile keyed by authId if possible.
      }
    }

    // If we have an auth uid, try to find profile by authId
    if (userRecord && userRecord.uid) {
      const existingByAuth = await findRecordByField('users', 'authId', userRecord.uid);
      if (existingByAuth) return res.json({ id: existingByAuth.id, ...existingByAuth });
    }

    // If no profile by authId, try to find by email
    const existingByEmail = await findRecordByField('users', 'email', email);
    if (existingByEmail) return res.json({ id: existingByEmail.id, ...existingByEmail });

    // Create a new profile (authId if we have it)
    const createdAt = Date.now();
    const nameData = buildUserNameData({ name, email });
    const profile = {
      authId: userRecord ? userRecord.uid : (uid || null),
      email,
      firstName: nameData.firstName || undefined,
      lastName: nameData.lastName || undefined,
      name: nameData.fullName || undefined,
      username: nameData.username || undefined,
      displayName: nameData.displayName || undefined,
      fullName: nameData.fullName || undefined,
      role: 'user',
      status: 'Active',
      createdAt,
    };
    const id = await addRecord('users', profile);
    res.status(201).json({ id, ...profile });
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
    
    const existingUser = await findRecordByField('users', 'email', normalizedEmail);
    if (existingUser) return res.json({ available: false });
    
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
