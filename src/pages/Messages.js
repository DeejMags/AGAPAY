import React, { useEffect, useState, useRef } from 'react'
import FullScreenLoader from '../components/FullScreenLoader'
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
  const [loading, setLoading] = useState(true)
  const listRef = useRef()

  useEffect(()=>{
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
  setTimeout(()=>setLoading(false), 700)
  },[])

  useEffect(()=>{
  if(!selectedChat){ setMessages([]); return }
  setLoading(true)
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
  setTimeout(()=>{ if(listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; setLoading(false); }, 300)
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
      {loading && <FullScreenLoader />}
      <h1 className="text-2xl font-bold mb-6">Messages</h1>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar restored */}
        {(conversations.length > 0) && (
          <div className="md:col-span-1">
            <div className="sticky top-24 z-10">
              <div className="bg-gradient-to-r from-blue-100 to-blue-50 rounded-t-xl px-4 py-4 flex items-center gap-2 shadow-sm">
                <div className="relative">
                  {conversations.some(c => c.unread) && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                  )}
                  <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8l-4 1 1-3.2A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <h3 className="font-semibold text-lg text-blue-700">Conversations</h3>
              </div>
            </div>
            <div className="space-y-2 max-h-[28rem] overflow-auto pr-1 bg-white rounded-b-xl shadow border border-blue-100">
              {conversations.map(c=> (
                <button key={c.chatId} onClick={()=>setSelectedChat(c.chatId)} className={`w-full text-left p-3 border-b last:border-b-0 flex items-center gap-3 transition duration-150 rounded-none ${selectedChat===c.chatId ? 'bg-blue-50 border-blue-400' : 'hover:bg-blue-100'}`} style={{borderRadius: selectedChat===c.chatId ? '12px' : '0'}}>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 overflow-hidden flex items-center justify-center shadow">
                      {c.otherAvatar ? <img src={c.otherAvatar} alt={c.otherName} className="w-full h-full object-cover" /> : <span className="text-blue-500 text-xl">👤</span>}
                    </div>
                    {c.unread && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold truncate ${selectedChat===c.chatId ? 'text-blue-700' : 'text-gray-800'}`}>{c.title}</div>
                    <div className="text-xs text-gray-500 truncate">{c.otherName}</div>
                  </div>
                  {c.unread && <div className="inline-flex items-center justify-center w-5 h-5 text-xs bg-red-500 text-white rounded-full shadow">!</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="md:col-span-3">
          {selectedChat ? (
            <div className="flex flex-col gap-4 bg-white rounded-xl shadow p-6 border min-h-[32rem]">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                    {/* avatar placeholder - could resolve other user's avatar */}
                  </div>
                  <div className="font-semibold text-lg">{conversations.find(x=>x.chatId===selectedChat)?.otherName || 'Chat'}</div>
                </div>
                <div className="text-xs text-gray-500">Messages</div>
              </div>

              <div ref={listRef} className="p-3 border rounded h-80 overflow-auto flex flex-col gap-3 bg-gray-50">
                {(() => {
                  let lastDate = null;
                  return messages.map((m, i) => {
                    const dateObj = new Date(m.id);
                    const dateStr = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                    const showDate = lastDate !== dateStr;
                    lastDate = dateStr;
                    return (
                      <React.Fragment key={m.id}>
                        {showDate && (
                          <div className="flex justify-center my-2">
                            <span className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full shadow">{dateStr}</span>
                          </div>
                        )}
                        <MessageBubble text={m.text} me={m.me === (JSON.parse(localStorage.getItem('user')||'null')?.id)} avatar={m.avatar} image={m.image} timestamp={m.id} />
                      </React.Fragment>
                    );
                  });
                })()}
              </div>

              <div className="flex gap-2 mt-2 items-center">
                <input id="chat-image-input" type="file" accept="image/*" className="hidden" onChange={e=> setImageFile(e.target.files && e.target.files[0])} />
                <label htmlFor="chat-image-input" className="cursor-pointer p-2 rounded hover:bg-gray-100">
                  <svg className="w-6 h-6 text-teal-500" xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="currentColor"><path d="M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h600q24 0 42 18t18 42v600q0 24-18 42t-42 18H180Zm0-60h600v-600H180v600Zm56-97h489L578-473 446-302l-93-127-117 152Zm-56 97v-600 600Z"/></svg>
                </label>
                <input
                  className="flex-1 p-2 border rounded"
                  value={text}
                  onChange={e=>setText(e.target.value)}
                  placeholder="Write a message"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button onClick={send} className="px-6 py-2 bg-teal-600 text-white rounded text-base font-medium">Send</button>
              </div>
              {/* Show image preview if selected */}
              {imageFile && (
                <div className="flex items-center gap-2 mt-2">
                  <img src={URL.createObjectURL(imageFile)} alt="preview" className="w-40 h-24 object-cover rounded-xl" />
                  <button className="text-red-600 text-xs" onClick={()=>setImageFile(null)}>Remove</button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 border rounded bg-white text-center text-gray-500">Select a conversation to start chatting.</div>
          )}
        </div>
      </div>
    </div>
  )
}
