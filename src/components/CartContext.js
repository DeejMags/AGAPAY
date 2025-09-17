import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  function addToCart(product) {
    setCart(prev => [...prev, product]);
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(item => item._id !== id));
  }

  return (
    <CartContext.Provider value={{ cart, addToCart, setCart, removeFromCart }}>
      {children}
    </CartContext.Provider>
  );
}
