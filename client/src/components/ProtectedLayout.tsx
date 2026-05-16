'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';

interface ProtectedLayoutProps {
  children: React.ReactNode;
  requiredRole?: 'Admin' | 'Manager' | 'Agent';
}

export default function ProtectedLayout({ children, requiredRole }: ProtectedLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
    if (!loading && user && requiredRole) {
      const roleHierarchy = { Admin: 3, Manager: 2, Agent: 1 };
      const userLevel = roleHierarchy[user.role] || 0;
      const requiredLevel = roleHierarchy[requiredRole] || 0;
      if (userLevel < requiredLevel) {
        router.replace('/home');
      }
    }
  }, [user, loading, router, requiredRole]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner spinner-dark" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <Sidebar />
      <div className="main-layout">
        {children}
      </div>
    </>
  );
}
