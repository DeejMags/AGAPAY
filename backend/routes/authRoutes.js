// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();

// Import the correct controller (no ".firebase" extension anymore)
const { register, login, checkEmail } = require('../controllers/authController');
const { loginLimiter } = require('../config/rateLimiter');

router.post('/signup', loginLimiter, register);
router.post('/check-email', checkEmail);
router.post('/login', loginLimiter, login);
router.post('/google', loginLimiter, require('../controllers/authController').google);

module.exports = router;
