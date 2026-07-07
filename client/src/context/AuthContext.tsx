'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Agent';
  status: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<any>;
  verifyOtp: (userId: string, otp: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean, persist?: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') {
      setSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.otpRequired) {
      return response.data;
    }
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return response.data;
  };

  const verifyOtp = async (userId: string, otp: string) => {
    const response = await api.post('/auth/verify-otp', { userId, otp });
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const handleSetSidebarCollapsed = useCallback((collapsed: boolean, persist = true) => {
    setSidebarCollapsed(collapsed);
    if (persist) {
      localStorage.setItem('sidebar_collapsed', String(collapsed));
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      verifyOtp,
      logout,
      loading,
      isAdmin: user?.role === 'Admin',
      isManager: user?.role === 'Manager' || user?.role === 'Admin',
      sidebarCollapsed,
      toggleSidebar,
      setSidebarCollapsed: handleSetSidebarCollapsed
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
