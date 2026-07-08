const express = require('express')
const router = express.Router()
const auth = require('../config/authMiddleware')
const firebaseCtrl = require('../controllers/userController')

// Admin: get all users (Firestore)
router.get('/', firebaseCtrl.getAllUsers)
router.get('/missing-authid', firebaseCtrl.getUsersMissingAuthId)
router.get('/:id/badges/feed', auth, firebaseCtrl.getBadgeFeed)
router.get('/:id', firebaseCtrl.getUserById)
router.post('/', firebaseCtrl.createUser)
router.post('/:id/badges/equip', auth, firebaseCtrl.setEquippedBadge)
router.post('/:id/points_history', auth, firebaseCtrl.getPointsHistory)
router.put('/:id', firebaseCtrl.updateUser)
router.delete('/:id', firebaseCtrl.deleteUser)
// Admin: ban a user by id/email/uid
router.post('/:id/ban', auth, firebaseCtrl.banUser)
router.post('/:id/unban', auth, firebaseCtrl.unbanUser)
router.post('/:id/archive', auth, firebaseCtrl.archiveUser)
router.post('/:id/unarchive', auth, firebaseCtrl.unarchiveUser)
// Admin: batch set locations (testing/setup helper)
router.post('/admin/batch-set-locations', auth, firebaseCtrl.batchSetLocations)
// Deactivate currently authenticated user
router.post('/deactivate', auth, firebaseCtrl.deactivateSelf)

module.exports = router
