import React, { useEffect, useState, useRef } from 'react'
import MessageBubble from '../components/MessageBubble'

function makeChatId(a,b){
  return [a,b].sort().join('_')
}

export default function Messages(){
  const [conversations, setConversations] = useState([]) // list of { chatId, title, otherId, otherName, otherAvatar, lastMessage }
  const [selectedChat, setSelectedChat] = useState(null) // chatId
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const listRef = useRef()

  useEffect(()=>{
    // build conversation list from products and from conv_meta_* keys for backward compat
    const me = JSON.parse(localStorage.getItem('user') || 'null')
    const products = JSON.parse(localStorage.getItem('agapay_products') || '[]')
    const convs = []

    // from products (legacy behavior) - conversation per product between current user and seller
    products.forEach(p=>{
      const otherId = p.sellerId || 'seller_' + (p._id||'')
      const chatId = makeChatId(me ? me.id : 'anon', otherId) + `::${p._id}`
      const convKey = `conv_${chatId}`
      const msgs = JSON.parse(localStorage.getItem(convKey) || '[]')
      const meta = JSON.parse(localStorage.getItem(`conv_meta_${chatId}`) || 'null')
      convs.push({ chatId, title: p.title, otherId, otherName: otherId, otherAvatar: null, lastMessage: msgs.length ? msgs[msgs.length-1] : null, unread: meta && meta.unreadFor && me ? meta.unreadFor.includes(me.id) : false })
    })

    // also discover any conv_meta_ keys to surface direct chats
    Object.keys(localStorage).forEach(k=>{
      if(!k.startsWith('conv_meta_')) return
      const chatId = k.replace('conv_meta_','')
      // avoid duplicates
      if(convs.find(c=>c.chatId===chatId)) return
      const convKey = `conv_${chatId}`
      const msgs = JSON.parse(localStorage.getItem(convKey) || '[]')
      const meta = JSON.parse(localStorage.getItem(k) || 'null')
      // parse other id from chatId (chatId was created as sorted ids joined by '_')
      const parts = chatId.split('::')
      const base = parts[0]
      const ids = base.split('_')
      const meId = (me && me.id) || 'anon'
      const otherId = ids.find(x=> x !== meId) || ids[0]
      convs.push({ chatId, title: `Chat with ${otherId}`, otherId, otherName: otherId, otherAvatar: null, lastMessage: msgs.length ? msgs[msgs.length-1] : null, unread: meta && meta.unreadFor && me ? meta.unreadFor.includes(me.id) : false })
    })

    // sort by lastMessage timestamp desc
    convs.sort((a,b)=>{ const ta = a.lastMessage ? a.lastMessage.id : 0; const tb = b.lastMessage ? b.lastMessage.id : 0; return tb - ta })
    setConversations(convs)

    // select first if none
    const active = localStorage.getItem('agapay_active_conv')
    if(active){ setSelectedChat(active); localStorage.removeItem('agapay_active_conv') }
  },[])

  useEffect(()=>{
    if(!selectedChat){ setMessages([]); return }
    const convKey = `conv_${selectedChat}`
    const stored = JSON.parse(localStorage.getItem(convKey) || '[]')
    setMessages(stored)
    // mark as read
    const metaKey = `conv_meta_${selectedChat}`
    const meta = JSON.parse(localStorage.getItem(metaKey) || 'null') || { unreadFor: [] }
    const me = JSON.parse(localStorage.getItem('user') || 'null')
    if(meta && me){
      meta.unreadFor = (meta.unreadFor || []).filter(id => id !== me.id)
      localStorage.setItem(metaKey, JSON.stringify(meta))
      // refresh conversation list unread flags
      setConversations(prev => prev.map(c => c.chatId === selectedChat ? { ...c, unread: false } : c))
    }
    // scroll to bottom
    setTimeout(()=>{ if(listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, 50)
  },[selectedChat])

  async function send(){
    if(!selectedChat) return
    const me = JSON.parse(localStorage.getItem('user') || 'null')
    const convKey = `conv_${selectedChat}`
    const image = imageFile ? await fileToBase64(imageFile) : null
    const m = { id: Date.now(), text: text || '', me: me ? me.id : 'me', avatar: me ? me.profilePic : null, image }
    const cur = JSON.parse(localStorage.getItem(convKey) || '[]')
    const next = [...cur, m]
    localStorage.setItem(convKey, JSON.stringify(next))
    setMessages(next)
    setText('')
    setImageFile(null)

    // mark unread for other user
    const metaKey = `conv_meta_${selectedChat}`
    const meta = JSON.parse(localStorage.getItem(metaKey) || 'null') || { unreadFor: [] }
    // determine other user's id from chatId
    const base = selectedChat.split('::')[0]
    const ids = base.split('_')
    const meId = me ? me.id : 'me'
    const otherId = ids.find(x=> x !== meId) || ids[0]
    if(!meta.unreadFor) meta.unreadFor = []
    if(!meta.unreadFor.includes(otherId)) meta.unreadFor.push(otherId)
    localStorage.setItem(metaKey, JSON.stringify(meta))

    // update conversation preview
    setConversations(prev => prev.map(c => c.chatId === selectedChat ? { ...c, lastMessage: m, unread: false } : c))
  }

  function fileToBase64(file){
    return new Promise((res, rej)=>{
      const r = new FileReader()
      r.onload = ()=>res(r.result)
      r.onerror = rej
      r.readAsDataURL(file)
    })
  }

  return (
    <div className="py-8 container mx-auto px-4">
      <h1 className="text-2xl font-bold">Messages</h1>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1">
          <h3 className="font-semibold">Conversations</h3>
          <div className="mt-2 space-y-2">
            {conversations.map(c=> (
              <button key={c.chatId} onClick={()=>setSelectedChat(c.chatId)} className={`w-full text-left p-2 border rounded flex items-center gap-2 ${selectedChat===c.chatId ? 'bg-blue-50' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  {c.otherAvatar ? <img src={c.otherAvatar} alt={c.otherName} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-gray-500">{c.otherName}</div>
                </div>
                {c.unread && <div className="inline-flex items-center justify-center w-5 h-5 text-xs bg-red-600 text-white rounded-full">!</div>}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-3">
          {selectedChat ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                    {/* avatar placeholder - could resolve other user's avatar */}
                  </div>
                  <div className="font-semibold">{conversations.find(x=>x.chatId===selectedChat)?.otherName || 'Chat'}</div>
                </div>
                <div className="text-xs text-gray-500">Messages</div>
              </div>

              <div ref={listRef} className="p-3 border rounded h-80 overflow-auto flex flex-col gap-3">
                {messages.map(m=> <MessageBubble key={m.id} text={m.text} me={m.me === (JSON.parse(localStorage.getItem('user')||'null')?.id)} avatar={m.avatar} image={m.image} />)}
              </div>

              <div className="flex gap-2 mt-2 items-center">
                <input id="chat-image-input" type="file" accept="image/*" className="hidden" onChange={e=> setImageFile(e.target.files && e.target.files[0])} />
                <label htmlFor="chat-image-input" className="cursor-pointer p-2 rounded hover:bg-gray-100">
                  <svg className="w-6 h-6 text-teal-500" xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="currentColor"><path d="M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h600q24 0 42 18t18 42v600q0 24-18 42t-42 18H180Zm0-60h600v-600H180v600Zm56-97h489L578-473 446-302l-93-127-117 152Zm-56 97v-600 600Z"/></svg>
                </label>
                <input className="flex-1 p-2 border rounded" value={text} onChange={e=>setText(e.target.value)} placeholder="Write a message" />
                <button onClick={send} className="px-4 bg-blue-600 text-white rounded">Send</button>
              </div>
            </div>
          ) : (
            <div className="p-6 border rounded">Select a conversation to start chatting.</div>
          )}
        </div>
      </div>
    </div>
  )
}
