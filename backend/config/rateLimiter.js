const rateLimit = require('express-rate-limit');

// Login rate limiter - 5 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req, res) => {
    // Skip rate limiting for non-POST requests
    return req.method !== 'POST';
  }
});

// Product creation rate limiter - 10 per hour
const createProductLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 products per hour
  message: 'You have reached the maximum number of product uploads per hour. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?.uid || req.ip;
  }
});

// Product image upload rate limiter - 10 per hour
const uploadImageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: 'You have reached the maximum number of image uploads per hour. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    return req.user?.uid || req.ip;
  }
});

// Message sending rate limiter - 30 per hour
const messageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 messages per hour
  message: 'You have reached the maximum number of messages per hour. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    return req.user?.uid || req.ip;
  }
});

module.exports = {
  loginLimiter,
  createProductLimiter,
  uploadImageLimiter,
  messageLimiter
};
