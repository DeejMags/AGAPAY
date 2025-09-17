import React from 'react';

export default function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-90">
      <img src="/assets/AGAPAY logo.png" alt="Agapay Logo" className="w-24 h-24 mb-4 animate-spin-slow" />
      <span className="text-2xl font-bold text-teal-600 tracking-wide">Loading...</span>
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 2s linear infinite; }
      `}</style>
    </div>
  );
}
