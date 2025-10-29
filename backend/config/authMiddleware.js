const { admin, db } = require('../config/firebaseAdmin');

async function authMiddleware(req, res, next) {
  // Local dev helper: set SKIP_AUTH=true in env to bypass token verification.
  // Only allow this bypass in development mode to avoid accidental bypass in production.
  // If Firebase is disabled we shortcut auth and attach a dev user so routes still work
  if (process.env.DISABLE_FIREBASE === 'true') {
    req.user = { uid: 'dev', id: 'dev', email: 'dev@local', role: 'dev' };
    return next();
  }
  // Local dev helper: set SKIP_AUTH=true in env to bypass token verification.
  // Only allow this bypass in development mode to avoid accidental bypass in production.
  if (process.env.SKIP_AUTH === 'true' && process.env.NODE_ENV === 'development') {
    req.user = { uid: 'dev', email: 'dev@local', role: 'dev' };
    return next();
  }
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });

  const token = auth.split(' ')[1];
  try {
    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(token);

    // Start with decoded token so custom claims are preserved
    let merged = { ...decoded, uid: decoded.uid, email: decoded.email };

    // Try to load user profile from Firestore (optional) and merge on top
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (userDoc.exists) {
      const user = userDoc.data();
      delete user.password;
      merged = { ...merged, id: userDoc.id, ...user };
    }

    // Normalize customClaims property for downstream checks
    merged.customClaims = {
      role: decoded.role,
      isAdmin: decoded.isAdmin,
      admin: decoded.admin,
    };

    req.user = merged;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = authMiddleware;
