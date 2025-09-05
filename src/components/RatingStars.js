import React from 'react'

export default function RatingStars({ value = 0 }){
  const stars = Array.from({ length: 5 }).map((_, i) => i < value ? '★' : '☆')
  return <div className="text-yellow-500">{stars.join(' ')}</div>
}
