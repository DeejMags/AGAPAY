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
