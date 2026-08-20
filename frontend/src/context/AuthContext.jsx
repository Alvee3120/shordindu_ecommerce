"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, signIn, signOut, signUp } from "@/lib/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  const login = useCallback(async (credentials) => {
    const me = await signIn(credentials);
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (payload) => {
    const me = await signUp(payload);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated: !!user, login, register, logout, refetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
