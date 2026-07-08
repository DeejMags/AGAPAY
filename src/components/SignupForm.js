import React, { useEffect, useState } from 'react'
import { auth } from '../firebase';
import { signupWithEmail, signInWithGoogle, mapAuthError } from '../utils/firebaseAuthService';

export default function SignupForm({ onSuccess, onFieldDirty }){
  // Google Sign Up handler
  async function handleGoogleSignup(e) {
    e.preventDefault();
    try {
      const { user, profile, isAdmin } = await signInWithGoogle();
      
      // Store profile and auth token
      localStorage.setItem('user', JSON.stringify({
        id: profile.id,
        username: profile.username,
        email: profile.email,
        phone: profile.phone || '',
        profilePic: user.photoURL || '',
        role: profile.role,
      }));
      localStorage.setItem('token', user.uid);
      
      // Redirect admins to admin panel
      if (isAdmin) {
        window.location.replace('/admin');
        return;
      }
      
      if (onSuccess) onSuccess(user);
    } catch (err) {
      setError(mapAuthError(err));
    }
  }
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [confirm,setConfirm] = useState('')
  const [error,setError] = useState('')
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [verificationSent, setVerificationSent] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);


  function validateAll() {
    const errs = {};
    if (!firstName.trim()) errs.firstName = 'First name is required';
    if (!lastName.trim()) errs.lastName = 'Last name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Invalid email';
    else if (email.toLowerCase().includes('spam') || email.toLowerCase().includes('test')) errs.email = 'Please use a valid email address';
  // location removed
    if (!password) errs.password = 'Password is required';
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (password !== confirm) errs.confirm = 'Passwords do not match';
    if (!agreeToTerms) errs.agreeToTerms = 'You must agree to the Terms and Conditions';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e){
    e.preventDefault();
    setError('');
    if (!validateAll()) return;
    try {
      setSubmitting(true);
      const normalizedEmail = email.trim().toLowerCase();
      
      // Call Firebase signup service
      const { user, profile, isAdmin } = await signupWithEmail(
        normalizedEmail,
        password,
        firstName.trim(),
        lastName.trim(),
        ''
      );

      // Store profile and auth token
      localStorage.setItem('user', JSON.stringify({
        id: profile.id,
        username: profile.username,
        email: profile.email,
        phone: profile.phone || '',
        profilePic: user.photoURL || '',
        role: profile.role,
      }));
      localStorage.setItem('token', user.uid);

      // If email not verified yet, show verification flow
      if (!user.emailVerified) {
        setVerificationSent(true);
        setCheckingVerification(true);
        setShowVerificationModal(true);
      } else {
        // Email already verified, redirect
        if (isAdmin) {
          window.location.replace('/admin');
        } else if (onSuccess) {
          onSuccess(user);
        }
      }
      setSubmitting(false);
    } catch (err) {
      console.error('Signup error', err);
      setError(mapAuthError(err));
      setSubmitting(false);
    }
  }

  useEffect(() => {
    let interval;
    async function check() {
      if (!auth.currentUser) return;
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          setCheckingVerification(false);
          try {
            const stored = JSON.parse(localStorage.getItem('user') || 'null');
            if (stored) {
              stored.emailVerified = true;
              localStorage.setItem('user', JSON.stringify(stored));
            }
          } catch {}
          window.location.replace('/');
        } else {
          setPollCount(c => c + 1);
          if (pollCount > 50) setCheckingVerification(false); 
        }
      } catch (e) {
      }
    }
    if (checkingVerification) {
      interval = setInterval(check, 6000);
    }
    return () => interval && clearInterval(interval);
  }, [checkingVerification, pollCount]);

  async function resendVerification() {
    if (!auth.currentUser) return;
    setVerificationError('');
    try {
      const { sendEmailVerification } = await import('firebase/auth');
      await sendEmailVerification(auth.currentUser);
      setVerificationSent(true);
    } catch (e) {
      setVerificationError('Resend failed: ' + (e.message || String(e)));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
  {error && <div className="text-red-600">{error}</div>}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    <div>
      <input value={firstName} onChange={e=>{ setFirstName(e.target.value); onFieldDirty && onFieldDirty(); }} placeholder="First name" className="p-2 border rounded w-full" />
      {fieldErrors.firstName && <div className="text-red-500 text-sm">{fieldErrors.firstName}</div>}
    </div>
    <div>
  <input value={lastName} onChange={e=>{ setLastName(e.target.value); onFieldDirty && onFieldDirty(); }} placeholder="Last name" className="p-2 border rounded w-full" />
      {fieldErrors.lastName && <div className="text-red-500 text-sm">{fieldErrors.lastName}</div>}
    </div>
  </div>
  <input value={email} onChange={e=>{ setEmail(e.target.value); onFieldDirty && onFieldDirty(); }} placeholder="Email" className="p-2 border rounded" />
  {fieldErrors.email && <div className="text-red-500 text-sm">{fieldErrors.email}</div>}
  <input value={password} onChange={e=>{ setPassword(e.target.value); onFieldDirty && onFieldDirty(); }} type="password" placeholder="Password" className="p-2 border rounded" />
  {fieldErrors.password && <div className="text-red-500 text-sm">{fieldErrors.password}</div>}
  <input value={confirm} onChange={e=>{ setConfirm(e.target.value); onFieldDirty && onFieldDirty(); }} type="password" placeholder="Confirm password" className="p-2 border rounded" />
  {fieldErrors.confirm && <div className="text-red-500 text-sm">{fieldErrors.confirm}</div>}
  
  {/* Terms & Conditions Checkbox */}
  <div className="flex items-start gap-2 mt-2">
    <input 
      type="checkbox" 
      id="agreeToTerms" 
      checked={agreeToTerms} 
      onChange={e=>setAgreeToTerms(e.target.checked)} 
      className="mt-1" 
    />
    <label htmlFor="agreeToTerms" className="text-sm flex flex-col gap-1">
      <span>
        I agree to the{' '}
        <button 
          type="button" 
          onClick={() => setShowTermsModal(true)} 
          className="text-teal-600 underline hover:text-teal-700"
        >
          Terms and Conditions
        </button>
      </span>
      {fieldErrors.agreeToTerms && <div className="text-red-500 text-xs">{fieldErrors.agreeToTerms}</div>}
    </label>
  </div>

      <button className="p-2 bg-teal-600 text-white rounded" disabled={submitting}>{submitting ? 'Creating...' : 'Create account'}</button>
      <button type="button" className="p-2 bg-red-500 text-white rounded mt-2" onClick={handleGoogleSignup}>
        Sign Up with Google
      </button>
      {verificationSent && !showVerificationModal && !auth.currentUser?.emailVerified && (
        <div className="mt-4 p-3 border rounded bg-yellow-50 text-sm text-gray-700">
          <div className="font-medium mb-1">Verify your email</div>
          <p>We sent a verification link to <strong>{email}</strong>. Please click it, then return here; you'll be redirected automatically.</p>
          {checkingVerification ? (
            <p className="mt-2 text-xs text-gray-500">Waiting for verification... (polling)</p>
          ) : (
            <button type="button" onClick={()=> setCheckingVerification(true)} className="mt-2 text-xs underline text-teal-700">Start checking</button>
          )}
          <button type="button" onClick={resendVerification} className="mt-2 text-xs underline text-teal-700">Resend email</button>
          {verificationError && <div className="mt-2 text-xs text-red-600">{verificationError}</div>}
        </div>
      )}

      {showVerificationModal && verificationSent && !auth.currentUser?.emailVerified && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowVerificationModal(false)}
          />
          <div className="relative z-10 mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Check your email</h3>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                onClick={() => setShowVerificationModal(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-700">
              We sent a verification link to <span className="font-medium">{email}</span>.
              Please open your inbox and click the link to activate your account.
            </p>
            {verificationError && (
              <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {verificationError}
              </div>
            )}
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href="https://mail.google.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex justify-center rounded bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Open Gmail
              </a>
              <button
                type="button"
                onClick={resendVerification}
                className="inline-flex justify-center rounded bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                Resend email
              </button>
              <button
                type="button"
                onClick={() => setCheckingVerification(true)}
                className="inline-flex justify-center rounded border border-teal-600 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 sm:col-span-2"
              >
                I've verified — Check now
              </button>
            </div>
            {checkingVerification && (
              <p className="mt-3 text-xs text-gray-500">Waiting for verification... we'll redirect you automatically.</p>
            )}
          </div>
        </div>
      )}

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowTermsModal(false)}
          />
          <div className="relative z-10 mx-4 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Terms and Conditions</h3>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                onClick={() => setShowTermsModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 text-sm text-gray-700">
              <section>
                <h4 className="font-semibold mb-2">1. Prices and Valuation</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Prices displayed are estimates only based on the submitted weight and material type.</li>
                  <li>Final valuation is based on actual inspection and weighing of recyclable materials by Imson Junkshop.</li>
                  <li>The condition, quality, and market price of materials may affect the final value.</li>
                </ul>
              </section>
              
              <section>
                <h4 className="font-semibold mb-2">2. Transportation Fees</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Transportation fees may apply for pickup requests depending on location and quantity.</li>
                  <li>Fees will be deducted from the estimated earnings before payment.</li>
                  <li>Users will be informed of transportation fees before confirming submission.</li>
                </ul>
              </section>

              <section>
                <h4 className="font-semibold mb-2">3. Material Acceptance</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Imson Junkshop reserves the right to reject unacceptable materials including:</li>
                  <li className="ml-4">Hazardous chemicals, medical waste, explosives, leaking batteries, flammable materials, and contaminated waste.</li>
                  <li>Users are responsible for providing accurate information about submitted recyclables.</li>
                </ul>
              </section>

              <section>
                <h4 className="font-semibold mb-2">4. Pickup and Delivery</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Users must provide accurate pickup address, date, and time for pickup requests.</li>
                  <li>Imson Junkshop will make reasonable efforts to honor scheduled pickups.</li>
                  <li>Users may also choose to deliver materials directly to the junkshop.</li>
                </ul>
              </section>

              <section>
                <h4 className="font-semibold mb-2">5. Gamification and Rewards</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Points are earned based on the weight of recyclables submitted (10 kg = 1 point).</li>
                  <li>Badges and levels are unlocked as users accumulate points.</li>
                  <li>Rewards may be redeemable or used for future transactions as determined by Imson Junkshop.</li>
                </ul>
              </section>

              <section>
                <h4 className="font-semibold mb-2">6. Accuracy of Information</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Users must provide accurate and honest information about recyclable materials.</li>
                  <li>Misrepresentation of materials may result in rejection or account suspension.</li>
                </ul>
              </section>

              <section>
                <h4 className="font-semibold mb-2">7. Payment Terms</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Payment will be made after final inspection and valuation by Imson Junkshop.</li>
                  <li>Payment method and timing will be communicated separately.</li>
                </ul>
              </section>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAgreeToTerms(true);
                  setShowTermsModal(false);
                }}
                className="flex-1 rounded bg-teal-600 px-4 py-2 text-white hover:bg-teal-700"
              >
                I Agree
              </button>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="flex-1 rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}