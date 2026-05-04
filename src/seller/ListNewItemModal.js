import React, { useEffect, useState } from 'react';
import authFetch from '../utils/authFetch';
import FullScreenLoader from '../components/FullScreenLoader';
import { postProduct as postProductViaService } from '../firebaseProductService';
// removed unused import for missing asset

export default function ListNewItemModal({ open, onClose, onAdd, editItem = null, onUpdate }) {
  const [form, setForm] = useState({ title: '', description: '', category: '', price: '', location: '', locationLat: '', locationLng: '', images: [], delivery: false, pickup: false });
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
  const [locating, setLocating] = useState(false);

  // Prefill form when editing
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
      });
      // If existing image is available, show as preview
      const previews = [];
      if (Array.isArray(editItem.photo)) previews.push(...editItem.photo);
      else if (editItem.imageUrl) previews.push(editItem.imageUrl);
      setImgPreview(previews);
    }
    if (open && !editItem) {
      setForm({ title: '', description: '', category: '', price: '', location: '', locationLat: '', locationLng: '', images: [], delivery: false, pickup: false });
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
        location: form.location || null,
        locationLat: form.locationLat ? Number(form.locationLat) : undefined,
        locationLng: form.locationLng ? Number(form.locationLng) : undefined,
        delivery: !!form.delivery,
        pickup: !!form.pickup,
      };
      // Persist to backend (JSON; backend will use provided imageUrl). Call onAdd only after persistence succeeds
      let createdObj = null;
      try {
        const res = await authFetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProduct) });
        if (res.ok) {
          // backend returns created product summary
          try { createdObj = await res.json(); } catch (e) { createdObj = null; }
        } else {
          throw new Error('Backend create failed');
        }
      } catch (err) {
        // Fallback: use client service to upload (includes Storage fallback) and create Firestore doc
        try {
          const svcRes = await postProductViaService({
            title: form.title,
            description: form.description,
            category: form.category,
            price: form.price,
            status: 'pending',
            sellerId: seller.id || undefined,
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

      // If persistence succeeded, notify parent via onAdd so seller UI updates,
      // and dispatch a global event so admin or other parts can refresh in real-time.
      if (createdObj) {
        try { onAdd && onAdd(createdObj); } catch (e) { console.warn('onAdd handler failed', e); }
        try {
          // Dispatch a window event so admin/product lists can react immediately
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('product-created', { detail: createdObj }));
          }
        } catch (e) { console.warn('Failed to dispatch product-created event', e); }
      }
    }
    setIsSaving(false);
    setForm({ title: '', description: '', category: '', price: '', location: '', locationLat: '', locationLng: '', images: [], delivery: false, pickup: false });
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
          <input name="location" value={form.location} onChange={handleChange} placeholder="Location (e.g. Baguio City)" className="border rounded p-2" disabled={isSaving} />
          <div className="flex items-center gap-4 mt-2 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" name="delivery" checked={!!form.delivery} onChange={handleCheckboxChange} /> Delivery</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" name="pickup" checked={!!form.pickup} onChange={handleCheckboxChange} /> Pickup</label>
          </div>
          <button
            type="button"
            className={`inline-flex items-center gap-2 px-3 py-1 border rounded text-sm ${isSaving || locating ? 'opacity-60 cursor-not-allowed bg-gray-50 text-gray-400' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}
            disabled={isSaving || locating}
            onClick={async () => {
              if (!navigator.geolocation) return;
              setLocating(true);
              try {
                // Helper to get a position with given timeout
                const getPos = (timeout) => new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout }));

                // Try primary attempt
                let pos = null;
                try {
                  pos = await getPos(8000);
                } catch (err) {
                  // try a longer timeout once
                  try { pos = await getPos(15000); } catch (err2) { pos = null; }
                }

                if (!pos) {
                  console.warn('Geo lookup failed or timed out');
                  setLocating(false);
                  return;
                }

                const { accuracy } = pos.coords;

                // If accuracy is poor (>100m), attempt one more read
                if (typeof accuracy === 'number' && accuracy > 100) {
                  try {
                    const pos2 = await getPos(10000);
                    if (pos2 && pos2.coords && typeof pos2.coords.accuracy === 'number' && pos2.coords.accuracy < accuracy) {
                      // use improved reading
                      const { latitude: la2, longitude: lo2 } = pos2.coords;
                      pos.coords = pos2.coords;
                      pos.coords.latitude = la2;
                      pos.coords.longitude = lo2;
                    }
                  } catch (e) {
                    // ignore retry failure
                  }
                }

                // Commit numeric coords (as numbers) so ProductDetail map recognizes them
                setForm(f => ({ ...f, locationLat: Number(pos.coords.latitude.toFixed(6)), locationLng: Number(pos.coords.longitude.toFixed(6)) }));

                // Reverse-geocode to prefer precise street address (house number + road)
                try {
                  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(pos.coords.latitude)}&lon=${encodeURIComponent(pos.coords.longitude)}&addressdetails=1`;
                  const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
                  if (resp.ok) {
                    const j = await resp.json();
                    const addr = j && j.address ? j.address : null;
                    let precise = '';
                    if (addr) {
                      // Prefer house_number + road/street information
                      const left = [];
                      if (addr.house_number) left.push(addr.house_number);
                      // road may appear under different keys
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

                      // Build segments
                      const segments = [];
                      if (left.length) segments.push(left.join(' '));
                      if (middle.length) segments.push(middle.join(', '));
                      if (cityParts.length) segments.push(cityParts.join(', '));
                      if (tail.length) segments.push(tail.join(' '));

                      precise = segments.join(', ');
                    }
                    // Fallback to display_name if precise empty
                    if ((!precise || precise.trim() === '') && j && j.display_name) precise = j.display_name;
                    // Trim to reasonable length (avoid overly long strings)
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
