import React, { useState } from 'react'
import { postProduct } from '../firebaseProductService'
import { auth } from '../firebase'

export default function UploadProduct(){
  const [title,setTitle]=useState('')
  const [description,setDescription]=useState('')
  const [price,setPrice]=useState('')
  const [category,setCategory]=useState('')
  const [imageFile, setImageFile] = useState(null)
  const [location,setLocation]=useState('')
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const submit = async e => {
    e.preventDefault()
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    const errs = {};
    if (!user) errs.user = 'Login required';
    if (!title || !title.trim()) errs.title = 'Title is required';
    if (!imageFile) errs.image = 'Image is required';
    if (price !== '' && Number.isNaN(Number(price))) errs.price = 'Price must be a valid number';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true)
    try {
      // Prefer an authenticated Firebase user if present; otherwise fall back to local profile id
      const firebaseUser = auth.currentUser;
      const productData = {
        title,
        description,
        price: price === '' ? null : parseFloat(price),
        category,
        status: 'pending',
        sellerId: (firebaseUser && firebaseUser.uid) || (user && user.id) || '',
        sellerName: (user && (user.username || user.name)) || (firebaseUser && (firebaseUser.displayName || '')) || 'Unknown Seller'
      }

      await postProduct(productData, imageFile)
      alert('Product uploaded successfully! It will appear in marketplace after admin approval.')
      window.location.href = '/marketplace'
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload product: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  function onFileChange(e){
    const file = e.target.files[0]
    if(!file) return
    
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="py-8 container mx-auto px-4 max-w-lg">
      <h1 className="text-2xl font-bold">Upload Product</h1>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
  <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="p-2 border rounded" required />
  {errors.title && <div className="text-red-500 text-sm">{errors.title}</div>}
  <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description" className="p-2 border rounded" />
  <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Price" className="p-2 border rounded" required />
  {errors.price && <div className="text-red-500 text-sm">{errors.price}</div>}
        <select value={category} onChange={e=>setCategory(e.target.value)} className="p-2 border rounded">
          <option value="">Select category</option>
          <option value="electronics">Electronics</option>
          <option value="furniture">Furniture</option>
          
          <option value="shirt">Shirt</option>
          <option value="sports">Sports</option>
        </select>
  

        <label className="text-sm">Product Image</label>
  <input type="file" accept="image/*" onChange={onFileChange} required />
  {errors.image && <div className="text-red-500 text-sm">{errors.image}</div>}
        {preview && (
          <div className="mt-2">
            <img src={preview} alt="preview" className="w-32 h-32 object-cover rounded border" />
          </div>
        )}
        <button disabled={saving} className="p-2 bg-teal-600 text-white rounded">{saving ? 'Saving...' : 'Upload'}</button>
      </form>
    </div>
  )
}
