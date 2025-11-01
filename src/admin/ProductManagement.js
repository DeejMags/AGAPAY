
import React, { useState, useEffect } from 'react';
import authFetch from '../utils/authFetch';
import { getAllProducts } from '../firebaseProductService';
import DenyModal from '../components/DenyModal';
export default function ProductManagement({ products: parentProducts = null, setProducts: setParentProducts }) {
  const [search, setSearch] = useState('');
  // Normalize parentProducts: it may be an array or a paged object { items: [] }
  const normalizedParent = parentProducts
    ? (Array.isArray(parentProducts) ? parentProducts : (parentProducts.items || []))
    : null;
  const [products, setProducts] = useState(normalizedParent || []);
  const [loading, setLoading] = useState(normalizedParent == null);
  const [statusFilter, setStatusFilter] = useState('');
  const [denyModalOpen, setDenyModalOpen] = useState(false);
  const [denyTargetId, setDenyTargetId] = useState(null);
  const [denyInitialReason, setDenyInitialReason] = useState('');

  useEffect(() => {
    if (parentProducts) {
      const items = Array.isArray(parentProducts) ? parentProducts : (parentProducts.items || []);
      setProducts(items);
      setLoading(false);
      return;
    }
    async function load() {
      setLoading(true);
      try {
        // Request admin-style product list (includes pending/denied/etc.) and seller info
        const statusPart = statusFilter ? `status=${encodeURIComponent(statusFilter)}&` : '';
        const q = `?${statusPart}admin=true&includeSeller=true`;
        const res = await authFetch('/api/products' + q);
        if (res.ok) {
          const data = await res.json();
          // backend may return { items: [...], page, pageSize }
          const items = Array.isArray(data) ? data : (data.items || []);
          setProducts(items);
          if (setParentProducts) setParentProducts(data);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Backend products fetch failed, falling back to client Firestore:', err.message);
      }
      try {
        const data = await getAllProducts();
        setProducts(data);
        if (setParentProducts) setParentProducts(data);
      } catch (err) {
        console.error('Failed to load products from Firestore:', err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [parentProducts, setParentProducts, statusFilter]);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return (p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
  });

    async function handleApprove(id) {
    try {
      const res = await authFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
      if (!res.ok) throw new Error('Backend approve failed');
      const updated = await res.json();
      if (setProducts) setProducts(products.map(p => (p.id === id ? { ...p, ...updated } : p)));
  // Notify other parts of the app (marketplace, seller dashboard) to refresh
  try { window.dispatchEvent(new CustomEvent('product-updated', { detail: { id, action: 'approve' } })); } catch (e) {}
      return;
    } catch (err) {
      // Fallback to Firestore client
      // Optionally implement Firestore client update here
    }
    setProducts(products.map(p => (p.id === id || p._id === id) ? { ...p, status: 'active' } : p));
    if (setParentProducts) setParentProducts(prev => prev.map(p => (p.id === id || p._id === id) ? { ...p, status: 'active' } : p));
    try { window.dispatchEvent(new CustomEvent('product-updated', { detail: { id, action: 'approve' } })); } catch(e){}
  }
  async function handleDeny(id) {
    // Open modal for deny reason
    setDenyTargetId(id);
    const existing = products.find(p => p.id === id || p._id === id);
    setDenyInitialReason(existing && existing.adminMessage ? existing.adminMessage : '');
    setDenyModalOpen(true);
  }

  async function submitDeny(reason) {
    const id = denyTargetId;
    setDenyModalOpen(false);
    if (!id) return;
    try {
      const res = await authFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'denied', adminMessage: reason })
      });
      if (!res.ok) throw new Error('Backend deny failed');
      const updated = await res.json();
      if (setProducts) setProducts(products.map(p => (p.id === id ? { ...p, ...updated } : p)));
  try { window.dispatchEvent(new CustomEvent('product-updated', { detail: { id, action: 'deny' } })); } catch(e){}
      return;
    } catch (err) {
      // Fallback to Firestore client
    }
    setProducts(products.map(p => (p.id === id || p._id === id) ? { ...p, status: 'denied', adminMessage: reason } : p));
    if (setParentProducts) setParentProducts(prev => prev.map(p => (p.id === id || p._id === id) ? { ...p, status: 'denied', adminMessage: reason } : p));
    try { window.dispatchEvent(new CustomEvent('product-updated', { detail: { id, action: 'deny' } })); } catch(e){}
  }
  async function handleDelete(id) {
    const stringId = typeof id === 'string' ? id : String(id);
    try {
  const res = await authFetch(`/api/products/${stringId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Backend delete failed');
    } catch (err) {
      // Fallback to Firestore client
      // Optionally implement Firestore client delete here
      // import { deleteDoc, doc } from 'firebase/firestore';
      // await deleteDoc(doc(db, 'products', stringId));
    }
    setProducts(products.filter(p => p.id !== stringId && p._id !== stringId));
    if (setParentProducts) setParentProducts(prev => prev.filter(p => p.id !== stringId && p._id !== stringId));
    try { window.dispatchEvent(new CustomEvent('product-updated', { detail: { id: stringId, action: 'delete' } })); } catch(e){}
  }
  function refresh() {
    // Actively fetch from backend and update state
    setLoading(true);
    (async () => {
      try {
          const res = await authFetch('/api/products?admin=true&includeSeller=true');
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.items || []);
          setProducts(items);
          if (setParentProducts) setParentProducts(items);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Backend refresh failed, falling back to Firestore', err.message);
      }
      try {
        const data = await getAllProducts();
        setProducts(data);
        if (setParentProducts) setParentProducts(data);
      } catch (err) {
        console.error('Failed to refresh products from Firestore:', err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Product Management</h2>
      <div className="flex items-center gap-4 mb-4">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products..." className="border rounded-lg px-4 py-2 w-full max-w-md" />
        <select value={statusFilter} onChange={e=>{ setStatusFilter(e.target.value); }} className="p-2 border rounded">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="denied">Denied</option>
          <option value="sold">Sold</option>
        </select>
        <button className="px-3 py-1 bg-teal-600 text-white rounded" onClick={async ()=>{ await refresh(); }}>Refresh</button>
      </div>
      {loading ? (
        <div>Loading products...</div>
      ) : (
        <div className="mt-2 overflow-x-auto bg-white rounded-xl shadow mb-8">
          <table className="min-w-[700px] w-full table-auto">
            <thead>
              <tr className="bg-teal-100 text-teal-700">
                <th className="p-3 text-left">Image</th>
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Price</th>
                <th className="p-3 text-left">Created</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Owner</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p._id || p.id} className="border-b">
                  <td className="p-3 w-20">
                    <img src={p.imageUrl || p.image || 'https://via.placeholder.com/80'} alt="product" className="w-16 h-16 object-cover rounded" />
                  </td>
                  <td className="p-3 break-words max-w-xs">
                    <div className="font-medium">{p.title}</div>
                    {p.description && <div className="text-xs text-gray-500 truncate max-w-[240px]">{p.description}</div>}
                    {p.adminMessage && (
                      <div className="mt-1 text-xs text-red-600">Admin note: {p.adminMessage}</div>
                    )}
                  </td>
                  <td className="p-3">{p.price === null || p.price === undefined ? 'No price' : (typeof p.price === 'number' ? p.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : String(p.price))}</td>
                  <td className="p-3">{p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</td>
                  <td className="p-3">{p.status}</td>
                  <td className="p-3">{p.sellerName || p.sellerDisplayName || (p.sellerEmail ? String(p.sellerEmail).split('@')[0] : '') || p.sellerId || 'Unknown'}</td>
                  <td className="p-3 flex gap-2 flex-wrap">
                    {/* If item is sold, do not render any action buttons */}
                    {((p.status || '').toString().toLowerCase() === 'sold') ? (
                      <span className="text-gray-400">No actions</span>
                    ) : (
                      <>
                        {/* Show Approve/Deny for items that are not already active */}
                        {((p.status || '').toString().toLowerCase() !== 'active') && (
                          <>
                            <button className="px-3 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 transition" onClick={()=>handleApprove(p.id || p._id)}>Approve</button>
                            <button className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition" onClick={()=>handleDeny(p.id || p._id)}>Deny</button>
                          </>
                        )}
                        {/* Admin does not mark items as sold here; status is display-only per request */}
                        <button className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition" onClick={()=>handleDelete(p.id || p._id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <DenyModal
        open={denyModalOpen}
        onClose={() => setDenyModalOpen(false)}
        initialReason={denyInitialReason}
        onSubmit={(reason) => submitDeny(reason)}
      />
    </div>
  );
}
