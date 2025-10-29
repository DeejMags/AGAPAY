const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');

router.get('/', async (req, res) => {
  try {
    const usersSnap = await db.collection('users').get();
    const productsSnap = await db.collection('products').get();
    res.json({ users: usersSnap.size, products: productsSnap.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Extra: simple connectivity check for reports collection
router.get('/reports', async (req, res) => {
  try {
    const snap = await db.collection('reports').limit(1).get();
    const countSnap = await db.collection('reports').get();
    const sample = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    res.json({ ok: true, count: countSnap.size, sample });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
