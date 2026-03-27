// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();

// Import the correct controller (no ".firebase" extension anymore)
const { register, login, checkEmail } = require('../controllers/authController');

router.post('/signup', register);
router.post('/check-email', checkEmail);
router.post('/login', login);
router.post('/google', require('../controllers/authController').google);

module.exports = router;
