const express = require('express');
const router = express.Router();
const auth = require('../config/authMiddleware');
const controller = require('../controllers/messageController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads/messages directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'messages');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
	destination: function (req, file, cb) { cb(null, uploadDir); },
	filename: function (req, file, cb) {
		const ext = path.extname(file.originalname) || '.jpg';
		const safe = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
		cb(null, safe);
	}
});
const fileFilter = (req, file, cb) => {
	if (/^image\//i.test(file.mimetype)) cb(null, true);
	else cb(new Error('Only image uploads are allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 8 * 1024 * 1024 } }); // 8MB

router.get('/conversations', auth, controller.listConversations);
router.get('/:id', auth, controller.getConversation);
router.post('/start', auth, controller.startConversation);
router.post('/send', auth, controller.sendMessage);
router.post('/:id/read', auth, controller.markRead);
// Multipart upload for message images
router.post('/upload', auth, upload.single('file'), controller.uploadMessageImage);
// Delete conversation
router.delete('/:id', auth, controller.deleteConversation);

module.exports = router;
