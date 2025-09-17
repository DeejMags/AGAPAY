import React, { useState } from 'react';
// import { UserIcon, LockClosedIcon, CogIcon, MoonIcon, SunIcon, BellIcon, MailIcon, TrashIcon, LogoutIcon } from '@heroicons/react/24/outline';

export default function UserSettings() {
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [siteNotif, setSiteNotif] = useState(true);
  // Add phone and location to initial state, ready for pre-filled values
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    profilePic: null
  });
  const [saveStatus, setSaveStatus] = useState('');

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
              <img
                src={profile.profilePic || '/assets/AGAPAY logo.png'}
                alt="Profile"
                className="w-32 h-32 object-cover rounded-full border shadow"
              />
              {/* Edit Pencil Button */}
              <button
                type="button"
                className="absolute bottom-2 right-2 bg-white rounded-full p-2 shadow hover:bg-gray-100 transition"
                aria-label="Edit profile picture"
                onClick={() => document.getElementById('profilePicInput').click()}
              >
                {/* New Pencil SVG (user-provided) */}
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#3FD2A6"><path d="M180-180h44l472-471-44-44-472 471v44Zm-60 60v-128l575-574q8-8 19-12.5t23-4.5q11 0 22 4.5t20 12.5l44 44q9 9 13 20t4 22q0 11-4.5 22.5T823-694L248-120H120Zm659-617-41-41 41 41Zm-105 64-22-22 44 44-22-22Z"/></svg>
              </button>
              {/* Hidden file input for profile picture upload */}
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
          <input
            type="text"
            placeholder="Name*"
            value={profile.name}
            onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
            className="border rounded p-2"
            required
          />
          <input
            type="email"
            placeholder="Email*"
            value={profile.email}
            onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
            className="border rounded p-2"
            required
          />
          <input
            type="tel"
            placeholder="Phone Number*"
            value={profile.phone}
            onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
            className="border rounded p-2"
            required
          />
          <input
            type="text"
            placeholder="Location*"
            value={profile.location}
            onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
            className="border rounded p-2"
            required
          />
          <button
            type="button"
            className="px-4 py-2 bg-teal-600 text-white rounded"
            onClick={() => {
              // Validate required fields
              if (!profile.name || !profile.email || !profile.phone || !profile.location) {
                setSaveStatus('Please fill in all required fields.');
                setTimeout(() => setSaveStatus(''), 2000);
                return;
              }
              setSaveStatus('Saving...');
              try {
                // Update user in localStorage
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                const updatedUser = { ...currentUser, ...profile };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                // Also update in agapay_users if exists
                const users = JSON.parse(localStorage.getItem('agapay_users') || '[]');
                const idx = users.findIndex(u => u.id === updatedUser.id);
                if (idx >= 0) {
                  users[idx] = { ...users[idx], ...profile };
                  localStorage.setItem('agapay_users', JSON.stringify(users));
                }
                setProfile({ ...profile }); // keep values persistent
                setSaveStatus('Profile saved successfully!');
                setTimeout(() => setSaveStatus(''), 2000);
              } catch (e) {
                setSaveStatus('Error saving profile!');
                setTimeout(() => setSaveStatus(''), 2000);
              }
            }}
            disabled={!profile.name || !profile.email || !profile.phone || !profile.location}
          >
            Save Changes
          </button>
          {saveStatus && (
            <div className={`mt-2 text-sm ${saveStatus.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>{saveStatus}</div>
          )}
        </form>
        <button type="button" className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded">Change Password</button>
        <div className="mt-4 flex gap-4">
            <button type="button" className="px-4 py-2 bg-teal-600 text-white rounded flex items-center gap-2">
              {/* Google icon (SVG, user-provided medium style) */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="22" height="22"><path d="M 26 2 C 13.308594 2 3 12.308594 3 25 C 3 37.691406 13.308594 48 26 48 C 35.917969 48 41.972656 43.4375 45.125 37.78125 C 48.277344 32.125 48.675781 25.480469 47.71875 20.9375 L 47.53125 20.15625 L 46.75 20.15625 L 26 20.125 L 25 20.125 L 25 30.53125 L 36.4375 30.53125 C 34.710938 34.53125 31.195313 37.28125 26 37.28125 C 19.210938 37.28125 13.71875 31.789063 13.71875 25 C 13.71875 18.210938 19.210938 12.71875 26 12.71875 C 29.050781 12.71875 31.820313 13.847656 33.96875 15.6875 L 34.6875 16.28125 L 41.53125 9.4375 L 42.25 8.6875 L 41.5 8 C 37.414063 4.277344 31.960938 2 26 2 Z M 26 4 C 31.074219 4 35.652344 5.855469 39.28125 8.84375 L 34.46875 13.65625 C 32.089844 11.878906 29.199219 10.71875 26 10.71875 C 18.128906 10.71875 11.71875 17.128906 11.71875 25 C 11.71875 32.871094 18.128906 39.28125 26 39.28125 C 32.550781 39.28125 37.261719 35.265625 38.9375 29.8125 L 39.34375 28.53125 L 27 28.53125 L 27 22.125 L 45.84375 22.15625 C 46.507813 26.191406 46.066406 31.984375 43.375 36.8125 C 40.515625 41.9375 35.320313 46 26 46 C 14.386719 46 5 36.609375 5 25 C 5 13.390625 14.386719 4 26 4 Z"/></svg>
              Connect Google
            </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {/* <LockClosedIcon className="w-6 h-6 text-teal-500" /> */}
          Privacy & Security
        </h2>
        <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded mb-4">Logout from all devices</button>
        <button className="px-4 py-2 bg-red-600 text-white rounded">Delete/Deactivate Account</button>
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {/* <MoonIcon className="w-6 h-6 text-teal-500" /> */}
          App Preferences
        </h2>
        <div className="flex items-center gap-4 mb-4">
          <span>Dark Mode</span>
          <button type="button" onClick={()=>setDarkMode(v=>!v)} className={`w-12 h-6 rounded-full border flex items-center ${darkMode ? 'bg-teal-600' : 'bg-gray-200'}`}>
            <span className={`w-5 h-5 rounded-full bg-white shadow transition-all ${darkMode ? 'translate-x-6' : ''}`}></span>
          </button>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <span>Email Notifications</span>
          <button type="button" onClick={()=>setEmailNotif(v=>!v)} className={`w-12 h-6 rounded-full border flex items-center ${emailNotif ? 'bg-teal-600' : 'bg-gray-200'}`}>
            <span className={`w-5 h-5 rounded-full bg-white shadow transition-all ${emailNotif ? 'translate-x-6' : ''}`}></span>
          </button>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <span>In-site Notifications</span>
          <button type="button" onClick={()=>setSiteNotif(v=>!v)} className={`w-12 h-6 rounded-full border flex items-center ${siteNotif ? 'bg-teal-600' : 'bg-gray-200'}`}>
            <span className={`w-5 h-5 rounded-full bg-white shadow transition-all ${siteNotif ? 'translate-x-6' : ''}`}></span>
          </button>
        </div>
      </div>
    </div>
  );
}
