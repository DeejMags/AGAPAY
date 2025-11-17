import React, { useEffect, useState } from 'react';
import authFetch from '../utils/authFetch';

export default function ReportModal({ open, onClose, reportedUser, onSubmitted }) {
  const [reason, setReason] = useState('Spam');
  const [details, setDetails] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { if (!open) { setReason('Spam'); setDetails(''); setError(''); setSubmitting(false); } }, [open]);
  if (!open) return null;
  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('reportedUserId', reportedUser?.id || reportedUser?._id || reportedUser?.authId || '');
      fd.append('reportedUserEmail', reportedUser?.email || '');
      fd.append('reportedUserName', reportedUser?.username || reportedUser?.name || '');
      fd.append('reason', reason || '');
      fd.append('details', details || '');
      fd.append('context', JSON.stringify({ page: 'profile', profileId: reportedUser?.id || null }));
      if (imageFile) fd.append('image', imageFile);
      const res = await authFetch('/api/reports', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Report failed');
      const json = await res.json();
      onSubmitted && onSubmitted(json);
  // notify admin dashboard/sidebar to refresh counts
  try { window.dispatchEvent(new Event('reports-changed')); } catch {}
      setSubmitted(true);
      // Auto close after short delay
      setTimeout(() => { setSubmitted(false); onClose && onClose(); }, 1500);
    } catch (e) {
      setError(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-4 py-3 border-b font-semibold">Report user</div>
        {submitted ? (
          <div className="p-6 text-center">
            <div className="text-lg font-semibold mb-2">Report submitted</div>
            <div className="text-gray-600 mb-4">Thank you. Our team will review your report.</div>
            <button type="button" className="px-4 py-2 rounded bg-teal-600 text-white" onClick={()=>{ setSubmitted(false); onClose && onClose(); }}>OK</button>
          </div>
        ) : (
        <form className="p-4 flex flex-col gap-3" onSubmit={submit}>
          <div className="text-sm text-gray-600">Reporting: <span className="font-medium">{reportedUser?.username || reportedUser?.name || reportedUser?.email || 'User'}</span></div>
          <label className="text-sm font-medium">Reason</label>
          <select value={reason} onChange={e=>setReason(e.target.value)} className="border rounded px-3 py-2">
            <option>Spam</option>
            <option>Fraud</option>
            <option>Harassment</option>
            <option>Inappropriate content</option>
            <option>Other</option>
          </select>
          <label className="text-sm font-medium">Details</label>
          <textarea value={details} onChange={e=>setDetails(e.target.value)} className="border rounded px-3 py-2" rows={4} placeholder="Describe the issue..." />
          <label className="text-sm font-medium">Attach image (optional)</label>
          <input type="file" accept="image/*" onChange={e=> setImageFile((e.target.files && e.target.files[0]) || null)} />
          {imageFile && (
            <div className="mt-1">
              <img src={URL.createObjectURL(imageFile)} alt="preview" className="w-40 h-28 object-cover rounded" />
            </div>
          )}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-teal-600 text-white disabled:opacity-60" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit report'}</button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
