// src/utils/firebaseAuthService.js
// Firebase-native authentication service - NO backend API calls
import { auth, db } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Check if email exists in Firestore users collection
 */
export async function checkEmailExists(email) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', normalizedEmail));
    const snapshot = await getDocs(q);
    return !snapshot.empty; // true if exists
  } catch (err) {
    console.error('Error checking email:', err);
    throw err;
  }
}

/**
 * Create user profile in Firestore
 */
async function createUserProfile(uid, email, firstName, lastName, phone, role = 'user') {
  try {
    const fullName = `${firstName} ${lastName}`.trim();
    const normalizedEmail = email.trim().toLowerCase();
    
    const profileData = {
      authId: uid,
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName,
      username: fullName,
      displayName: fullName,
      phone: phone || '',
      role,
      status: 'Active',
      active: true,
      banned: false,
      createdAt: serverTimestamp(),
    };

    const usersRef = collection(db, 'users');
    const ref = await addDoc(usersRef, profileData);
    return { id: ref.id, ...profileData, authId: uid };
  } catch (err) {
    console.error('Error creating user profile:', err);
    throw err;
  }
}

/**
 * Get user profile from Firestore by email
 */
export async function getUserProfileByEmail(email) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', normalizedEmail));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (err) {
    console.error('Error getting user profile:', err);
    return null;
  }
}

/**
 * Get user profile from Firestore by UID
 */
export async function getUserProfileByUID(uid) {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('authId', '==', uid));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (err) {
    console.error('Error getting user profile by UID:', err);
    return null;
  }
}

/**
 * Check if user is banned
 */
export function isUserBanned(userProfile) {
  if (!userProfile) return false;
  
  const status = String(userProfile.status || '').toLowerCase();
  const isBanned = 
    userProfile.banned === true ||
    status === 'banned' ||
    status.includes('ban') ||
    (userProfile.active === false && status !== 'active');
  
  return isBanned;
}

/**
 * Get ban reason from user profile
 */
export function getBanReason(userProfile) {
  if (!userProfile) return '';
  
  const fields = ['banReason', 'reason', 'ban_reason', 'ban_reason_description', 'description', 'message', 'disabledReason', 'statusMessage', 'note', 'status_reason'];
  for (const field of fields) {
    if (userProfile[field]) return String(userProfile[field]);
  }
  
  if (userProfile.status && String(userProfile.status).toLowerCase().includes('ban')) {
    return String(userProfile.status);
  }
  
  return '';
}

/**
 * Signup with email and password
 */
export async function signupWithEmail(email, password, firstName, lastName, phone) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if email already exists in Firestore
    const emailExists = await checkEmailExists(normalizedEmail);
    if (emailExists) {
      throw new Error('Email already exists');
    }

    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const user = userCredential.user;

    // Determine if admin
    const isAdmin = normalizedEmail === 'admin@agapay.com' || normalizedEmail === 'admin@gmail.com';
    const role = isAdmin ? 'admin' : 'user';

    // Create user profile in Firestore
    const profile = await createUserProfile(user.uid, normalizedEmail, firstName, lastName, phone, role);

    // Update Firebase Auth display name
    await updateProfile(user, { displayName: `${firstName} ${lastName}`.trim() });

    // Send email verification
    try {
      await sendEmailVerification(user);
    } catch (err) {
      console.warn('Email verification send failed:', err);
    }

    return {
      user,
      profile,
      isAdmin,
      emailVerified: user.emailVerified,
    };
  } catch (err) {
    console.error('Signup error:', err);
    throw err;
  }
}

/**
 * Login with email and password
 */
export async function loginWithEmail(email, password) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    const user = userCredential.user;

    // Get user profile from Firestore
    const profile = await getUserProfileByUID(user.uid) || await getUserProfileByEmail(normalizedEmail);
    
    if (!profile) {
      // Profile doesn't exist, create a minimal one
      const newProfile = await createUserProfile(
        user.uid,
        normalizedEmail,
        user.displayName ? user.displayName.split(' ')[0] : 'User',
        user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
        user.phoneNumber || '',
        'user'
      );
      return { user, profile: newProfile, isAdmin: false, emailVerified: user.emailVerified };
    }

    // Check if user is banned
    if (isUserBanned(profile)) {
      await signOut(auth);
      const reason = getBanReason(profile);
      throw new Error(`User is banned${reason ? ': ' + reason : ''}`);
    }

    // Check if admin
    const isAdmin = profile.role === 'admin' || normalizedEmail === 'admin@agapay.com' || normalizedEmail === 'admin@gmail.com';

    return { user, profile, isAdmin, emailVerified: user.emailVerified };
  } catch (err) {
    console.error('Login error:', err);
    throw err;
  }
}

/**
 * Google sign-in (used for both signup and login)
 */
export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user exists in Firestore
    let profile = await getUserProfileByUID(user.uid) || await getUserProfileByEmail(user.email);

    if (!profile) {
      // New user - create profile
      const nameParts = (user.displayName || '').split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const isAdmin = user.email === 'admin@agapay.com' || user.email === 'admin@gmail.com';
      profile = await createUserProfile(
        user.uid,
        user.email,
        firstName,
        lastName,
        user.phoneNumber || '',
        isAdmin ? 'admin' : 'user'
      );
    }

    // Check if user is banned
    if (isUserBanned(profile)) {
      await signOut(auth);
      const reason = getBanReason(profile);
      throw new Error(`User is banned${reason ? ': ' + reason : ''}`);
    }

    // Check if admin
    const isAdmin = profile.role === 'admin' || user.email === 'admin@agapay.com' || user.email === 'admin@gmail.com';

    return { user, profile, isAdmin, emailVerified: user.emailVerified };
  } catch (err) {
    console.error('Google sign-in error:', err);
    throw err;
  }
}

/**
 * Map Firebase error codes to user-friendly messages
 */
export function mapAuthError(err) {
  const code = err?.code ? String(err.code) : '';
  
  switch (code) {
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Try again or reset it.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.';
    case 'auth/popup-blocked':
      return 'Popup blocked by your browser. Allow popups and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was closed before completing.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please log in instead.';
    default:
      return err?.message || 'Authentication failed. Please try again.';
  }
}
