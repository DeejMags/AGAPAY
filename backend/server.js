const express = require('express')
const cors = require('cors')
const { connectDB } = require('./config/db')

const authRoutes = require('./routes/authRoutes')
const productRoutes = require('./routes/productRoutes')
const messageRoutes = require('./routes/messageRoutes')
const userRoutes = require('./routes/userRoutes')

const app = express()
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static('uploads'))

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/users', userRoutes)

const PORT = process.env.PORT || 5000

connectDB().then(()=>{
  app.listen(PORT, ()=>console.log('Server running on', PORT))
}).catch(err=>{ console.error('DB connection failed', err) })
