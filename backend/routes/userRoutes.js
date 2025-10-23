const express = require('express')
const router = express.Router()
const auth = require('../config/authMiddleware')
const firebaseCtrl = require('../controllers/userController')

// Admin: get all users (Firestore)
router.get('/', firebaseCtrl.getAllUsers)
router.get('/missing-authid', firebaseCtrl.getUsersMissingAuthId)
router.get('/:id', firebaseCtrl.getUserById)
router.post('/', firebaseCtrl.createUser)
router.put('/:id', firebaseCtrl.updateUser)
router.delete('/:id', firebaseCtrl.deleteUser)
// Deactivate currently authenticated user
router.post('/deactivate', auth, firebaseCtrl.deactivateSelf)

module.exports = router
