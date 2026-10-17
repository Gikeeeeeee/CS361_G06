import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import type { User, UserRole, LoginCredentials, SignUpCredentials } from '../types/auth.types';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  signUp: (credentials: SignUpCredentials) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and verify session on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const restoredUser = await authService.restoreSession();
        if (isMounted) {
          setUser(restoredUser);
        }
      } catch (e) {
        console.error('Failed to verify session with backend:', e);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen to 401 Unauthorized events from API calls to auto-logout
    const handleUnauthorized = () => {
      setUser(null);
      authService.clearSession();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    // Listen to Supabase Auth state changes (token refresh, logout)
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          authService.clearSession();
          if (isMounted) setUser(null);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          const currentUser = authService.getCurrentUser();
          if (currentUser) {
            authService.setSession(currentUser, session.access_token);
          }
        }
      });

      return () => {
        isMounted = false;
        window.removeEventListener('auth:unauthorized', handleUnauthorized);
        subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<User> => {
    setIsLoading(true);
    try {
      const { user: loggedInUser } = await authService.login(credentials);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (credentials: SignUpCredentials): Promise<User> => {
    setIsLoading(true);
    try {
      const { user: registeredUser } = await authService.signUp(credentials);
      setUser(registeredUser);
      return registeredUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    signUp,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
