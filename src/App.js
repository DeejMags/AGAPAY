import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { auth, db } from './firebase'
import { doc, onSnapshot, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Marketplace from './pages/Marketplace'
import ProductDetail from './pages/ProductDetail'
import Profile from './pages/Profile'
import Messages from './pages/Messages'
import Login from './pages/Login'
import Signup from './pages/Signup'
import NotFound from './pages/NotFound'
import UploadProduct from './pages/UploadProduct'
import ProtectedRoute from './components/ProtectedRoute'
import Footer from './components/Footer'
import AdminDashboard from './admin/AdminDashboard'
import SellerDashboard from './pages/SellerDashboard'
import Listings from './pages/Listings'
import UserSettings from './pages/UserSettings'
import Community from './seller/Community'

function App(){
  const [authReady, setAuthReady] = useState(false);
  const [userBanStatus, setUserBanStatus] = useState(null);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [bannedUserId, setBannedUserId] = useState(null);

  useEffect(() => {
    let unsubBan = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      // Signal that Firebase auth is ready (whether user is logged in or not)
      setAuthReady(true);
      // Clean up any previous Firestore listener
      if (unsubBan) { unsubBan(); unsubBan = null; }

      if (user) {
        // Real-time listener: fires immediately on login AND whenever the doc changes
        // (e.g. admin bans an already-logged-in user)
        unsubBan = onSnapshot(
          doc(db, 'users', user.uid),
          async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            if (data.banned || data.status === 'banned') {
              setBannedUserId(user.uid);
              setUserBanStatus(data);
              setShowBanModal(true);
              setAppealSubmitted(false);
              setShowAppealForm(false);
              // Force sign-out so protected routes redirect away
              try { await auth.signOut(); } catch (_) {}
            }
          },
          (err) => { console.warn('Ban status listener error:', err.message); }
        );
      }
    });

    return () => {
      unsubAuth();
      if (unsubBan) unsubBan();
    };
  }, []);

  async function submitAppeal() {
    if (!appealReason.trim() || !bannedUserId) return;
    setAppealSubmitting(true);
    try {
      await addDoc(collection(db, 'ban_appeals'), {
        userId: bannedUserId,
        userName: userBanStatus?.name || userBanStatus?.username || userBanStatus?.displayName || userBanStatus?.email || bannedUserId,
        userEmail: userBanStatus?.email || '',
        banReason: userBanStatus?.banReason || '',
        reason: appealReason.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setAppealSubmitted(true);
      setShowAppealForm(false);
      setAppealReason('');
    } catch (e) {
      console.error('Failed to submit appeal:', e);
      alert('Failed to submit appeal. Please try again.');
    } finally {
      setAppealSubmitting(false);
    }
  }
  
  return (
    <>
      {showBanModal && userBanStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full text-center">
            <div className="text-5xl mb-3">⛔</div>
            <h2 className="text-2xl font-bold text-red-600 mb-1">Account Banned</h2>
            <p className="text-gray-500 text-sm mb-4">Your account has been suspended from Agapay.</p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-left">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Reason</p>
              <p className="text-gray-700">{userBanStatus.banReason || 'Violation of community guidelines'}</p>
            </div>

            {appealSubmitted ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-left">
                <p className="text-green-700 font-semibold">&#10003; Appeal Submitted</p>
                <p className="text-green-600 text-sm mt-1">Your appeal has been received. The admin will review it shortly.</p>
              </div>
            ) : showAppealForm ? (
              <div className="text-left mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Explain why you believe this ban is a mistake:</label>
                <textarea
                  value={appealReason}
                  onChange={e => setAppealReason(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                  placeholder="Describe your situation..."
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={submitAppeal}
                    disabled={appealSubmitting || !appealReason.trim()}
                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
                  >
                    {appealSubmitting ? 'Submitting...' : 'Submit Appeal'}
                  </button>
                  <button
                    onClick={() => setShowAppealForm(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAppealForm(true)}
                className="w-full px-4 py-2 mb-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium"
              >
                📝 Request Appeal
              </button>
            )}

            <button
              onClick={() => { setShowBanModal(false); window.location.href = '/'; }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
            >
              Return to Home
            </button>
          </div>
        </div>
      )}
      
      {/* Don't render routes until Firebase auth is ready to prevent race conditions */}
      {!authReady ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      ) : (
      <BrowserRouter>
        <Navbar />
        <div className="min-h-screen flex flex-col">
          <div className="flex-1 w-full px-3 sm:px-4">
            <Routes>
              <Route path="/" element={<Landing/>} />
              <Route path="/marketplace" element={<Marketplace/>} />
              <Route path="/product/:id" element={<ProductDetail/>} />
              <Route path="/profile" element={<ProtectedRoute><Profile/></ProtectedRoute>} />
              <Route path="/profile/:id" element={<Profile/>} />
              <Route path="/messages" element={<ProtectedRoute><Messages/></ProtectedRoute>} />
              <Route path="/upload" element={<ProtectedRoute><UploadProduct/></ProtectedRoute>} />
              <Route path="/login" element={<Login/>} />
              <Route path="/signup" element={<Signup/>} />
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard/></ProtectedRoute>} />
              <Route path="/listings" element={<ProtectedRoute><Listings/></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><SellerDashboard/></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><UserSettings/></ProtectedRoute>} />
              <Route path="/community" element={<ProtectedRoute><Community/></ProtectedRoute>} />
              <Route path="*" element={<NotFound/>} />
            </Routes>
          </div>
          <Footer />
        </div>
      </BrowserRouter>
      )}
    </>
  )
}

export default App;
