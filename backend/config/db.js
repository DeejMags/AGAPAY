const mongoose = require('mongoose')

async function connectDB(){
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/agapay'
  await mongoose.connect(uri)
  console.log('MongoDB connected')
}

module.exports = { connectDB }
