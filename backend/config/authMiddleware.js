const { admin, db } = require('../config/firebaseAdmin');
const { buildUserNameData } = require('../utils/nameUtils');

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
  if (!auth) {
    console.warn('authMiddleware: No Authorization header received');
    return res.status(401).json({ message: 'No token' });
  }

  const token = auth.split(' ')[1];
  if (!token) {
    console.warn('authMiddleware: No token found after split');
    return res.status(401).json({ message: 'Invalid token format' });
  }
  
  try {
    console.log('authMiddleware: Verifying token...');
    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(token);

    // Start with decoded token so custom claims are preserved
    let merged = { ...decoded, uid: decoded.uid, email: decoded.email };

    // Try to load user profile from Firestore (optional) and merge on top
    const userRef = db.collection('users').doc(decoded.uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const user = userDoc.data();
      const nameData = buildUserNameData({
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        username: user.username,
        displayName: user.displayName,
        fullName: user.fullName,
        email: user.email,
      });
      const normalizedUser = {
        ...user,
        firstName: nameData.firstName || user.firstName || '',
        lastName: nameData.lastName || user.lastName || '',
        fullName: nameData.fullName || user.fullName || '',
        displayName: nameData.displayName || user.displayName || '',
        username: nameData.username || user.username || '',
        name: user.name || nameData.fullName || user.fullName || '',
      };
      
      // Only assign admin role to known admin emails; default missing roles to 'user'
      if (!normalizedUser.role) {
        const adminEmails = (process.env.ADMIN_EMAILS || 'admin@agapay.com,admin@gmail.com')
          .split(',').map(e => e.trim().toLowerCase());
        const defaultRole = adminEmails.includes((decoded.email || '').toLowerCase()) ? 'admin' : 'user';
        await userRef.update({ role: defaultRole });
        normalizedUser.role = defaultRole;
      }
      
      delete normalizedUser.password;
      merged = { ...merged, id: userDoc.id, ...normalizedUser };
    } else {
      // User doesn't exist in Firestore — create with correct role (never auto-admin)
      const adminEmails = (process.env.ADMIN_EMAILS || 'admin@agapay.com,admin@gmail.com')
        .split(',').map(e => e.trim().toLowerCase());
      const defaultRole = adminEmails.includes((decoded.email || '').toLowerCase()) ? 'admin' : 'user';
      const authName = decoded.name || decoded.display_name || null;
      const nameData = buildUserNameData({ name: authName, email: decoded.email });
      const newUserData = {
        uid: decoded.uid,
        email: decoded.email,
        firstName: nameData.firstName || '',
        lastName: nameData.lastName || '',
        name: nameData.fullName || authName,
        displayName: nameData.displayName || authName,
        fullName: nameData.fullName || authName,
        username: nameData.username || authName,
        role: defaultRole,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await userRef.set(newUserData);
      merged = { ...merged, id: decoded.uid, ...newUserData };
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
    console.error('Auth error:', err.code || err.message);
    console.error('Full error:', err);
    res.status(401).json({ message: 'Invalid token', error: err.code || err.message });
  }
}

module.exports = authMiddleware;
