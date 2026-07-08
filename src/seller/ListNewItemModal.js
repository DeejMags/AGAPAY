import React, { useEffect, useState } from 'react';
import authFetch from '../utils/authFetch';
import FullScreenLoader from '../components/FullScreenLoader';
import { postProduct as postProductViaService } from '../firebaseProductService';

export default function ListNewItemModal({ open, onClose, onAdd, editItem = null, onUpdate }) {
  const [form, setForm] = useState({ title: '', description: '', category: '', price: '', location: '', locationLat: '', locationLng: '', images: [], delivery: false, pickup: false, dropoffJunkshop: false, dropoffDate: '', dropoffTime: '' });
  const categories = ['Metals', 'Plastics', 'Paper', 'Card Boards', 'Electronics'];
  const priceOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500];
  const [imgPreview, setImgPreview] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (open && editItem) {
      setForm({
        title: editItem.title || '',
        description: editItem.description || '',
        category: editItem.category || '',
        price: editItem.price ?? '',
        location: editItem.location || '',
        locationLat: (typeof editItem.locationLat === 'number' ? String(editItem.locationLat) : ''),
        locationLng: (typeof editItem.locationLng === 'number' ? String(editItem.locationLng) : ''),
        images: [],
        delivery: !!editItem.delivery,
        pickup: !!editItem.pickup,
        dropoffJunkshop: !!editItem.dropoffJunkshop,
        dropoffDate: editItem.dropoffDate || '',
        dropoffTime: editItem.dropoffTime || '',
      });
      const previews = [];
      if (Array.isArray(editItem.photo)) previews.push(...editItem.photo);
      else if (editItem.imageUrl) previews.push(editItem.imageUrl);
      setImgPreview(previews);
    }
    if (open && !editItem) {
      setForm({ title: '', description: '', category: '', price: '', location: '', locationLat: '', locationLng: '', images: [], delivery: false, pickup: false, dropoffJunkshop: false, dropoffDate: '', dropoffTime: '' });
      setImgPreview([]);
    }
  }, [open, editItem]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleCheckboxChange(e) {
    const { name, checked } = e.target;
    setForm(f => ({ ...f, [name]: checked }));
  }

  function handleImage(e) {
    const files = Array.from(e.target.files);
    setForm(f => ({ ...f, images: files }));
    setImgPreview(files.map(file => URL.createObjectURL(file)));
    setDragOver(false);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      setForm(f => ({ ...f, images: files }));
      setImgPreview(files.map(file => URL.createObjectURL(file)));
    }
    setDragOver(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.category || !form.price) {
      alert('Please fill in all required fields (Title, Category, Price)');
      return;
    }
    setIsSaving(true);
    if (editItem && (editItem.id || editItem._id)) {
      const id = editItem.id || editItem._id;
      const payload = { ...form };
      if (payload.images) delete payload.images;
      if (payload.dropoffJunkshop && !payload.dropoffDate) {
        alert('Please select a drop-off date for the junkshop');
        setIsSaving(false);
        return;
      }
      if (payload.dropoffJunkshop && !payload.dropoffTime) {
        alert('Please select a drop-off time for the junkshop');
        setIsSaving(false);
        return;
      }
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
        if (res.ok) {
          const json = await res.json();
          // If drop-off is enabled on update, also submit drop-off request
          if (form.dropoffJunkshop && form.dropoffDate && form.dropoffTime) {
            try {
              const dropoffPayload = {
                productId: id,
                productTitle: form.title,
                delivery: !!form.delivery,
                pickup: !!form.pickup,
                dropoffJunkshop: !!form.dropoffJunkshop,
                dropoffDate: form.dropoffDate,
                dropoffTime: form.dropoffTime,
                notes: form.description || '',
              };
              const dropoffRes = await authFetch('/api/products/dropoff/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dropoffPayload),
              });
              if (!dropoffRes.ok) {
                console.warn('Failed to submit drop-off request on edit:', dropoffRes.status);
              }
            } catch (e) {
              console.warn('Failed to submit drop-off request on edit:', e.message);
            }
          }
          try { onUpdate && onUpdate(json); } catch (e) { console.warn('onUpdate handler failed', e); }
        } else {
          console.warn('Backend product update returned status', res.status, 'continuing with Firestore fallback');
          const { updateProduct } = await import('../firebaseProductService');
          await updateProduct(id, payload);
          try { onUpdate && onUpdate({ id, ...payload }); } catch (e) { console.warn('onUpdate handler failed', e); }
        }
      } catch (err) {
        console.warn('Backend product update failed, trying Firestore', err.message);
        try {
          const { updateProduct } = await import('../firebaseProductService');
          await updateProduct(id, payload);
          try { onUpdate && onUpdate({ id, ...payload }); } catch (e) { console.warn('onUpdate handler failed', e); }
        } catch (e) {
          console.error('Failed to persist product update via both backend and service', e);
          alert('Failed to update product');
          setIsSaving(false);
          return;
        }
      }
    } else {
      const firstFile = form.images && form.images.length > 0 ? form.images[0] : null;
      let imageUrl = '';
      if (firstFile instanceof File) {
        const fd = new FormData();
        fd.append('image', firstFile);
        try {
          const res = await authFetch('/api/products/upload-image-cloudinary', { method: 'POST', body: fd });
          if (res.ok) {
            const json = await res.json();
            if (json.url) imageUrl = json.url;
          }
        } catch (err) {
          console.warn('Cloudinary upload failed', err);
        }
      }
      const seller = JSON.parse(localStorage.getItem('currentSeller') || '{}');
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        price: parseFloat(form.price) || 0,
        imageUrl: imageUrl || form.imageUrl || '',
        location: form.location || null,
        locationLat: form.locationLat ? Number(form.locationLat) : undefined,
        locationLng: form.locationLng ? Number(form.locationLng) : undefined,
        delivery: !!form.delivery,
        pickup: !!form.pickup,
        dropoffJunkshop: !!form.dropoffJunkshop,
        dropoffDate: form.dropoffJunkshop ? form.dropoffDate : null,
        dropoffTime: form.dropoffJunkshop ? form.dropoffTime : null,
      };
      let createdObj = null;
      try {
        const res = await authFetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) {
          const json = await res.json();
          createdObj = json;
        } else {
          console.warn('Backend product creation returned status', res.status, 'continuing with Firestore fallback');
        }
      } catch (err) {
        console.warn('Backend product creation failed, trying Firestore', err.message);
      }
      if (!createdObj) {
        try {
          const svcRes = await postProductViaService({
            title: form.title,
            description: form.description,
            category: form.category,
            price: parseFloat(form.price) || 0,
            imageUrl: imageUrl || form.imageUrl || '',
            photo: imageUrl || form.imageUrl || '',
            seller: seller.name || seller.username || undefined,
            sellerName: seller.name || seller.username || undefined,
            location: form.location || null,
            locationLat: form.locationLat ? Number(form.locationLat) : undefined,
            locationLng: form.locationLng ? Number(form.locationLng) : undefined,
          }, firstFile instanceof File ? firstFile : undefined);
          createdObj = svcRes || null;
        } catch (e) {
          console.warn('Failed to persist new product via both backend and service', e);
        }
      }
      if (createdObj) {
        // If drop-off to junkshop is enabled, submit the drop-off request
        if (form.dropoffJunkshop && form.dropoffDate && form.dropoffTime) {
          try {
            const dropoffPayload = {
              productId: createdObj.id || createdObj._id,
              productTitle: form.title,
              delivery: !!form.delivery,
              pickup: !!form.pickup,
              dropoffJunkshop: !!form.dropoffJunkshop,
              dropoffDate: form.dropoffDate,
              dropoffTime: form.dropoffTime,
              notes: form.description || '',
            };
            const dropoffRes = await authFetch('/api/products/dropoff/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(dropoffPayload),
            });
            if (!dropoffRes.ok) {
              console.warn('Failed to submit drop-off request:', dropoffRes.status);
            }
          } catch (e) {
            console.warn('Failed to submit drop-off request:', e.message);
          }
        }
        try { onAdd && onAdd(createdObj); } catch (e) { console.warn('onAdd handler failed', e); }
        try {
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('product-created', { detail: createdObj }));
          }
        } catch (e) { console.warn('Failed to dispatch product-created event', e); }
      }
    }
    setIsSaving(false);
    setForm({ title: '', description: '', category: '', price: '', location: '', locationLat: '', locationLng: '', images: [], delivery: false, pickup: false, dropoffJunkshop: false, dropoffDate: '', dropoffTime: '' });
    setImgPreview([]);
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      {isSaving && <FullScreenLoader />}
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-teal-700 mb-4">{editItem ? 'Edit Item' : 'List New Item'}</h2>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          
          {/* Image Upload - Drag & Drop at Top */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
              dragOver
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <label className="cursor-pointer block">
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">📸</span>
                <span className="text-sm font-medium text-gray-700">
                  {imgPreview.length > 0
                    ? `${imgPreview.length} image(s) selected`
                    : 'Drag photos here or click to browse'}
                </span>
                <span className="text-xs text-gray-500">Supported: JPG, PNG, WebP</span>
              </div>
              <input
                name="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImage}
                className="hidden"
                disabled={isSaving}
              />
            </label>
          </div>

          {/* Image Previews */}
          {imgPreview.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {imgPreview.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="preview" className="w-20 h-20 object-cover rounded border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => {
                      setImgPreview(prev => prev.filter((_, idx) => idx !== i));
                      setForm(f => ({ ...f, images: Array.from(f.images).filter((_, idx) => idx !== i) }));
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    disabled={isSaving}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form Fields */}
          <input name="title" value={form.title} onChange={handleChange} placeholder="Title" className="border rounded p-2" required disabled={isSaving} />
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="border rounded p-2" />
          <select name="category" value={form.category} onChange={handleChange} className="border rounded p-2" required>
            <option value="" disabled>Select Category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          
          {/* Price Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Price (₱)</label>
            <div className="grid grid-cols-3 gap-2">
              {priceOptions.map(priceOption => (
                <button
                  key={priceOption}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, price: String(priceOption) }))}
                  className={`p-2 border-2 rounded font-semibold text-sm transition ${
                    form.price === String(priceOption)
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                  disabled={isSaving}
                >
                  ₱{priceOption.toLocaleString()}
                </button>
              ))}
            </div>
            {form.price && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                Selected: <span className="font-bold">₱{Number(form.price).toLocaleString()}</span>
              </div>
            )}
          </div>

          <input name="location" value={form.location} onChange={handleChange} placeholder="Location (e.g. Baguio City)" className="border rounded p-2" disabled={isSaving} />
          
          {/* Location Button */}
          <button
            type="button"
            className={`inline-flex items-center gap-2 px-3 py-1 border rounded text-sm ${isSaving || locating ? 'opacity-60 cursor-not-allowed bg-gray-50 text-gray-400' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}
            disabled={isSaving || locating}
            onClick={async () => {
              if (!navigator.geolocation) return;
              setLocating(true);
              try {
                const getPos = (timeout) => new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout }));
                let pos = null;
                try {
                  pos = await getPos(8000);
                } catch (err) {
                  try { pos = await getPos(15000); } catch (err2) { pos = null; }
                }
                if (!pos) {
                  console.warn('Geo lookup failed or timed out');
                  setLocating(false);
                  return;
                }
                const { accuracy } = pos.coords;
                if (typeof accuracy === 'number' && accuracy > 100) {
                  try {
                    const pos2 = await getPos(10000);
                    if (pos2 && pos2.coords && typeof pos2.coords.accuracy === 'number' && pos2.coords.accuracy < accuracy) {
                      pos.coords = pos2.coords;
                    }
                  } catch (e) { /* ignore */ }
                }
                setForm(f => ({ ...f, locationLat: Number(pos.coords.latitude.toFixed(6)), locationLng: Number(pos.coords.longitude.toFixed(6)) }));
                try {
                  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(pos.coords.latitude)}&lon=${encodeURIComponent(pos.coords.longitude)}&addressdetails=1`;
                  const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
                  if (resp.ok) {
                    const j = await resp.json();
                    const addr = j && j.address ? j.address : null;
                    let precise = '';
                    if (addr) {
                      const left = [];
                      if (addr.house_number) left.push(addr.house_number);
                      const street = addr.road || addr.pedestrian || addr.footway || addr.cycleway || addr.residential || addr.path || addr.street;
                      if (street) left.push(street);
                      const middle = [];
                      if (addr.neighbourhood) middle.push(addr.neighbourhood);
                      if (addr.suburb) middle.push(addr.suburb);
                      if (addr.village && !middle.includes(addr.village)) middle.push(addr.village);
                      const cityParts = [];
                      if (addr.city) cityParts.push(addr.city);
                      else if (addr.town) cityParts.push(addr.town);
                      else if (addr.county) cityParts.push(addr.county);
                      const tail = [];
                      if (addr.state) tail.push(addr.state);
                      if (addr.postcode) tail.push(addr.postcode);
                      if (addr.country) tail.push(addr.country);
                      const segments = [];
                      if (left.length) segments.push(left.join(' '));
                      if (middle.length) segments.push(middle.join(', '));
                      if (cityParts.length) segments.push(cityParts.join(', '));
                      if (tail.length) segments.push(tail.join(' '));
                      precise = segments.join(', ');
                    }
                    if ((!precise || precise.trim() === '') && j && j.display_name) precise = j.display_name;
                    if (precise && precise.length > 240) precise = precise.slice(0, 240) + '...';
                    if (precise) setForm(f => ({ ...f, location: precise }));
                  }
                } catch (err) {
                  console.warn('Reverse geocode failed', err);
                }
              } finally {
                setLocating(false);
              }
            }}
          >
            <span>{locating ? 'Locating...' : 'Use current location'}</span>
          </button>

          {/* Delivery, Pickup, Drop-off Options */}
          <div className="flex flex-col gap-3 mt-2 text-sm">
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2"><input type="checkbox" name="delivery" checked={!!form.delivery} onChange={handleCheckboxChange} /> Delivery</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" name="pickup" checked={!!form.pickup} onChange={handleCheckboxChange} /> Pickup</label>
            </div>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="dropoffJunkshop" checked={!!form.dropoffJunkshop} onChange={handleCheckboxChange} disabled={isSaving} />
              <span>Drop off to Junkshop</span>
            </label>
            {form.dropoffJunkshop && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                <label className="block text-sm font-medium mb-2">Preferred Drop-off Date & Time</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={form.dropoffDate}
                    onChange={(e) => setForm(f => ({ ...f, dropoffDate: e.target.value }))}
                    className="flex-1 border rounded p-2"
                    disabled={isSaving}
                    required
                  />
                  <input
                    type="time"
                    value={form.dropoffTime}
                    onChange={(e) => setForm(f => ({ ...f, dropoffTime: e.target.value }))}
                    className="flex-1 border rounded p-2"
                    disabled={isSaving}
                    required
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">Admin will review and confirm your drop-off appointment</p>
              </div>
            )}
          </div>

          {/* Submit and Cancel Buttons */}
          <div className="flex gap-2 mt-4">
            <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded" disabled={isSaving}>{editItem ? 'Save Changes' : 'Upload Item'}</button>
            <button type="button" className="bg-gray-200 px-4 py-2 rounded" onClick={onClose} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
