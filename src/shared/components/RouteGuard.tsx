import type { ReactNode } from 'react';
import { useAuthStore } from '@/app/auth/store';
import { useEffect } from 'react';

interface RouteGuardProps {
  children: ReactNode;
  requiredRole?: 'CUSTOMER' | 'AGENT' | 'ADMIN';
  fallback?: ReactNode;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  requiredRole,
  fallback = null
}) => {
  const { token, getUserRole } = useAuthStore();
  const userRole = getUserRole();

  useEffect(() => {
    if (!token) {
      const currentPath = window.location.pathname;
      window.location.href = `/auth?redirect=${encodeURIComponent(currentPath)}`;
      return;
    }

    const currentPath = window.location.pathname;

    if (currentPath.startsWith('/user_portal') && userRole !== 'CUSTOMER') {
      window.location.href = '/management';
      return;
    }

    if (currentPath.startsWith('/management') && userRole === 'CUSTOMER') {
      window.location.href = '/user_portal';
      return;
    }
  }, [token, userRole]);

  if (!token) {
    return fallback || <div className='flex items-center justify-center min-h-screen'>Redirecting to login...</div>;
  }

  const currentPath = window.location.pathname;

  if (currentPath.startsWith('/user_portal') && userRole !== 'CUSTOMER') {
    return fallback || <div className='flex items-center justify-center min-h-screen'>Redirecting to management...</div>;
  }

  if (currentPath.startsWith('/management') && userRole === 'CUSTOMER') {
    return fallback || <div className='flex items-center justify-center min-h-screen'>Redirecting to user portal...</div>;
  }

  if (requiredRole) {
    if (requiredRole === 'ADMIN' && userRole !== 'ADMIN') {
      return fallback || <div>Access denied. Admin only.</div>;
    }
    if (requiredRole === 'AGENT' && !['AGENT', 'ADMIN'].includes(userRole)) {
      return fallback || <div>Access denied. Agent or Admin only.</div>;
    }
  }

  return <>{children}</>;
};
