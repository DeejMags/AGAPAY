const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const auth = require('../config/authMiddleware');
const firebaseCtrl = require('../controllers/productController');

router.get('/', firebaseCtrl.getAllProducts);
router.post('/', auth, upload.single('photo'), firebaseCtrl.createProduct);
router.get('/:id', firebaseCtrl.getProductById);
router.put('/:id', auth, upload.single('photo'), firebaseCtrl.updateProduct);
router.delete('/:id', auth, firebaseCtrl.deleteProduct);

module.exports = router;
