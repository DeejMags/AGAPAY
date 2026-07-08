import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const COUNTDOWN_SECONDS = 10;

async function doLogout(navigate) {
  try {
    await signOut(auth);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  } catch (e) {
    console.error('Logout failed:', e);
    navigate('/login');
  }
}

export default function BanNotificationModal({ isOpen, banReason, userName }) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  // Reset and start countdown whenever the modal opens
  useEffect(() => {
    if (!isOpen) {
      setCountdown(COUNTDOWN_SECONDS);
      return;
    }
    setCountdown(COUNTDOWN_SECONDS);
    const interval = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Auto-logout when countdown reaches 0
  const logoutFn = useCallback(() => doLogout(navigate), [navigate]);
  useEffect(() => {
    if (isOpen && countdown === 0) logoutFn();
  }, [countdown, isOpen, logoutFn]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
        <div className="text-5xl mb-4">⛔</div>
        <h2 className="text-2xl font-bold text-red-600 mb-2">Account Banned</h2>
        <p className="text-gray-700 mb-4">
          {userName ? `Your account (${userName}) has been banned.` : 'Your account has been banned.'}
        </p>
        {banReason && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 text-left">
            <p className="text-sm font-semibold text-red-700">Reason:</p>
            <p className="text-sm text-red-600">{banReason}</p>
          </div>
        )}
        {/* Countdown circle */}
        <div className="flex items-center justify-center mb-3">
          <div className="w-16 h-16 rounded-full border-4 border-red-500 flex items-center justify-center">
            <span className="text-2xl font-bold text-red-600">{countdown}</span>
          </div>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          You will be logged out in {countdown} second{countdown !== 1 ? 's' : ''}.
        </p>
        <button
          onClick={() => doLogout(navigate)}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
        >
          Logout Now
        </button>
      </div>
    </div>
  );
}
