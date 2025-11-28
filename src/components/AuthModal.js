import React, { useRef, useState } from 'react'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'
import Toast from './Toast'

export default function AuthModal({ open, type='login', onClose }){
  const [showAbortToast, setShowAbortToast] = useState(false);
  const [dirty, setDirty] = useState(false); // tracks if signup fields touched
  const [aborted, setAborted] = useState(false); // once aborted, disable further interaction
  const backdropRef = useRef(null);

  if(!open) return null

  function success(){
    // On successful auth, close modal and stay on current route unless signup.
    if(onClose) onClose()
    // For signup success we let SignupForm handle redirect (admin or landing) via its own logic.
  }

  // Intercept outside clicks: if signup form is dirty (fields typed, not completed), warn
  function initiateAbort() {
    if (aborted) return;
    setAborted(true);
    setShowAbortToast(true);
    try { sessionStorage.setItem('agapay_last_signup_abort', Date.now().toString()); } catch {}
    // Remove any tentative user/session artifacts to ensure user is NOT treated as signed up.
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
    } catch {}
    // Best-effort sign out of Firebase (in case Google popup created an auth session before abort)
    try {
      import('../firebase').then(mod => {
        if (mod.auth && mod.auth.signOut) mod.auth.signOut().catch(()=>{});
      }).catch(()=>{});
    } catch {}
    // Redirect after short delay so user sees message briefly
    setTimeout(() => {
      if (onClose) onClose();
      window.location.replace('/');
    }, 900);
  }

  function handleBackdropClick(e){
    if (e.target !== backdropRef.current) return; // ensure direct backdrop click
    if (type === 'signup' && dirty) {
      initiateAbort();
      return;
    }
    if(onClose) onClose();
    // For any signup modal close (even if not dirty) send user back to landing.
    if (type === 'signup') {
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('admin');
      } catch {}
      try {
        import('../firebase').then(mod => {
          if (mod.auth && mod.auth.signOut) mod.auth.signOut().catch(()=>{});
        }).catch(()=>{});
      } catch {}
      window.location.replace('/');
    }
  }

  // Prop drill a hook setter to SignupForm so it can mark dirty when fields change
  const signupEl = type==='signup'
    ? <SignupForm onSuccess={success} onFieldDirty={() => { if(!dirty) setDirty(true); }} />
    : <LoginForm onSuccess={success} />;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div ref={backdropRef} className="absolute inset-0 bg-black opacity-40" onClick={handleBackdropClick} />
      <div className="relative bg-white rounded-lg p-6 w-full max-w-md shadow-lg animate-fade-in">
        <button className="absolute top-3 right-3 text-gray-600" onClick={() => {
          if(type==='signup' && dirty){
            initiateAbort();
          } else {
            if(onClose) onClose();
            if(type==='signup') {
              try {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                localStorage.removeItem('admin');
              } catch {}
              try {
                import('../firebase').then(mod => {
                  if (mod.auth && mod.auth.signOut) mod.auth.signOut().catch(()=>{});
                }).catch(()=>{});
              } catch {}
              window.location.replace('/');
            }
          }
        }}>
          ✕
        </button>
        <h2 className="text-xl font-semibold mb-4">{type==='login' ? 'Login' : 'Sign up'}</h2>
        {/* Disable form contents if aborted */}
        <div className={aborted ? 'pointer-events-none opacity-50 select-none' : ''}>
          {signupEl}
        </div>
        {type==='signup' && dirty && !aborted && (
          <p className="mt-3 text-xs text-gray-500">Click outside to cancel signup and return to landing.</p>
        )}
      </div>
    </div>
    <Toast
      open={showAbortToast}
      variant="error"
      title="Signup canceled"
      message="Redirecting to landing page..."
      duration={1200}
      onClose={() => setShowAbortToast(false)}
      position="top-center"
    />
    </>
  )
}
