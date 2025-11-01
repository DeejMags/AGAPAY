import { auth } from '../firebase';
import { getIdToken } from 'firebase/auth';

// Robust authenticated fetch with:
// - brief wait for Firebase auth init when user is not yet available
// - single retry on 401 with forced token refresh
// - preserves caller-provided headers and options
export default async function authFetch(url, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};

  async function attachToken(forceRefresh = false) {
    try {
      let user = auth.currentUser;
      // If no user yet, wait briefly for auth to initialize (up to ~2s)
      if (!user) {
        await new Promise(resolve => {
          let done = false;
          const timeout = setTimeout(() => { if (!done) { done = true; resolve(); } }, 2000);
          const unsub = auth.onAuthStateChanged(() => {
            if (!done) { done = true; clearTimeout(timeout); unsub(); resolve(); }
          });
        });
        user = auth.currentUser;
      }
      if (user) {
        const token = await getIdToken(user, forceRefresh);
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('authFetch: failed to obtain ID token', err && err.message);
    }
  }

  await attachToken(false);
  let res = await fetch(url, { ...options, headers });
  if (res && res.status === 401) {
    // Try once with forced token refresh if user exists
    await attachToken(true);
    res = await fetch(url, { ...options, headers });
  }
  return res;
}
