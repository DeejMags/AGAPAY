import { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from '../firebase';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';

export default function DropOffManagement({ onLoadDropoffs }) {
  const [dropoffs, setDropoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [filteredDropoffs, setFilteredDropoffs] = useState([]);
  const [selectedDropoff, setSelectedDropoff] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dropoffTime, setDropoffTime] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [sellerProfiles, setSellerProfiles] = useState({});
  const unsubDropoffsRef = useRef(null);

  // Attach / re-attach real-time Firestore listener for all drop-offs
  const subscribeDropoffs = useCallback(() => {
    if (unsubDropoffsRef.current) {
      unsubDropoffsRef.current();
      unsubDropoffsRef.current = null;
    }
    setIsRefreshing(true);
    const q = collection(db, 'dropoffs');
    unsubDropoffsRef.current = onSnapshot(
      q,
      snap => {
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt?.toDate?.()?.getTime?.() || 0;
            const tb = b.createdAt?.toDate?.()?.getTime?.() || 0;
            return tb - ta;
          });
        setDropoffs(items);
        setLoading(false);
        setIsRefreshing(false);
      },
      err => {
        console.warn('dropoffs listener error:', err.message);
        setLoading(false);
        setIsRefreshing(false);
      }
    );
  }, []);

  // Start listener on mount; clean up on unmount
  useEffect(() => {
    subscribeDropoffs();
    return () => {
      if (unsubDropoffsRef.current) unsubDropoffsRef.current();
    };
  }, [subscribeDropoffs]);

  // Fetch seller profiles including profile pictures with real-time updates
  useEffect(() => {
    const unsubscribers = [];
    const profiles = {};

    // Set up real-time listeners for each seller
    // Users sign up with auto-generated Firestore IDs; their profile has authId == sellerId
    const setupListeners = async () => {
      for (const dropoff of dropoffs) {
        if (dropoff.sellerId && !profiles[dropoff.sellerId]) {
          profiles[dropoff.sellerId] = true; // mark as being tracked
          try {
            // Primary: query by authId to find the actual profile document
            const profileQuery = query(
              collection(db, 'users'),
              where('authId', '==', dropoff.sellerId)
            );
            const unsubscribeQuery = onSnapshot(profileQuery, (snapshot) => {
              if (!snapshot.empty) {
                setSellerProfiles(prev => ({
                  ...prev,
                  [dropoff.sellerId]: snapshot.docs[0].data()
                }));
              } else {
                // Fallback: direct doc by UID (for users created by authMiddleware)
                const userRef = doc(db, 'users', dropoff.sellerId);
                const unsubscribeDirect = onSnapshot(userRef, (userSnap) => {
                  if (userSnap.exists()) {
                    setSellerProfiles(prev => ({
                      ...prev,
                      [dropoff.sellerId]: userSnap.data()
                    }));
                  }
                });
                unsubscribers.push(unsubscribeDirect);
              }
            }, (err) => {
              console.warn('Error listening to seller profile:', err);
            });
            unsubscribers.push(unsubscribeQuery);
          } catch (err) {
            console.warn('Error setting up seller profile listener:', err);
          }
        }
      }
    };

    if (dropoffs.length > 0) {
      setupListeners();
    }

    // Cleanup: unsubscribe from all listeners when component unmounts or dropoffs change
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [dropoffs]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredDropoffs(dropoffs);
    } else {
      setFilteredDropoffs(dropoffs.filter(d => d.status === statusFilter));
    }
  }, [statusFilter, dropoffs]);

  const handleApprove = async () => {
    if (!selectedDropoff) return;
    if (!dropoffTime) {
      alert('Please enter a drop-off time');
      return;
    }

    setIsProcessing(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(
        `/api/products/dropoff/${selectedDropoff.id}/approve`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            dropoffTime,
            adminNotes,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to approve drop-off');

      // Show success modal
      setSuccessMessage(`✅ APPROVED\n\nThe drop-off appointment for "${selectedDropoff.productTitle}"\n\n📅 Date: ${selectedDropoff.dropoffDate}\n⏰ Time: ${dropoffTime}\n\n📧 Notification sent to ${selectedDropoff.sellerEmail}\n\nThe seller will receive:\n✓ Email with appointment details\n✓ In-app notification with appointment time\n${adminNotes ? '✓ Admin notes: ' + adminNotes : ''}\n\nSeller must arrive on time for drop-off.`);
      setShowSuccessModal(true);
      
      // Reset form
      setActionType(null);
      setSelectedDropoff(null);
      setDropoffTime('');
      setAdminNotes('');
    } catch (err) {
      console.error('Error approving drop-off:', err);
      alert('Error: ' + (err.message || 'Failed to approve'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedDropoff) return;
    setIsProcessing(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(
        `/api/products/dropoff/${selectedDropoff.id}/complete`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ adminNotes }),
        }
      );
      if (!response.ok) throw new Error('Failed to complete drop-off');
      const result = await response.json();
      const pts = result.sellerPoints || 0;
      const alreadyAwarded = result.alreadyAwarded || false;
      const pointsLine = pts > 0 && !alreadyAwarded
        ? `\n\n🎉 Seller awarded +${pts} points for this drop-off.`
        : pts > 0 && alreadyAwarded
          ? '\n\n(Points were already awarded for this drop-off.)'
          : '';
      setSuccessMessage(`🏁 COMPLETED\n\nDrop-off for "${selectedDropoff.productTitle}" has been marked as completed.\n\nThe item has been marked as SOLD.${pointsLine}${adminNotes ? '\n\nAdmin Notes: ' + adminNotes : ''}`);
      setShowSuccessModal(true);
      setActionType(null);
      setSelectedDropoff(null);
      setAdminNotes('');
    } catch (err) {
      console.error('Error completing drop-off:', err);
      alert('Error: ' + (err.message || 'Failed to complete'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedDropoff) return;

    setIsProcessing(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(
        `/api/products/dropoff/${selectedDropoff.id}/decline`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason: declineReason,
            adminNotes,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to decline drop-off');

      // Show success modal
      setSuccessMessage(`❌ DECLINED\n\nThe drop-off appointment for "${selectedDropoff.productTitle}" has been declined.\n\n📧 Notification sent to ${selectedDropoff.sellerEmail}\n\nThe seller will receive:\n✓ Email with decline reason\n✓ In-app notification with details\n✓ Admin notes (if provided)\n\nDecline Reason: ${declineReason || 'Not specified'}\n${adminNotes ? '\nAdmin Notes: ' + adminNotes : ''}\n\n📦 Item automatically moved to Archive tab`);
      setShowSuccessModal(true);
      
      // Reset form
      setActionType(null);
      setSelectedDropoff(null);
      setDeclineReason('');
      setAdminNotes('');
    } catch (err) {
      console.error('Error declining drop-off:', err);
      alert('Error: ' + (err.message || 'Failed to decline'));
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-500',
      approved: 'bg-green-500',
      declined: 'bg-red-500',
      completed: 'bg-blue-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Drop-Off Management</h1>
        <button
          onClick={subscribeDropoffs}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-60 text-sm font-medium"
        >
          <svg
            className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'approved', 'declined', 'completed'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded font-medium transition ${
                statusFilter === status
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading drop-offs...</div>
      ) : filteredDropoffs.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No drop-offs found</div>
      ) : (
        <div className="space-y-4">
          {filteredDropoffs.map((dropoff) => (
            <div key={dropoff.id} className="bg-white rounded-lg border border-gray-200 shadow hover:shadow-lg transition overflow-hidden">
              <div className="flex flex-col md:flex-row gap-4 p-4">
                {/* Product Image - Left */}
                <div className="relative flex-shrink-0 w-full md:w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {dropoff.productImage ? (
                    <img
                      src={dropoff.productImage}
                      alt="product"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 text-center">
                      <div className="text-3xl">📦</div>
                    </div>
                  )}
                  {/* SOLD overlay for completed drop-offs */}
                  {dropoff.status === 'completed' && (
                    <div className="absolute inset-0 bg-blue-600 bg-opacity-75 flex items-center justify-center rounded-lg">
                      <span className="text-white font-bold text-lg tracking-wide">SOLD</span>
                    </div>
                  )}
                </div>

                {/* Product Details - Middle */}
                <div className="flex-1 min-w-0">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold truncate">{dropoff.productTitle || 'Unknown Product'}</h3>
                  </div>

                  {/* Description and Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex gap-2 flex-wrap">
                      <span className="inline-block px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs font-medium">
                        Drop Off 🏪
                      </span>
                      {dropoff.delivery && (
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          Delivery
                        </span>
                      )}
                      {dropoff.pickup && (
                        <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          Pickup
                        </span>
                      )}
                    </div>
                    {dropoff.notes && (
                      <p className="text-sm text-gray-600">{dropoff.notes}</p>
                    )}
                  </div>

                  {/* Date and Time */}
                  <div className="flex gap-4 items-center mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium">Date:</span>
                      <span className="inline-block px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-semibold">
                        {dropoff.dropoffDate ? new Date(dropoff.dropoffDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'short' }) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium">Time:</span>
                      <span className="inline-block px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-semibold">
                        {dropoff.dropoffTime || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(dropoff.status)}`}>
                      {dropoff.status.charAt(0).toUpperCase() + dropoff.status.slice(1)}
                    </span>
                    {dropoff.status === 'completed' && (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
                        🏁 Item Received &amp; Sold
                      </span>
                    )}
                    {dropoff.status === 'approved' && dropoff.adminNotes && (
                      <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                        Admin notes: {dropoff.adminNotes}
                      </span>
                    )}
                    {dropoff.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedDropoff(dropoff);
                            setActionType('approve');
                            setDropoffTime(dropoff.dropoffTime || '');
                          }}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDropoff(dropoff);
                            setActionType('decline');
                          }}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                    {dropoff.status === 'approved' && (
                      <button
                        onClick={() => { setSelectedDropoff(dropoff); setActionType('complete'); setAdminNotes(''); }}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition"
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>

                {/* Seller Info - Right */}
                <div className="flex-shrink-0 w-full md:w-56 bg-gradient-to-br from-blue-50 to-teal-50 rounded-lg p-4 flex flex-col items-center justify-start border border-blue-200">
                  {/* Profile Picture */}
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center mb-3 text-2xl font-bold text-white overflow-hidden border-2 border-white shadow-md">
                    {(sellerProfiles[dropoff.sellerId]?.photoURL || sellerProfiles[dropoff.sellerId]?.profilePic || dropoff.sellerProfilePic) ? (
                      <img 
                        src={sellerProfiles[dropoff.sellerId]?.photoURL || sellerProfiles[dropoff.sellerId]?.profilePic || dropoff.sellerProfilePic} 
                        alt={dropoff.sellerName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-2xl">
                        {(sellerProfiles[dropoff.sellerId]?.displayName || sellerProfiles[dropoff.sellerId]?.name || sellerProfiles[dropoff.sellerId]?.username || dropoff.sellerDisplayName || dropoff.sellerName || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Seller Name */}
                  <div className="text-center w-full">
                    <p className="font-bold text-sm text-gray-900 truncate max-w-xs mx-auto">
                      {sellerProfiles[dropoff.sellerId]?.displayName || sellerProfiles[dropoff.sellerId]?.name || sellerProfiles[dropoff.sellerId]?.username || dropoff.sellerDisplayName || dropoff.sellerName || 'Unknown'}
                    </p>
                    <p className="text-xs text-blue-600 font-semibold mt-1">Seller</p>
                    
                    {/* Location */}
                    <p className={`text-xs font-medium mt-2 px-2 py-1 rounded-full inline-block mx-auto ${
                      (sellerProfiles[dropoff.sellerId]?.location || dropoff.location) 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      📍 {sellerProfiles[dropoff.sellerId]?.location || dropoff.location || 'Location not set'}
                    </p>                    
                    {/* Contact Info */}
                    {dropoff.sellerPhone && (
                      <div className="mt-3 border-t border-blue-200 pt-2 w-full">
                        <p className="text-xs text-gray-600 font-mono hover:text-gray-900 cursor-pointer truncate max-w-xs mx-auto">
                          📱 {dropoff.sellerPhone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Complete Modal */}
      {actionType === 'complete' && selectedDropoff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-2">Mark Drop-Off as Completed</h2>
            <p className="text-sm text-gray-600 mb-4">
              Confirm that <strong>{sellerProfiles[selectedDropoff.sellerId]?.displayName || selectedDropoff.sellerName}</strong> has physically arrived and dropped off <strong>&quot;{selectedDropoff.productTitle}&quot;</strong>.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Admin Notes (optional)</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full border rounded p-2"
                  rows="2"
                  placeholder="e.g. Item received in good condition"
                  disabled={isProcessing}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setActionType(null); setSelectedDropoff(null); setAdminNotes(''); }}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleComplete}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Mark as Completed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {actionType === 'approve' && selectedDropoff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Approve Drop-Off Appointment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Drop-off Time</label>
                <input
                  type="time"
                  value={dropoffTime}
                  onChange={(e) => setDropoffTime(e.target.value)}
                  className="w-full border rounded p-2"
                  disabled={isProcessing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Admin Notes (optional)</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full border rounded p-2"
                  rows="3"
                  disabled={isProcessing}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setActionType(null);
                    setSelectedDropoff(null);
                    setDropoffTime('');
                    setAdminNotes('');
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  disabled={isProcessing || !dropoffTime}
                >
                  {isProcessing ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {actionType === 'decline' && selectedDropoff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Decline Drop-Off Appointment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Reason for Decline</label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full border rounded p-2"
                  rows="3"
                  placeholder="Enter reason for declining..."
                  disabled={isProcessing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Admin Notes (optional)</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full border rounded p-2"
                  rows="2"
                  disabled={isProcessing}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setActionType(null);
                    setSelectedDropoff(null);
                    setDeclineReason('');
                    setAdminNotes('');
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecline}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Decline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-auto">
            <div className="text-center">
              <div className="mb-4">
                {successMessage.includes('COMPLETED') ? (
                  <div className="text-5xl mb-3">🏁</div>
                ) : successMessage.includes('APPROVED') ? (
                  <div className="text-5xl mb-3">✅</div>
                ) : (
                  <div className="text-5xl mb-3">❌</div>
                )}
              </div>
              <h2 className="text-xl font-bold mb-4">
                {successMessage.includes('COMPLETED') ? 'Drop-Off Completed' : successMessage.includes('APPROVED') ? 'Appointment Approved' : 'Appointment Declined'}
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-line mb-6 leading-relaxed">
                {successMessage}
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
