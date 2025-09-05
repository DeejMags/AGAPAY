const User = require('../models/User')
const Rating = require('../models/Rating')

exports.getUser = async (req,res)=>{
  const u = await User.findById(req.params.id).select('-password')
  if(!u) return res.status(404).json({ message: 'Not found' })
  res.json(u)
}

exports.postRating = async (req,res)=>{
  try{
    const { ratingValue, comment } = req.body
    const userId = req.params.userId
    const r = await Rating.create({ reviewerId: req.user._id, ratingValue, comment, userId })
    const user = await User.findById(userId)
    if(user){ user.ratings.push({ reviewerId: req.user._id, ratingValue, comment }); await user.save() }
    res.status(201).json(r)
  }catch(err){ res.status(500).json({ message: err.message }) }
}

exports.getRatings = async (req,res)=>{
  const ratings = await Rating.find({ userId: req.params.userId }).populate('reviewerId','username')
  res.json(ratings)
}
