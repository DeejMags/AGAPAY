import { auth } from '../firebase';
import { getIdToken } from 'firebase/auth';

// Construct full API URL with backend port
function getFullUrl(path) {
  // If path already includes protocol/host, use it as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Default to localhost:5000 for API calls
  const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  return `${apiBaseUrl}${path}`;
}

// Robust authenticated fetch with:
// - proper Firebase auth initialization wait (up to 10s)
// - single retry on 401 with forced token refresh
// - preserves caller-provided headers and options
// - proper backend URL construction
export default async function authFetch(url, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const fullUrl = getFullUrl(url);

  async function attachToken(forceRefresh = false) {
    try {
      let user = auth.currentUser;
      
      // If no user yet, wait for auth to initialize (up to 10s)
      // This handles the case where Firebase auth hasn't finished loading yet
      if (!user) {
        console.log('[authFetch] No user yet, waiting for Firebase auth...');
        await new Promise((resolve) => {
          let done = false;
          const timeout = setTimeout(() => {
            if (!done) {
              done = true;
              resolve();
            }
          }, 10000);
          
          const unsub = auth.onAuthStateChanged((authUser) => {
            if (!done) {
              done = true;
              clearTimeout(timeout);
              unsub();
              if (authUser) {
                console.log('[authFetch] Firebase auth ready, user:', authUser.email);
              }
              resolve();
            }
          });
        });
        
        user = auth.currentUser;
      }
      
      if (user) {
        console.log('[authFetch] Getting ID token for user:', user.email);
        const token = await getIdToken(user, forceRefresh);
        console.log('[authFetch] Got token, length:', token.length);
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.warn('[authFetch] No user found after waiting');
      }
    } catch (err) {
      console.warn('[authFetch] Error getting token:', err?.message);
    }
  }

  await attachToken(false);
  let res = await fetch(fullUrl, { ...options, headers });
  if (res && res.status === 401) {
    // Try once with forced token refresh if user exists
    if (auth.currentUser) {
      await attachToken(true);
      res = await fetch(fullUrl, { ...options, headers });
    }
  }
  return res;
}
