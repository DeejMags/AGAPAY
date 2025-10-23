// backend/config/firebaseAdmin.js
// This file initializes Firebase Admin unless DISABLE_FIREBASE=true is set.
// When DISABLE_FIREBASE=true we export nulls so the rest of the app can detect
// Firebase is intentionally disabled and avoid using it.
if (process.env.DISABLE_FIREBASE === 'true') {
  console.log('Firebase Admin is disabled via DISABLE_FIREBASE=true');
  module.exports = { admin: null, db: null };
} else {
  const admin = require('firebase-admin');
  const serviceAccount = require('./serviceAccountKey.json');

  if (!admin.apps.length) {
    // Prefer explicit environment config for storage bucket, else derive from service account project_id
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || (serviceAccount && serviceAccount.project_id ? `${serviceAccount.project_id}.appspot.com` : undefined);
    const initConfig = { credential: admin.credential.cert(serviceAccount) };
    if (bucketName) initConfig.storageBucket = bucketName;
    admin.initializeApp(initConfig);
  }

  const db = admin.firestore();
  module.exports = { admin, db };
}
