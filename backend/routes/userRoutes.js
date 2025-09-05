const express = require('express')
const router = express.Router()
const auth = require('../config/authMiddleware')
const ctrl = require('../controllers/userController')

router.get('/:id', ctrl.getUser)
router.post('/ratings/:userId', auth, ctrl.postRating)
router.get('/ratings/:userId', ctrl.getRatings)

module.exports = router
