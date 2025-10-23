const express = require('express')
const cors = require('cors')

const { admin, db } = require('./config/firebaseAdmin'); // Initialize Firebase Admin (may be disabled)

const authRoutes = require('./routes/authRoutes')
const productRoutes = require('./routes/productRoutes')
const userRoutes = require('./routes/userRoutes')
const debugRoutes = require('./routes/debugRoutes')
let messageRoutes = null

const app = express()
app.use(cors())
// Increase body size limit to handle base64 image payloads
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use('/uploads', express.static('uploads'))

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/users', userRoutes)
app.use('/api/debug', debugRoutes)

// If Firebase is enabled we mount the real messageRoutes, otherwise provide a stub
if (db) {
	messageRoutes = require('./routes/messageRoutes')
	app.use('/api/messages', messageRoutes)
} else {
	// minimal stub to avoid 500s while Firebase is disabled
	const stub = express.Router();
	stub.get('/', (req, res) => res.status(501).json({ message: 'Messages disabled on this server (DISABLE_FIREBASE=true).' }));
	stub.get('/:conversationId', (req, res) => res.status(501).json({ message: 'Messages disabled on this server (DISABLE_FIREBASE=true).' }));
	stub.post('/', (req, res) => res.status(501).json({ message: 'Messages disabled on this server (DISABLE_FIREBASE=true).' }));
	app.use('/api/messages', stub)
}


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Server running on', PORT));
