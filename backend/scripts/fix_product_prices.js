/**
 * Script: fix_product_prices.js
 * Purpose: Scan all documents in the 'products' collection and coerce the 'price' field to a number or null.
 * Usage: From the backend folder run: node scripts/fix_product_prices.js
 */
const { admin, db } = require('../config/firebaseAdmin');

function parsePrice(value) {
  if (value === null || value === undefined) return null;
  if (value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    let s = value.trim();
    s = s.replace(/[\s\$£€₱¥₹]/g, '');
    if (s.includes(',') && !s.includes('.')) s = s.replace(/,/g, '.'); else s = s.replace(/,/g, '');
    s = s.replace(/[^0-9.\-]/g, '');
    if (s === '' || s === '.' || s === '-' || s === '-.') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function run() {
  try {
    console.log('Starting price normalization for products collection...');
    const snapshot = await db.collection('products').get();
    console.log(`Found ${snapshot.size} products`);

    let batch = db.batch();
    let ops = 0;
    const BATCH_LIMIT = 500;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const fixed = parsePrice(data.price);
      // Only update if different (including types)
      const old = data.price === undefined ? null : data.price;
      const needUpdate = (fixed === null && old !== null) || (fixed !== null && old !== fixed);
      if (needUpdate) {
        batch.update(db.collection('products').doc(doc.id), { price: fixed, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        ops++;
      }

      if (ops >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`Committed ${ops} updates...`);
        batch = db.batch();
        ops = 0;
      }
    }

    if (ops > 0) {
      await batch.commit();
      console.log(`Committed final ${ops} updates.`);
    }

    console.log('Price normalization complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

run();
