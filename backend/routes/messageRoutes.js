const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/messageController')

router.get('/:conversationId', ctrl.getConversation)
router.post('/', ctrl.sendMessage)

module.exports = router
