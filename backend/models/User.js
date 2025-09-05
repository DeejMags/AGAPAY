const mongoose = require('mongoose')

const RatingSub = new mongoose.Schema({ reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, ratingValue: Number, comment: String }, { timestamps: true })

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePic: String,
  ratings: [RatingSub]
}, { timestamps: true })

module.exports = mongoose.model('User', UserSchema)
