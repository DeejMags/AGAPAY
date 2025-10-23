import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }) {
  // Load cart from localStorage so cart persists across reloads
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem('agapay_cart');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('agapay_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('Failed to persist cart to localStorage', e);
    }
  }, [cart]);

  // Add product to cart. If it already exists, increment quantity.
  // product: object (may have _id or id); qty: number (default 1)
  function addToCart(product, qty = 1) {
    if (!product) return;
    const id = product._id || product.id || String(Date.now());
    setCart(prev => {
      const found = prev.find(i => i.id === id);
      if (found) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity + qty } : i);
      }
      // store a lightweight snapshot to avoid persisting large nested objects
      const item = {
        id,
        title: product.title || product.name || '',
        price: typeof product.price === 'number' ? product.price : Number(product.price) || 0,
        image: Array.isArray(product.photo) ? product.photo[0] : (product.photo || product.imageUrl || ''),
        productRef: { _id: product._id, id: product.id },
        quantity: qty,
      };
      return [...prev, item];
    });
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(item => item.id !== id));
  }

  return (
    <CartContext.Provider value={{ cart, addToCart, setCart, removeFromCart }}>
      {children}
    </CartContext.Provider>
  );
}
