// Firebase product service for React + Firebase v9 modular SDK
import { db, storage, auth } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import authFetch from './utils/authFetch';

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
