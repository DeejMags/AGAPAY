const express = require('express');
const router = express.Router();
const authMiddleware = require('../config/authMiddleware');
const { createOrUpdateReview, getSellerReviews } = require('../controllers/reviewController');

router.get('/seller/:sellerId', getSellerReviews);

router.post('/', authMiddleware, createOrUpdateReview);

module.exports = router;
