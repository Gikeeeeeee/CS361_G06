import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth.types';

interface RoleRouteGuardProps {
  allowedRoles?: UserRole[];
  redirectPath?: string;
}

export const RoleRouteGuard: React.FC<RoleRouteGuardProps> = ({
  allowedRoles = ['STAFF', 'ADMIN'],
  redirectPath = '/',
}) => {
  const { user, role, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Verifying access...</span>
        </div>
      </div>
    );
  }

  // Case 1: Unauthenticated Guest trying to access protected route
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}&reason=unauthenticated`}
        replace
      />
    );
  }

  // Case 2: Authenticated user (e.g. Student) lacks required role
  if (role && !allowedRoles.includes(role)) {
    return (
      <Navigate
        to={`${redirectPath}?error=unauthorized`}
        replace
        state={{
          unauthorizedMessage: 'You do not have permission to access this page.',
        }}
      />
    );
  }

  return <Outlet />;
};
