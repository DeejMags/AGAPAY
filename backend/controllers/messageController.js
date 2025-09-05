const Message = require('../models/Message')

exports.getConversation = async (req,res)=>{
  try{
    const convId = req.params.conversationId
    const msgs = await Message.find({ conversationId: convId }).sort('createdAt')
    res.json(msgs)
  }catch(err){ res.status(500).json({ message: err.message }) }
}

exports.sendMessage = async (req,res)=>{
  try{
    const { senderId, receiverId, text } = req.body
    const conversationId = req.body.conversationId || [senderId, receiverId].sort().join('_')
    const m = await Message.create({ senderId, receiverId, text, conversationId })
    res.status(201).json(m)
  }catch(err){ res.status(500).json({ message: err.message }) }
}
