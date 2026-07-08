const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const memoryUpload = multer({ storage: multer.memoryStorage() });
const auth = require('../config/authMiddleware');
const firebaseCtrl = require('../controllers/productController');
const { createProductLimiter, uploadImageLimiter } = require('../config/rateLimiter');

router.get('/seller/mine', auth, firebaseCtrl.getAllProducts);
router.get('/', firebaseCtrl.getAllProducts);
router.post('/', auth, createProductLimiter, upload.single('photo'), firebaseCtrl.createProduct);
router.post('/admin-notify-order', auth, firebaseCtrl.notifyOrder);

// Drop-off management routes MUST come before parameterized routes to avoid being caught by /:id
router.post('/dropoff/submit', auth, firebaseCtrl.submitDropoff);
router.get('/dropoff/list', auth, firebaseCtrl.getDropoffs);
router.get('/dropoff/mine', auth, firebaseCtrl.getMyDropoffs);
router.put('/dropoff/:dropoffId/approve', auth, firebaseCtrl.approveDropoff);
router.put('/dropoff/:dropoffId/decline', auth, firebaseCtrl.declineDropoff);
router.put('/dropoff/:dropoffId/complete', auth, firebaseCtrl.completeDropoff);

// Recyclables routes
router.get('/recyclables/categories', firebaseCtrl.getRecyclableCategories);
router.post('/recyclables/calculate-earnings', firebaseCtrl.calculateEarnings);

// Cloudinary image upload (before /:id to avoid conflict)
router.post('/upload-image-cloudinary', auth, uploadImageLimiter, memoryUpload.single('image'), firebaseCtrl.uploadImageCloudinary);

// Parameterized product routes (MUST be last)
router.get('/:id', firebaseCtrl.getProductById);
router.put('/:id', auth, upload.single('photo'), firebaseCtrl.updateProduct);
router.post('/:id/mark-sold', auth, firebaseCtrl.markSold);
router.delete('/:id', auth, firebaseCtrl.deleteProduct);

module.exports = router;
