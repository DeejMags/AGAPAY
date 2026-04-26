// Firebase product service for React + Firebase v9 modular SDK
import { db, storage, auth } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import authFetch from './utils/authFetch';

// Create an order document (user purchase/intent)
export async function createOrder(orderData) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const docRef = await addDoc(collection(db, 'orders'), {
      productId: orderData.productId || null,
      productTitle: orderData.productTitle || null,
      sellerId: orderData.sellerId || null,
      buyerId: orderData.buyerId || user.uid,
      buyerName: orderData.buyerName || (user.displayName || user.email || ''),
      type: orderData.type || 'delivery', // 'delivery' or 'pickup'
      status: orderData.status || 'Pending',
      createdAt: serverTimestamp(),
      meta: orderData.meta || null
    });
    // Notify admin via in-app notifications collection so admins see it in the bell
    try {
      await addDoc(collection(db, 'notifications'), {
        forAdmin: true,
        message: `New ${orderData.type || 'delivery'} request for ${(orderData.productTitle || 'an item')}`,
        title: `Order request: ${(orderData.productTitle || '').slice(0, 80)}`,
        productId: orderData.productId || null,
        orderId: docRef.id,
        buyerId: user.uid,
        sellerId: orderData.sellerId || null,
        createdAt: serverTimestamp(),
        read: false,
      });
    } catch (e) {
      console.warn('Failed to create admin notification for order', e);
    }
    // Also call backend endpoint to create admin notification (fallback for security rules)
    try {
      await authFetch('/api/products/admin-notify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: orderData.productId || null,
          productTitle: orderData.productTitle || null,
          buyerId: user.uid,
          sellerId: orderData.sellerId || null,
          type: orderData.type || 'delivery',
        }),
      });
    } catch (e) {
      // ignore backend notify failures
    }
    // Notify other UI about admin notifications change
    try {
      if (typeof window !== 'undefined' && window && window.dispatchEvent) {
        window.dispatchEvent(new Event('admin-notifications-changed'));
      }
    } catch (e) {}
    return { id: docRef.id, ...orderData };
  } catch (err) {
    console.error('Error creating order:', err);
    throw err;
  }
}

// Sellers: Post a product with image upload
export async function postProduct(productData, imageFile) {
  try {
    const user = auth.currentUser;
    let downloadUrl = null;
    let imagePath = null;
    if (imageFile) {
      // Try Cloudinary via backend first
      try {
        const form = new FormData();
        form.append('image', imageFile);
        const res = await authFetch('/api/products/upload-image-cloudinary', { method: 'POST', body: form });
        if (res.ok) {
          const j = await res.json();
          downloadUrl = j.url || null;
        } else {
          throw new Error('cloudinary_upload_failed');
        }
      } catch (e) {
        // Fallback to Firebase Storage
        const ownerId = productData.sellerId || (user && user.uid) || 'anonymous';
        imagePath = `products/${ownerId}/${imageFile.name}`;
        const imageRef = ref(storage, imagePath);
        await uploadBytes(imageRef, imageFile);
        downloadUrl = await getDownloadURL(imageRef);
      }
    }

    // Save product to Firestore; prefer provided sellerId/sellerName from productData
    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      status: productData.status || 'pending',
      imageUrl: downloadUrl,
      imagePath,
      photo: downloadUrl || productData.photo || null,
      sellerId: productData.sellerId || (user && user.uid) || '',
      sellerName: productData.sellerName || (user && (user.displayName || '')) || '',
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, ...productData, status: productData.status || 'pending', imageUrl: downloadUrl, imagePath, photo: downloadUrl || null, sellerId: productData.sellerId || (user && user.uid) || '' };
  } catch (err) {
    console.error('Error posting product:', err);
    throw err;
  }
}

// Sellers: Get only their own products
export async function getUserProducts() {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const q = query(collection(db, 'products'), where('sellerId', '==', user.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error fetching user products:', err);
    throw err;
  }
}

// Admin: Get all products
export async function getAllProducts() {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error fetching all products:', err);
    throw err;
  }
}

// Admin: Delete a product (removes Firestore doc and image from Storage)
export async function deleteProduct(productId) {
  try {
    const productDoc = await getDoc(doc(db, 'products', productId));
    if (!productDoc.exists()) throw new Error('Product not found');
  const { imagePath } = productDoc.data();
    // Delete image from Storage using stored path (imagePath)
    if (imagePath) {
      const imageRef = ref(storage, imagePath);
      await deleteObject(imageRef);
    }
    // Delete Firestore doc
    await deleteDoc(doc(db, 'products', productId));
    return true;
  } catch (err) {
    console.error('Error deleting product:', err);
    throw err;
  }
}

// Admin: Edit a product (update Firestore doc)
export async function editProduct(productId, updateData) {
  try {
    await updateDoc(doc(db, 'products', productId), updateData);
    return true;
  } catch (err) {
    console.error('Error editing product:', err);
    throw err;
  }
}
