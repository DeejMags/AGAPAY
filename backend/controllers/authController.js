const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

exports.signup = async (req,res)=>{
  try{
    const { username, email, password } = req.body
    const existing = await User.findOne({ email })
    if(existing) return res.status(400).json({ message: 'Email exists' })
    const hash = await bcrypt.hash(password, 10)
    const user = await User.create({ username, email, password: hash })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' })
    res.json({ token, user: { id: user._id, username: user.username, email: user.email } })
  }catch(err){ res.status(500).json({ message: err.message }) }
}

exports.login = async (req,res)=>{
  try{
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if(!user) return res.status(400).json({ message: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, user.password)
    if(!ok) return res.status(400).json({ message: 'Invalid credentials' })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' })
    res.json({ token, user: { id: user._id, username: user.username, email: user.email } })
  }catch(err){ res.status(500).json({ message: err.message }) }
}

exports.logout = (req,res)=>{
  res.json({ message: 'Logged out (client should discard token)' })
}
