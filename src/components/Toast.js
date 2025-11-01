import React, { useEffect } from 'react';

export default function Toast({ open, onClose, message, title, variant = 'success', duration = 3000, position = 'bottom-right' }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { onClose && onClose(); }, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  if (!open) return null;

  const colors = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-yellow-600 text-white',
    info: 'bg-blue-600 text-white',
  };
  const icon = {
    success: '✅',
    error: '⚠️',
    warning: '⚠️',
    info: 'ℹ️',
  }[variant] || 'ℹ️';

  const containerPos = {
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  }[position] || 'bottom-right';

  return (
    <div className={`fixed z-[60] pointer-events-none ${containerPos}`}>
      <div className={`px-4 py-3 rounded-lg shadow-xl pointer-events-auto ${colors[variant] || colors.success} animate-[toast-in_200ms_ease-out]`}
        style={{ boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
        <div className="flex items-start gap-3">
          <div className="text-xl leading-none">{icon}</div>
          <div className="flex-1">
            {title && <div className="font-semibold">{title}</div>}
            <div className="text-sm opacity-95">{message}</div>
          </div>
          <button className="opacity-90 hover:opacity-100" onClick={onClose} aria-label="Close toast">✕</button>
        </div>
      </div>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
