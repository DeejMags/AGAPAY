import React, { useEffect, useState } from 'react';
import authFetch from '../utils/authFetch';
import FullScreenLoader from '../components/FullScreenLoader';
import { postProduct as postProductViaService } from '../firebaseProductService';

export default function ListNewItemModal({ open, onClose, onAdd, editItem = null, onUpdate }) {
  const [form, setForm] = useState({ title: '', description: '', category: '', price: '', images: [] });
  const categories = [
    'Clothing',
    'Electronics',
    'Books',
    'Home & Living',
    'Toys',
    'Sports',
    'Beauty',
    'Automotive',
    'Other'
  ];
  const [imgPreview, setImgPreview] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Prefill form when editing
  useEffect(() => {
    if (open && editItem) {
      setForm({
        title: editItem.title || '',
        description: editItem.description || '',
        category: editItem.category || '',
        price: editItem.price ?? '',
        images: [],
      });
      // If existing image is available, show as preview
      const previews = [];
      if (Array.isArray(editItem.photo)) previews.push(...editItem.photo);
      else if (editItem.imageUrl) previews.push(editItem.imageUrl);
      setImgPreview(previews);
    }
    if (open && !editItem) {
      setForm({ title: '', description: '', category: '', price: '', images: [] });
      setImgPreview([]);
    }
  }, [open, editItem]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleImage(e) {
    const files = Array.from(e.target.files);
    setForm(f => ({ ...f, images: files }));
    setImgPreview(files.map(file => URL.createObjectURL(file)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.category || !form.price) return;
    setIsSaving(true);
    if (editItem && (editItem.id || editItem._id)) {
      const id = editItem.id || editItem._id;
      // Prepare payload for update
      const payload = { ...form };
      // remove File objects for JSON body
      if (payload.images) delete payload.images;
      // If user selected a new image during edit, upload to Cloudinary first
      try {
        if (form.images && form.images.length > 0 && form.images[0] instanceof File) {
          const fd = new FormData();
          fd.append('image', form.images[0]);
          const up = await authFetch('/api/products/upload-image-cloudinary', { method: 'POST', body: fd });
          if (up.ok) {
            const j = await up.json();
            if (j && j.url) {
              payload.imageUrl = j.url;
              payload.photo = j.url;
            }
          }
        }
      } catch (err) {
        console.warn('Cloudinary upload failed on edit, continuing without image change', err);
      }
      try {
        const res = await authFetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('Backend update failed');
        const updated = await res.json();
        onUpdate && onUpdate(updated);
      } catch (err) {
        try {
          const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          await updateDoc(doc(db, 'products', id), { ...payload, updatedAt: serverTimestamp() });
          onUpdate && onUpdate({ ...editItem, ...payload, id, updatedAt: new Date().toISOString() });
        } catch (e) {
          console.warn('Failed to update product via backend and Firestore', e);
        }
      }
    } else {
      // Create new product: upload first image to Cloudinary, then persist
      const seller = JSON.parse(localStorage.getItem('user') || '{}');
      let imageUrl = null;
      let firstFile = form.images && form.images.length > 0 ? form.images[0] : null;
      // Try Cloudinary upload via backend
      if (firstFile instanceof File) {
        try {
          const fd = new FormData();
          fd.append('image', firstFile);
          const up = await authFetch('/api/products/upload-image-cloudinary', { method: 'POST', body: fd });
          if (up.ok) {
            const j = await up.json();
            imageUrl = j && j.url ? j.url : null;
          }
        } catch (e) {
          console.warn('Cloudinary upload failed for create, will fallback if needed', e);
        }
      }

      const newId = Date.now();
      const newProduct = {
        title: form.title,
        description: form.description,
        category: form.category,
        price: form.price,
        status: 'pending',
        photo: imageUrl ? [imageUrl] : [],
        imageUrl: imageUrl || null,
        owner: seller.email || seller.username || 'Unknown',
        sellerId: seller.id || null,
      };
      onAdd(newProduct);

      // Persist to backend (JSON; backend will use provided imageUrl)
      try {
        const res = await authFetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProduct) });
        if (!res.ok) throw new Error('Backend create failed');
      } catch (err) {
        // Fallback: use client service to upload (includes Storage fallback) and create Firestore doc
        try {
          await postProductViaService({
            title: form.title,
            description: form.description,
            category: form.category,
            price: form.price,
            status: 'pending',
            sellerId: seller.id || undefined,
            sellerName: seller.name || seller.username || undefined,
          }, firstFile instanceof File ? firstFile : undefined);
        } catch (e) {
          console.warn('Failed to persist new product via both backend and service', e);
        }
      }
    }
    setIsSaving(false);
    setForm({ title: '', description: '', category: '', price: '', images: [] });
    setImgPreview([]);
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      {isSaving && <FullScreenLoader />}
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
  <h2 className="text-xl teal-700 font-bold mb-4">{editItem ? 'Edit Item' : 'List New Item'}</h2>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input name="title" value={form.title} onChange={handleChange} placeholder="Title" className="border rounded p-2" required disabled={isSaving} />
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="border rounded p-2" />
          <select name="category" value={form.category} onChange={handleChange} className="border rounded p-2" required>
            <option value="" disabled>Select Category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input name="price" type="number" value={form.price} onChange={handleChange} placeholder="Price" className="border rounded p-2" required disabled={isSaving} />
          <input name="images" type="file" multiple accept="image/*" onChange={handleImage} className="border rounded p-2" disabled={isSaving} />
          {imgPreview.length > 0 && (
            <div className="flex gap-2 mt-2">{imgPreview.map((src, i) => <img key={i} src={src} alt="preview" className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded" />)}</div>
          )}
          <div className="flex gap-2 mt-4">
            <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded" disabled={isSaving}>{editItem ? 'Save Changes' : 'Add Item'}</button>
            <button type="button" className="bg-gray-200 px-4 py-2 rounded" onClick={onClose} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
