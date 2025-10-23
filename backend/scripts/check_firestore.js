// backend/scripts/check_firestore.js
// Run with: node backend/scripts/check_firestore.js
// This script uses the existing firebaseAdmin initialization to print collection counts

const { admin, db } = require('../config/firebaseAdmin');

async function listCollection(name, limit = 10) {
  try {
    const snapshot = await db.collection(name).limit(limit).get();
    console.log(`Collection '${name}' - docs found: ${snapshot.size}`);
    snapshot.forEach(doc => {
      console.log(`- ${doc.id}:`, JSON.stringify(doc.data()));
    });
  } catch (err) {
    console.error(`Error reading collection ${name}:`, err.message || err);
  }
}

async function main() {
  console.log('Checking Firestore connectivity and sample documents...');
  await listCollection('users', 20);
  await listCollection('products', 20);
  process.exit(0);
}

main();
