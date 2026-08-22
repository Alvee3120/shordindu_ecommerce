"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCart } from "@/lib/cart";

const CartContext = createContext(null);

function countItems(cart) {
  return (cart?.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function CartProvider({ children }) {
  const [cartCount, setCartCount] = useState(0);

  const refreshCart = useCallback(async () => {
    try {
      const cart = await getCart();
      setCartCount(countItems(cart));
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial cart count fetch on mount
    refreshCart();
  }, [refreshCart]);

  return (
    <CartContext.Provider value={{ cartCount, refreshCart }}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
