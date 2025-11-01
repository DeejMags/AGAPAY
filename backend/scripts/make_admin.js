// Promote a user to admin by email or uid.
// Usage:
//   node scripts/make_admin.js --email user@example.com
//   node scripts/make_admin.js --uid firebaseUid

const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') });
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
  require('dotenv').config();
} catch {}

const { admin, db } = require('../config/firebaseAdmin');

async function main() {
  const args = process.argv.slice(2);
  const emailArg = (args.find(a => a.startsWith('--email=')) || '').split('=')[1] || null;
  const uidArg = (args.find(a => a.startsWith('--uid=')) || '').split('=')[1] || null;

  if (!emailArg && !uidArg) {
    console.error('Provide --email or --uid');
    process.exit(1);
  }

  let userRecord;
  try {
    if (emailArg) userRecord = await admin.auth().getUserByEmail(emailArg);
    else userRecord = await admin.auth().getUser(uidArg);
  } catch (e) {
    console.error('Failed to find auth user:', e.message);
    process.exit(2);
  }

  const uid = userRecord.uid;
  const email = userRecord.email || emailArg || null;

  // Set custom claims
  try {
    await admin.auth().setCustomUserClaims(uid, { role: 'admin', isAdmin: true });
    console.log('Custom claims set for', uid);
  } catch (e) {
    console.warn('Failed to set custom claims:', e.message);
  }

  // Update Firestore user doc(s)
  try {
    // Prefer doc by id == uid
    const refById = db.collection('users').doc(uid);
    const snapById = await refById.get();
    if (snapById.exists) {
      await refById.set({ role: 'admin', isAdmin: true, roles: ['admin'] }, { merge: true });
      console.log('Updated users doc (by id):', refById.id);
    }

    // Also update by email if present
    if (email) {
      const q = await db.collection('users').where('email', '==', email).get();
      for (const d of q.docs) {
        await d.ref.set({ role: 'admin', isAdmin: true, roles: ['admin'] }, { merge: true });
        console.log('Updated users doc (by email):', d.id);
      }
    }

    // And by authId if present
    const q2 = await db.collection('users').where('authId', '==', uid).get();
    for (const d of q2.docs) {
      await d.ref.set({ role: 'admin', isAdmin: true, roles: ['admin'] }, { merge: true });
      console.log('Updated users doc (by authId):', d.id);
    }
  } catch (e) {
    console.warn('Failed to update Firestore users profile(s):', e.message);
  }

  console.log('Done. You may need to sign out and sign back in for claims to take effect.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
