// Firebase product service for React + Firebase v9 modular SDK
import { db, storage, auth } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

// Sellers: Post a product with image upload
export async function postProduct(productData, imageFile) {
  try {
    const user = auth.currentUser;
    // Upload image to Storage; use provided sellerId where possible, else firebase user
    const ownerId = productData.sellerId || (user && user.uid) || 'anonymous';
    const imagePath = `products/${ownerId}/${imageFile.name}`;
    const imageRef = ref(storage, imagePath);
    await uploadBytes(imageRef, imageFile);
    const downloadUrl = await getDownloadURL(imageRef);

    // Save product to Firestore; prefer provided sellerId/sellerName from productData
    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      status: productData.status || 'pending',
      imageUrl: downloadUrl,
      imagePath,
      sellerId: productData.sellerId || (user && user.uid) || '',
      sellerName: productData.sellerName || (user && (user.displayName || '')) || '',
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, ...productData, status: productData.status || 'pending', imageUrl: downloadUrl, imagePath, sellerId: productData.sellerId || (user && user.uid) || '' };
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
