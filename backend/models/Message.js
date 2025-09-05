const mongoose = require('mongoose')

const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: String,
  conversationId: String
}, { timestamps: true })

module.exports = mongoose.model('Message', MessageSchema)
