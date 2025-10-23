import React, { useEffect, useState } from 'react';
import authFetch from '../utils/authFetch';
import FullScreenLoader from '../components/FullScreenLoader';

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
      const newId = Date.now();
      // Convert uploaded images to object URLs for display
      let photo = [];
      if (form.images && form.images.length > 0) {
        photo = form.images.map(file => {
          if (typeof file === 'string') return file;
          return URL.createObjectURL(file);
        });
      }
      // Get seller info from localStorage
      const seller = JSON.parse(localStorage.getItem('user') || '{}');
      const newProduct = {
        ...form,
        id: newId,
        _id: newId,
        status: 'pending', // Mark as pending for admin approval
        photo,
        owner: seller.email || seller.username || 'Unknown',
        sellerId: seller.id || null
      };
      onAdd(newProduct);
      // Sanitize product payload to remove File objects before sending.
      const sanitized = { ...newProduct };
      if (sanitized.images) {
        sanitized.images = sanitized.images.map(img => (typeof img === 'string' ? img : undefined)).filter(Boolean);
      }

      try {
        const res = await authFetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sanitized) });
        if (!res.ok) throw new Error('Backend create failed');
      } catch (err) {
        try {
          const { collection, addDoc } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          await addDoc(collection(db, 'products'), sanitized);
        } catch (e) {
          console.warn('Failed to persist new product to backend and Firestore', e);
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
