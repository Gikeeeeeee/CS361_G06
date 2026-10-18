import { supabase } from './supabaseClient';
import type { User, UserRole, LoginCredentials, SignUpCredentials } from '../types/auth.types';

const AUTH_USER_KEY = 'ku_long_auth_user';
const AUTH_TOKEN_KEY = 'ku_long_auth_token';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export interface BackendUserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  last_login: string | null;
}

export interface BackendUserMeResponse {
  success: boolean;
  data: BackendUserProfile;
  error?: {
    code: string;
    message: string;
  };
}

export const authService = {
  /**
   * Fetch current user profile & verified role from Backend API: GET /api/v1/users/me
   */
  async fetchUserProfile(token: string): Promise<User> {
    const url = `${API_BASE_URL}/api/v1/users/me`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (response.status === 401) {
      await this.logout();
      throw new Error('Session expired. Please sign in again.');
    }

    const body: BackendUserMeResponse = await response.json();
    if (!response.ok || !body.success || !body.data) {
      throw new Error(body?.error?.message || 'Failed to retrieve user profile from the system.');
    }

    const profile = body.data;
    const user: User = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name || profile.email.split('@')[0],
      role: profile.role || 'STUDENT',
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.full_name || profile.email)}`,
      created_at: profile.created_at,
    };

    return user;
  },

  /**
   * Sign In with Email & Password via Supabase Auth, then fetch profile from Backend
   */
  async login({ email, password }: LoginCredentials): Promise<{ user: User; token: string }> {
    const cleanEmail = email.trim().toLowerCase();

    if (!supabase) {
      throw new Error('Authentication service unavailable (Supabase client not initialized).');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.session || !data.user) {
      const isInvalid = error?.message?.toLowerCase().includes('invalid');
      const msg = isInvalid
        ? 'Invalid email or password.'
        : (error?.message || 'Sign in failed. Please try again.');
      throw new Error(msg);
    }

    const token = data.session.access_token;

    // Fetch verified profile and role from Backend GET /api/v1/users/me
    const user = await this.fetchUserProfile(token);

    this.setSession(user, token);
    return { user, token };
  },

  /**
   * Sign Up new account via Supabase Auth
   */
  async signUp({ email, password, full_name, role = 'STUDENT' }: SignUpCredentials): Promise<{ user: User; token: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const trimmedName = full_name.trim();

    if (!cleanEmail.includes('@')) {
      throw new Error('Invalid email format.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (!trimmedName) {
      throw new Error('Please enter your full name.');
    }

    if (!supabase) {
      throw new Error('Authentication service unavailable.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          role: 'STUDENT',
        },
      },
    });

    if (error || !data.user) {
      throw new Error(error?.message || 'Sign up failed. Please try again.');
    }

    // If session is returned immediately (auto sign-in)
    if (data.session) {
      const token = data.session.access_token;
      try {
        const user = await this.fetchUserProfile(token);
        this.setSession(user, token);
        return { user, token };
      } catch {
        const user: User = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          full_name: trimmedName,
          role: (role as UserRole) || 'STUDENT',
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(trimmedName)}`,
        };
        this.setSession(user, token);
        return { user, token };
      }
    }

    // Otherwise sign in with password to get session
    return this.login({ email: cleanEmail, password });
  },

  /**
   * Log out and clear session
   */
  async logout(): Promise<void> {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase logout warning:', err);
      }
    }
    this.clearSession();
  },

  /**
   * Restore session on app load, verify with Supabase & Backend /api/v1/users/me
   */
  async restoreSession(): Promise<User | null> {
    if (!supabase) {
      return this.getCurrentUser();
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        this.clearSession();
        return null;
      }

      const token = session.access_token;
      const user = await this.fetchUserProfile(token);
      this.setSession(user, token);
      return user;
    } catch {
      this.clearSession();
      return null;
    }
  },

  clearSession(): void {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  },

  setSession(user: User, token: string): void {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },

  getCurrentUser(): User | null {
    try {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },
};
