const express = require('express');
const router = express.Router();
const auth = require('../config/authMiddleware');
const ctrl = require('../controllers/reportController');
const multer = require('multer');
const memoryUpload = multer({ storage: multer.memoryStorage() });

// Create a report (any authenticated user). Accept optional image file field 'image'.
router.post('/', auth, memoryUpload.single('image'), ctrl.createReport);

// Admin: list, update status, delete
router.get('/', auth, ctrl.listReports);
router.put('/:id', auth, ctrl.updateReport);
router.delete('/:id', auth, ctrl.deleteReport);

module.exports = router;
