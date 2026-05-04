import React from 'react';

export default function ConfirmModal({ open, title, children, onCancel, onConfirm, confirmLabel = 'Confirm', confirmDanger = false, confirmLoading = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <div className="mb-4">{children}</div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded bg-gray-200" onClick={onCancel}>Cancel</button>
          <button
            className={`px-3 py-1 rounded ${confirmDanger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-teal-600 text-white'}`}
            onClick={onConfirm}
            disabled={confirmLoading}
          >{confirmLoading ? 'Working...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
