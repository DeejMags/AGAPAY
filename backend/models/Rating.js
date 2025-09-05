const mongoose = require('mongoose')

const RatingSchema = new mongoose.Schema({
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ratingValue: { type: Number, min:1, max:5 },
  comment: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.model('Rating', RatingSchema)
