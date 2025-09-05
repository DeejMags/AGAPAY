const express = require('express')
const router = express.Router()
const multer = require('multer')
const upload = multer({ dest: 'uploads/' })
const auth = require('../config/authMiddleware')
const ctrl = require('../controllers/productController')

router.get('/', ctrl.getProducts)
router.post('/', auth, upload.single('photo'), ctrl.createProduct)
router.get('/:id', ctrl.getProduct)
router.put('/:id', auth, upload.single('photo'), ctrl.updateProduct)
router.delete('/:id', auth, ctrl.deleteProduct)

module.exports = router
