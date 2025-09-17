import React, { useState } from 'react';

export default function ListNewItemModal({ open, onClose, onAdd }) {
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

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleImage(e) {
    const files = Array.from(e.target.files);
    setForm(f => ({ ...f, images: files }));
    setImgPreview(files.map(file => URL.createObjectURL(file)));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.category || !form.price) return;
    onAdd({ ...form, id: Date.now(), status: 'active' });
    setForm({ title: '', description: '', category: '', price: '', images: [] });
    setImgPreview([]);
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl teal-700 font-bold mb-4">List New Item</h2>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input name="title" value={form.title} onChange={handleChange} placeholder="Title" className="border rounded p-2" required />
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="border rounded p-2" />
          <select name="category" value={form.category} onChange={handleChange} className="border rounded p-2" required>
            <option value="" disabled>Select Category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input name="price" type="number" value={form.price} onChange={handleChange} placeholder="Price" className="border rounded p-2" required />
          <input name="images" type="file" multiple accept="image/*" onChange={handleImage} className="border rounded p-2" />
          {imgPreview.length > 0 && (
            <div className="flex gap-2 mt-2">{imgPreview.map((src, i) => <img key={i} src={src} alt="preview" className="w-16 h-16 object-cover rounded" />)}</div>
          )}
          <div className="flex gap-2 mt-4">
            <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded">Add Item</button>
            <button type="button" className="bg-gray-200 px-4 py-2 rounded" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
