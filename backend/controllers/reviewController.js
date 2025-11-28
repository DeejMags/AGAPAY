const { admin, db } = require('../config/firebaseAdmin');

exports.createOrUpdateReview = async (req, res) => {
  try {
    const buyerId = (req.user && (req.user.uid || req.user.id)) || null;
    if (!buyerId) return res.status(401).json({ error: 'unauthorized' });

  const { sellerId, rating, comment } = req.body || {};
    if (!sellerId) return res.status(400).json({ error: 'sellerId_required' });
    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) return res.status(400).json({ error: 'invalid_rating' });
    if (String(sellerId) === String(buyerId)) return res.status(400).json({ error: 'cannot_review_self' });

    // Verify buyer purchased from seller (products or points_history)
    let hasPurchase = false;
    try {
      const productsSnap = await db.collection('products')
        .where('buyerId', '==', buyerId)
        .where('sellerId', '==', sellerId)
        .limit(1)
        .get();
      hasPurchase = !productsSnap.empty;
    } catch (e) { /* ignore */ }
    if (!hasPurchase) {
      try {
        const phSnap = await db.collection('points_history')
          .where('buyerId', '==', buyerId)
          .where('sellerId', '==', sellerId)
          .limit(1)
          .get();
        hasPurchase = !phSnap.empty;
      } catch (e) { /* ignore */ }
    }
    if (!hasPurchase) return res.status(403).json({ error: 'purchase_required' });

    const docId = `${sellerId}_${buyerId}`;
    const reviewsCol = db.collection('seller_reviews');
    const reviewRef = reviewsCol.doc(docId);
    const sellerRef = db.collection('users').doc(String(sellerId));

    let buyerName = null;
    try {
      const buyerDoc = await db.collection('users').doc(String(buyerId)).get();
      if (buyerDoc.exists) {
        const b = buyerDoc.data() || {};
        const combined = [b.firstName, b.lastName].filter(Boolean).join(' ').trim();
        buyerName = combined || b.username || b.name || b.displayName || b.fullName || (b.email ? String(b.email).split('@')[0] : null);
      }
    } catch (e) { /* ignore */ }
    if (!buyerName && req.user) {
      const u = req.user;
      const combined = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      buyerName = combined || u.username || u.name || u.displayName || u.fullName || (u.email ? String(u.email).split('@')[0] : null);
    }
    if (!buyerName) buyerName = String(buyerId); // last resort

    const result = await db.runTransaction(async (tx) => {
      const existingSnap = await tx.get(reviewRef);
      const sellerSnap = await tx.get(sellerRef);
      let ratingSum = 0, ratingCount = 0;
      if (sellerSnap.exists) {
        const d = sellerSnap.data();
        ratingSum = Number(d.ratingSum) || 0;
        ratingCount = Number(d.ratingCount) || 0;
      }
      let createdAt = admin.firestore.FieldValue.serverTimestamp();
      let existingRating = 0;
      if (existingSnap.exists) {
        const ex = existingSnap.data();
        existingRating = Number(ex.rating) || 0;
        createdAt = ex.createdAt || createdAt; // preserve original createdAt
      }
      // Adjust aggregates
      if (existingRating) {
        ratingSum = ratingSum - existingRating + numericRating;
      } else {
        ratingSum += numericRating;
        ratingCount += 1;
      }
      const ratingAverage = ratingCount ? (ratingSum / ratingCount) : 0;

      const payload = {
        id: docId,
        sellerId,
        buyerId,
        rating: numericRating,
        comment: comment ? String(comment).slice(0, 2000) : '',
        buyerName,
        createdAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      tx.set(reviewRef, payload, { merge: false });
      tx.set(sellerRef, { ratingSum, ratingCount, ratingAverage }, { merge: true });
      return { ...payload, ratingAverage, ratingCount };
    });

    res.json(result);
  } catch (err) {
    console.error('createOrUpdateReview error', err);
    res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// GET /api/reviews/seller/:sellerId
// Returns list of reviews and summary { average, count }
exports.getSellerReviews = async (req, res) => {
  try {
    const sellerId = req.params.sellerId;
    if (!sellerId) return res.status(400).json({ error: 'sellerId_required' });

    const snap = await db.collection('seller_reviews').where('sellerId', '==', sellerId).limit(300).get();
    let reviews = snap.docs.map(d => {
      const data = d.data() || {};
      const createdAt = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || null);
      const updatedAt = data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || null);
      return { id: d.id, ...data, createdAt, updatedAt };
    });

    // Enrich missing buyerName fields
    const missingBuyerIds = Array.from(new Set(reviews.filter(r => !r.buyerName).map(r => r.buyerId))).slice(0, 50); // cap enrichment
    if (missingBuyerIds.length) {
      const nameCache = {};
      await Promise.all(missingBuyerIds.map(async (bid) => {
        try {
          const doc = await db.collection('users').doc(String(bid)).get();
          if (doc.exists) {
            const u = doc.data() || {};
            const combined = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
            nameCache[bid] = combined || u.username || u.name || u.displayName || u.fullName || (u.email ? String(u.email).split('@')[0] : String(bid));
          } else {
            nameCache[bid] = String(bid);
          }
        } catch (e) {
          nameCache[bid] = String(bid);
        }
      }));
      reviews = reviews.map(r => r.buyerName ? r : { ...r, buyerName: nameCache[r.buyerId] || r.buyerId });
    }

    // Aggregate: prefer stored ratingAverage on seller profile, fallback to compute
    let ratingAverage = 0, ratingCount = 0;
    try {
      const sellerDoc = await db.collection('users').doc(String(sellerId)).get();
      if (sellerDoc.exists) {
        const d = sellerDoc.data();
        ratingAverage = Number(d.ratingAverage) || 0;
        ratingCount = Number(d.ratingCount) || 0;
        // If missing but we have reviews, compute
        if ((!ratingCount || !ratingAverage) && reviews.length > 0) {
          ratingCount = reviews.length;
          ratingAverage = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / ratingCount;
        }
      } else if (reviews.length > 0) {
        ratingCount = reviews.length;
        ratingAverage = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / ratingCount;
      }
    } catch (e) {
      if (reviews.length > 0) {
        ratingCount = reviews.length;
        ratingAverage = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / ratingCount;
      }
    }

    res.json({ sellerId, reviews, summary: { average: ratingAverage, count: ratingCount } });
  } catch (err) {
    console.error('getSellerReviews error', err);
    res.status(500).json({ error: 'server_error', details: err.message });
  }
};
