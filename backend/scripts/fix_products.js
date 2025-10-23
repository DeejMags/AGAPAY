// backend/scripts/fix_products.js
// Usage: node scripts/fix_products.js
// This script normalizes product documents in Firestore:
// - normalizes `status` to one of ['pending','active','denied','offline'] (picks the first valid token)
// - sets `createdAt` server timestamp if missing
// - attempts to fill `sellerId` by matching product owner/email/sellerName to a user document's email or name
// - logs changes and applies updates

const { admin, db } = require('../config/firebaseAdmin');

const VALID_STATUSES = ['pending', 'active', 'denied', 'offline'];

function normalizeStatus(raw) {
  if (!raw) return 'pending';
  if (typeof raw !== 'string') return 'pending';
  // split by common separators
  const parts = raw.split(/[,;|/]+/).map(p => p.trim()).filter(Boolean);
  for (const p of parts) {
    const cand = p.toLowerCase();
    if (VALID_STATUSES.includes(cand)) return cand;
  }
  // fallback: if raw includes a valid token inside, pick it
  const lower = raw.toLowerCase();
  for (const s of VALID_STATUSES) if (lower.includes(s)) return s;
  return 'pending';
}

async function findUserIdByEmailOrName(email, name) {
  if (!email && !name) return null;
  try {
    if (email) {
      const q = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!q.empty) return q.docs[0].id;
    }
    if (name) {
      const q2 = await db.collection('users').where('name', '==', name).limit(1).get();
      if (!q2.empty) return q2.docs[0].id;
    }
  } catch (e) {
    console.warn('findUserIdByEmailOrName error', e.message || e);
  }
  return null;
}

(async function main() {
  console.log('Starting product normalization...');
  try {
    const snapshot = await db.collection('products').get();
    if (snapshot.empty) {
      console.log('No products found.');
      process.exit(0);
    }

    let updatedCount = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data() || {};
      const updates = {};

      // Normalize status
      const normalized = normalizeStatus(data.status);
      if (normalized !== data.status) updates.status = normalized;

      // Ensure createdAt exists
      if (!data.createdAt) updates.createdAt = admin.firestore.FieldValue.serverTimestamp();

      // Try to fill sellerId if missing
      if (!data.sellerId || data.sellerId === '') {
        const candidateEmails = [data.owner, data.email, data.sellerEmail].filter(Boolean);
        const candidateName = data.sellerName || data.ownerName || data.name || null;
        let foundId = null;
        for (const email of candidateEmails) {
          foundId = await findUserIdByEmailOrName(email, null);
          if (foundId) break;
        }
        if (!foundId && candidateName) foundId = await findUserIdByEmailOrName(null, candidateName);
        if (foundId) updates.sellerId = foundId;
      }

      // Ensure minimal fields defaults
      if (!('sellerName' in data) && data.sellerId) {
        try {
          const userDoc = await db.collection('users').doc(updates.sellerId || data.sellerId).get();
          if (userDoc.exists) updates.sellerName = userDoc.data().name || userDoc.data().displayName || '';
        } catch (e) {
          // swallow
        }
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        console.log(`Updating product ${doc.id} ->`, updates);
        await db.collection('products').doc(doc.id).update(updates);
        updatedCount++;
      }
    }
    console.log(`Done. Updated ${updatedCount} products.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  }
})();
