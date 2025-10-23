import { auth } from '../firebase';
import { getIdToken } from 'firebase/auth';

export default async function authFetch(url, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await getIdToken(user, false);
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('authFetch: failed to obtain ID token', err);
  }
  return fetch(url, { ...options, headers });
}
