import React, { useState } from 'react'

function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsDataURL(file)
  })
}

export default function UploadProduct(){
  const [title,setTitle]=useState('')
  const [description,setDescription]=useState('')
  const [price,setPrice]=useState('')
  const [category,setCategory]=useState('')
  const [photos,setPhotos]=useState([]) // store base64 strings
  const [location,setLocation]=useState('')

  const [previews, setPreviews] = React.useState([])
  const [saving, setSaving] = useState(false)

  const submit = async e => {
    e.preventDefault()
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if(!user) return alert('Login required')

    setSaving(true)
    // create product object and store locally
    const products = JSON.parse(localStorage.getItem('agapay_products') || '[]')
    const id = `p_${Date.now()}`
    const prod = { _id:id, title, desc: description, price, category, photo: photos, sellerId: user.id, location: location || user.location || '' }
    products.unshift(prod)
    localStorage.setItem('agapay_products', JSON.stringify(products))
    setSaving(false)
    alert('Product uploaded locally. Go to Marketplace to see it.')
    window.location.href = '/marketplace'
  }

  async function onFiles(e){
    const files = Array.from(e.target.files || [])
    if(files.length === 0) return
    try{
      const bases = await Promise.all(files.map(f => fileToBase64(f)))
      setPhotos(bases)
      setPreviews(bases)
    }catch(err){
      console.error(err)
      alert('Failed to read files')
    }
  }

  return (
    <div className="py-8 container mx-auto px-4 max-w-lg">
      <h1 className="text-2xl font-bold">Upload Product</h1>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="p-2 border rounded" required />
        <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description" className="p-2 border rounded" />
        <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Price" className="p-2 border rounded" required />
        <select value={category} onChange={e=>setCategory(e.target.value)} className="p-2 border rounded">
          <option value="">Select category</option>
          <option value="electronics">Electronics</option>
          <option value="furniture">Furniture</option>
          
          <option value="shirt">Shirt</option>
          <option value="sports">Sports</option>
        </select>
        <label className="text-sm">Location</label>
        <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Makati, Manila" className="p-2 border rounded" />

        <label className="text-sm">Photos (you can select multiple)</label>
        <input type="file" accept="image/*" multiple onChange={onFiles} />
        {previews.length > 0 && (
          <div className="flex gap-2 mt-2">
            {previews.map((p,i)=> <img key={i} src={p} alt={`preview-${i}`} className="w-28 h-20 object-cover rounded" />)}
          </div>
        )}
        <button disabled={saving} className="p-2 bg-teal-600 text-white rounded">{saving ? 'Saving...' : 'Upload'}</button>
      </form>
    </div>
  )
}
