const Product = require('../models/Product')

exports.getProducts = async (req,res)=>{
  try{
    const { category, location, minPrice, maxPrice } = req.query
    const filter = {}
    if(category) filter.category = category
    if(location) filter.location = location
    if(minPrice || maxPrice) filter.price = {}
    if(minPrice) filter.price.$gte = Number(minPrice)
    if(maxPrice) filter.price.$lte = Number(maxPrice)
    const products = await Product.find(filter).sort({ createdAt: -1 }).limit(200)
    res.json(products)
  }catch(err){ res.status(500).json({ message: err.message }) }
}

exports.createProduct = async (req,res)=>{
  try{
    const { title, description, price, category, location } = req.body
    const photo = req.file ? `/uploads/${req.file.filename}` : null
    const prod = await Product.create({ title, description, price, category, location, photo, sellerId: req.user._id })
    res.status(201).json(prod)
  }catch(err){ res.status(500).json({ message: err.message }) }
}

exports.getProduct = async (req,res)=>{
  try{
    const p = await Product.findById(req.params.id).populate('sellerId','username profilePic')
    if(!p) return res.status(404).json({ message: 'Not found' })
    res.json(p)
  }catch(err){ res.status(500).json({ message: err.message }) }
}

exports.updateProduct = async (req,res)=>{
  try{
    const p = await Product.findById(req.params.id)
    if(!p) return res.status(404).json({ message: 'Not found' })
    if(p.sellerId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not owner' })
    const updates = req.body
    if(req.file) updates.photo = `/uploads/${req.file.filename}`
    Object.assign(p, updates)
    await p.save()
    res.json(p)
  }catch(err){ res.status(500).json({ message: err.message }) }
}

exports.deleteProduct = async (req,res)=>{
  try{
    const p = await Product.findById(req.params.id)
    if(!p) return res.status(404).json({ message: 'Not found' })
    if(p.sellerId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not owner' })
    await p.remove()
    res.json({ message: 'Deleted' })
  }catch(err){ res.status(500).json({ message: err.message }) }
}
