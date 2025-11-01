import React, { useEffect, useMemo, useState } from 'react';
import { auth } from '../firebase';
import authFetch from '../utils/authFetch';
import { getUserConversations } from '../firebaseMessageService';

// Minimal modal UI for picking buyer from your conversations and submitting a sale + review
export default function MarkSoldModal({ open, onClose, product, onMarked }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [candidates, setCandidates] = useState([]); // [{ id, name }]

  const me = useMemo(() => (auth && auth.currentUser && auth.currentUser.uid) || null, []);

  useEffect(() => {
    if (!open) return;
    let abort = false;
    async function loadCandidates() {
      setError('');
      try {
        // load conversations and extract other participant ids
        const convs = await getUserConversations(me);
        const ids = Array.from(new Set(convs.flatMap(c => (c.participants || []).filter(p => p && p !== me))));
        // fetch names (best-effort) from backend
        const results = [];
        await Promise.all(ids.slice(0, 50).map(async (id) => {
          try {
            const res = await authFetch(`/api/users/${id}`);
            if (res.ok) {
              const u = await res.json();
              const name = u.name || u.displayName || u.username || u.email || id;
              results.push({ id, name });
            } else {
              results.push({ id, name: id });
            }
          } catch (e) {
            results.push({ id, name: id });
          }
        }));
        if (!abort) setCandidates(results.sort((a,b)=> a.name.localeCompare(b.name)));
      } catch (e) {
        if (!abort) setError('Failed to load conversations');
      }
    }
    loadCandidates();
    return () => { abort = true; };
  }, [open, me]);

  useEffect(() => {
    if (!open) {
      setError('');
      setBuyerId('');
      setRating(5);
      setComment('');
      setCandidates([]);
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
  if (!product) return;
  if (!buyerId) { setError('Please choose a buyer'); return; }
    setLoading(true);
    setError('');
    try {
      // call backend mark-sold
      const body = { buyerId };
      const res = await authFetch(`/api/products/${product.id || product._id}/mark-sold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed to mark sold');
      const json = await res.json();

      // write a review (best-effort) to Firestore
      try {
        const { db } = await import('../firebase');
        const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'reviews'), {
          productId: product.id || product._id,
          // canonical fields
          reviewerId: me,
          revieweeId: buyerId,
          // backward/compat fields for existing UI
          sellerId: me,
          buyerId: buyerId,
          rating: Number(rating) || 0,
          comment: comment || '',
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        // ignore review errors
      }

      if (typeof onMarked === 'function') {
        onMarked({
          productId: product.id || product._id,
          buyerId: json.buyerId || buyerId,
          sellerPoints: Number(json.sellerPoints) || 0,
          buyerPoints: Number(json.buyerPoints) || 0,
          alreadyAwarded: !!json.alreadyAwarded,
        });
      }
      onClose && onClose();
    } catch (e) {
      setError(e.message || 'Failed to complete sale');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Mark as Sold</h3>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buyer (from your conversations)</label>
            <select className="w-full border rounded px-3 py-2" value={buyerId} onChange={e=>setBuyerId(e.target.value)} required>
              <option value="" disabled>Select buyer</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
              <select className="w-full border rounded px-3 py-2" value={rating} onChange={e=>setRating(Number(e.target.value))}>
                {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} ⭐</option>)}
              </select>
            </div>
            <div className="flex-[2]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Short Review</label>
              <input className="w-full border rounded px-3 py-2" placeholder="Great buyer!" value={comment} onChange={e=>setComment(e.target.value)} />
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-4 py-2 rounded border" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className={`px-4 py-2 rounded text-white ${loading ? 'bg-teal-300' : 'bg-teal-600 hover:bg-teal-700'}`} disabled={loading}>
              {loading ? 'Saving…' : 'Confirm Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
