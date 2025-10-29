const express = require('express');
const router = express.Router();
const auth = require('../config/authMiddleware');
const ctrl = require('../controllers/reportController');

// Create a report (any authenticated user)
router.post('/', auth, ctrl.createReport);

// Admin: list, update status, delete
router.get('/', auth, ctrl.listReports);
router.put('/:id', auth, ctrl.updateReport);
router.delete('/:id', auth, ctrl.deleteReport);

module.exports = router;
