import React from 'react'

export default function MessageBubble({ text, me, avatar, image }){
  return (
    <div className={`flex items-end gap-2 ${me ? 'justify-end' : 'justify-start'}`}>
      {!me && (
        avatar ? <img src={avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 bg-gray-200 rounded-full" />
      )}

      <div className={`p-2 rounded max-w-xs ${me ? 'self-end bg-blue-600 text-white' : 'self-start bg-gray-200 text-black'}`}>
        {image && <img src={image} alt="sent" className="mb-2 rounded max-w-xs" />}
        {text}
      </div>

      {me && (
        avatar ? <img src={avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 bg-gray-200 rounded-full" />
      )}
    </div>
  )
}
