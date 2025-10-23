// backend/config/firebaseAdmin.js
// This file initializes Firebase Admin unless DISABLE_FIREBASE=true is set.
// When DISABLE_FIREBASE=true we export nulls so the rest of the app can detect
// Firebase is intentionally disabled and avoid using it.
if (process.env.DISABLE_FIREBASE === 'true') {
  console.log('Firebase Admin is disabled via DISABLE_FIREBASE=true');
  module.exports = { admin: null, db: null };
} else {
  const admin = require('firebase-admin');

  // Try to build credentials from environment variables first
  const envProjectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private key may contain literal \n characters when stored in .env; convert to real newlines
  const envPrivateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
  const envPrivateKey = envPrivateKeyRaw ? envPrivateKeyRaw.replace(/\\n/g, '\n') : undefined;

  let credential; // admin.credential object
  let projectIdForBucket = envProjectId;

  if (envProjectId && envClientEmail && envPrivateKey) {
    credential = admin.credential.cert({
      project_id: envProjectId,
      client_email: envClientEmail,
      private_key: envPrivateKey,
    });
  }

  // Fallback to local JSON file if env vars are not fully provided
  let serviceAccount;
  if (!credential) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      serviceAccount = require('./serviceAccountKey.json');
      credential = admin.credential.cert(serviceAccount);
      projectIdForBucket = projectIdForBucket || (serviceAccount && serviceAccount.project_id);
    } catch (e) {
      console.error('Firebase Admin credentials missing. Provide env vars or serviceAccountKey.json');
      throw e;
    }
  }

  if (!admin.apps.length) {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || (projectIdForBucket ? `${projectIdForBucket}.appspot.com` : undefined);
    const initConfig = { credential };
    if (bucketName) initConfig.storageBucket = bucketName;
    admin.initializeApp(initConfig);
  }

  const db = admin.firestore();
  module.exports = { admin, db };
}
