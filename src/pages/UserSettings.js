import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import authFetch from '../utils/authFetch';
import { onAuthStateChanged, GoogleAuthProvider, linkWithPopup } from 'firebase/auth';

export default function UserSettings() {

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    profilePic: null,
    location: ''
  });
  const [originalProfile, setOriginalProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [setSavedOnce] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [googleConnecting, setGoogleConnecting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        const authProfile = {
          name: u.displayName || '',
          email: u.email || '',
          phone: u.phoneNumber || '',
          profilePic: u.photoURL || null,
          location: ''
        };
        setProfile(authProfile);
        // Keep originalProfile with an id so backend PUT can use auth uid
        const orig = { id: u.uid, ...authProfile };
        setOriginalProfile(orig);
        // attempt to get authoritative data from backend
        fetchUserFromBackend(orig.id);
      } else {
        try {
          const stored = JSON.parse(localStorage.getItem('user') || 'null');
          if (stored) {
            setProfile({
              name: stored.name || '',
              email: stored.email || '',
              phone: stored.phone || '',
              profilePic: stored.profilePic || stored.photoURL || null,
              location: stored.location || ''
            });
            setOriginalProfile(stored);
            if (stored.id) fetchUserFromBackend(stored.id);
          }
        } catch (e) {
        }
      }
    });
    return () => unsub();
  }, []);

  // Fetch user profile from backend if available and merge into state
  async function fetchUserFromBackend(id) {
    if (!id) return;
    try {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      // Merge backend fields into profile (prefer backend)
      setProfile(p => ({
        name: data.name || p.name,
        email: data.email || p.email,
        phone: data.phone || p.phone,
        profilePic: data.profilePic || data.photoURL || p.profilePic,
        location: data.location || p.location || ''
      }));
      setOriginalProfile(prev => ({ ...(prev || {}), ...data, id }));
    } catch (e) {
      // backend unreachable — keep local state
      console.warn('Unable to fetch user from backend:', e.message || e);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        {/* <UserIcon className="w-7 h-7 text-teal-600" /> */}
        Account Settings
      </h1>
  <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {/* <CogIcon className="w-6 h-6 text-teal-500" /> */}
          Profile
        </h2>
        <form className="flex flex-col gap-4">
          <div className="flex flex-col items-center mb-2">
            <div className="relative w-32 h-32">
              {/* Profile Image */}
              {profile.profilePic ? (
                <img
                  src={profile.profilePic}
                  alt={profile.name ? `${profile.name} profile` : 'Profile'}
                  className="w-32 h-32 object-cover rounded-full border shadow"
                />
              ) : (
                <div className="w-32 h-32 rounded-full border shadow bg-gray-100 flex items-center justify-center">
                  {/* User-provided person icon SVG (keeps the cyan fill color) */}
                  <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#3FD2A6" aria-hidden="true">
                    <path d="M480-481q-66 0-108-42t-42-108q0-66 42-108t108-42q66 0 108 42t42 108q0 66-42 108t-108 42ZM160-160v-94q0-38 19-65t49-41q67-30 128.5-45T480-420q62 0 123 15.5t127.92 44.69q31.3 14.13 50.19 40.97Q800-292 800-254v94H160Zm60-60h520v-34q0-16-9.5-30.5T707-306q-64-31-117-42.5T480-360q-57 0-111 11.5T252-306q-14 7-23 21.5t-9 30.5v34Zm260-321q39 0 64.5-25.5T570-631q0-39-25.5-64.5T480-721q-39 0-64.5 25.5T390-631q0 39 25.5 64.5T480-541Zm0-90Zm0 411Z"/>
                  </svg>
                </div>
              )}
              {isEditing && (
                <button
                  type="button"
                  className="absolute bottom-2 right-2 bg-white rounded-full p-2 shadow hover:bg-gray-100 transition"
                  aria-label="Edit profile picture"
                  onClick={() => document.getElementById('profilePicInput').click()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#3FD2A6"><path d="M180-180h44l472-471-44-44-472 471v44Zm-60 60v-128l575-574q8-8 19-12.5t23-4.5q11 0 22 4.5t20 12.5l44 44q9 9 13 20t4 22q0 11-4.5 22.5T823-694L248-120H120Zm659-617-41-41 41 41Zm-105 64-22-22 44 44-22-22Z"/></svg>
                </button>
              )}
              <input
                id="profilePicInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setProfile(p => ({ ...p, profilePic: ev.target.result }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </div>
          </div>
          {/* Name */}
          {isEditing ? (
            <input
              type="text"
              placeholder="Name*"
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              className="border rounded p-2"
              required
            />
          ) : (
            <div className="border rounded p-2 bg-gray-50 text-gray-800">{profile.name || '—'}</div>
          )}

          {/* Email */}
          {isEditing ? (
            <input
              type="email"
              placeholder="Email*"
              value={profile.email}
              onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
              className="border rounded p-2"
              required
            />
          ) : (
            <div className="border rounded p-2 bg-gray-50 text-gray-800">{profile.email || '—'}</div>
          )}

          {/* Phone */}
          {isEditing ? (
            <input
              type="tel"
              placeholder="Phone Number*"
              value={profile.phone}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              className="border rounded p-2"
              required
            />
          ) : (
            <div className="border rounded p-2 bg-gray-50 text-gray-800">{profile.phone || '—'}</div>
          )}

          {/* Location */}
          {isEditing ? (
            <input
              type="text"
              placeholder="Location*"
              value={profile.location}
              onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
              className="border rounded p-2"
              required
            />
          ) : (
            <div className="border rounded p-2 bg-gray-50 text-gray-800">{profile.location || '—'}</div>
          )}
          <div className="flex items-center gap-3">
            {!isEditing ? (
              <button
                type="button"
                className="px-4 py-2 bg-teal-600 text-white rounded"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="px-4 py-2 bg-teal-600 text-white rounded"
                  onClick={async () => {
                    // Validate required fields
                    if (!profile.name || !profile.email || !profile.phone || !profile.location) {
                      setSaveStatus('Please fill in all required fields.');
                      setTimeout(() => setSaveStatus(''), 2000);
                      return;
                    }
                    setSaveStatus('Saving...');
                    try {
                      // Try backend update
                      const currentUser = originalProfile || JSON.parse(localStorage.getItem('user') || '{}');
                      if (currentUser && currentUser.id) {
                        const res = await fetch(`/api/users/${currentUser.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
                        if (!res.ok) throw new Error('API save failed');
                      }
                      // persist to localStorage
                      const updatedUser = { ...currentUser, ...profile };
                      localStorage.setItem('user', JSON.stringify(updatedUser));
                      // Update agapay_users list if present
                      const users = JSON.parse(localStorage.getItem('agapay_users') || '[]');
                      const idx = users.findIndex(u => u.id === updatedUser.id);
                      if (idx >= 0) {
                        users[idx] = { ...users[idx], ...profile };
                        localStorage.setItem('agapay_users', JSON.stringify(users));
                      }
                      setOriginalProfile(updatedUser);
                      setIsEditing(false);
                      setSavedOnce(true);
                      setSaveStatus('Profile saved successfully!');
                      setTimeout(() => setSaveStatus(''), 2000);
                    } catch (e) {
                      console.warn('Save failed, persisted locally', e);
                      // fallback: persist locally
                      try {
                        const currentUser = originalProfile || JSON.parse(localStorage.getItem('user') || '{}');
                        const updatedUser = { ...currentUser, ...profile };
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        setOriginalProfile(updatedUser);
                        setIsEditing(false);
                        setSavedOnce(true);
                        setSaveStatus('Saved locally (backend unavailable)');
                        setTimeout(() => setSaveStatus(''), 2000);
                      } catch (e2) {
                        setSaveStatus('Error saving profile!');
                        setTimeout(() => setSaveStatus(''), 2000);
                      }
                    }
                  }}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
                  onClick={() => {
                    if (originalProfile) {
                      setProfile({
                        name: originalProfile.name || '',
                        email: originalProfile.email || '',
                        phone: originalProfile.phone || '',
                        profilePic: originalProfile.profilePic || originalProfile.photoURL || null,
                        location: originalProfile.location || ''
                      });
                    }
                    setIsEditing(false);
                    setSaveStatus('Edit canceled');
                    setTimeout(() => setSaveStatus(''), 1500);
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          {saveStatus && (
            <div className={`mt-2 text-sm ${saveStatus.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>{saveStatus}</div>
          )}
        </form>
        <button type="button" className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded">Change Password</button>
        <div className="mt-4 flex gap-4">
            <button
              type="button"
              className="px-4 py-2 bg-teal-600 text-white rounded flex items-center gap-2"
              onClick={async () => {
                // Link current Firebase user to Google provider
                setGoogleConnecting(true);
                setSaveStatus('');
                try {
                  if (!auth.currentUser) {
                    setSaveStatus('You must be signed in to connect Google.');
                    setGoogleConnecting(false);
                    return;
                  }
                  // check if already linked
                  const alreadyLinked = (auth.currentUser.providerData || []).some(p => p.providerId === 'google.com');
                  if (alreadyLinked) {
                    setSaveStatus('Your account is already connected to Google.');
                    setGoogleConnecting(false);
                    return;
                  }
                  const provider = new GoogleAuthProvider();
                  const result = await linkWithPopup(auth.currentUser, provider);
                  // update profile state from result.user
                  const u = result.user;
                  setProfile(p => ({ ...p, email: u.email || p.email, profilePic: u.photoURL || p.profilePic }));
                  // Persist to backend if possible
                  try {
                    const currentUser = originalProfile || JSON.parse(localStorage.getItem('user') || '{}');
                    if (currentUser && currentUser.id) {
                      await fetch(`/api/users/${currentUser.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, profilePic: u.photoURL }) });
                    }
                  } catch (e) {
                    // ignore backend errors
                  }
                  setSaveStatus('Google connected successfully.');
                } catch (err) {
                  console.error('Google linking error', err);
                  // common error: credential-already-in-use (the Google account is already linked to another Firebase user)
                  if (err && err.code === 'auth/credential-already-in-use') {
                    setSaveStatus('This Google account is already linked to another user.');
                  } else if (err && err.message) {
                    setSaveStatus(err.message);
                  } else {
                    setSaveStatus('Failed to connect Google. Please try again.');
                  }
                } finally {
                  setGoogleConnecting(false);
                  setTimeout(() => setSaveStatus(''), 3000);
                }
              }}
              disabled={googleConnecting}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="22" height="22"><path d="M 26 2 C 13.308594 2 3 12.308594 3 25 C 3 37.691406 13.308594 48 26 48 C 35.917969 48 41.972656 43.4375 45.125 37.78125 C 48.277344 32.125 48.675781 25.480469 47.71875 20.9375 L 47.53125 20.15625 L 46.75 20.15625 L 26 20.125 L 25 20.125 L 25 30.53125 L 36.4375 30.53125 C 34.710938 34.53125 31.195313 37.28125 26 37.28125 C 19.210938 37.28125 13.71875 31.789063 13.71875 25 C 13.71875 18.210938 19.210938 12.71875 26 12.71875 C 29.050781 12.71875 31.820313 13.847656 33.96875 15.6875 L 34.6875 16.28125 L 41.53125 9.4375 L 42.25 8.6875 L 41.5 8 C 37.414063 4.277344 31.960938 2 26 2 Z M 26 4 C 31.074219 4 35.652344 5.855469 39.28125 8.84375 L 34.46875 13.65625 C 32.089844 11.878906 29.199219 10.71875 26 10.71875 C 18.128906 10.71875 11.71875 17.128906 11.71875 25 C 11.71875 32.871094 18.128906 39.28125 26 39.28125 C 32.550781 39.28125 37.261719 35.265625 38.9375 29.8125 L 39.34375 28.53125 L 27 28.53125 L 27 22.125 L 45.84375 22.15625 C 46.507813 26.191406 46.066406 31.984375 43.375 36.8125 C 40.515625 41.9375 35.320313 46 26 46 C 14.386719 46 5 36.609375 5 25 C 5 13.390625 14.386719 4 26 4 Z"/></svg>
              Connect Google
            </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
\          Privacy & Security
        </h2>
        <button
          className="px-4 py-2 bg-red-600 text-white rounded"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Deactivate Account
        </button>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">Confirm account deactivation</h3>
              <p className="text-sm text-gray-700 mb-4">Your account will be deactivated and you will be signed out on all devices. You won’t be able to sign in until an admin reactivates your account. Proceed?</p>
              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 bg-gray-200 rounded"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded"
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      // Call backend to deactivate current user (uses ID token via authFetch)
                      const res = await authFetch('/api/users/deactivate', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                      if (!res.ok) throw new Error('Server failed to deactivate account');
                      // sign out from firebase auth if available
                      try { await auth.signOut(); } catch (e) {}
                      // clear local storage keys we used
                      try { localStorage.removeItem('user'); localStorage.removeItem('agapay_users'); } catch (e) {}
                      // redirect to home
                      window.location.href = '/';
                    } catch (e) {
                      console.error('Account deactivation failed', e);
                      setSaveStatus('Account deactivation failed. Please try again later.');
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                >
                  {deleting ? 'Deactivating...' : 'Yes, deactivate account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
