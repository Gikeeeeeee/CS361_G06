import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { User, LoginCredentials, SignUpCredentials } from '../types/auth.types';

const AUTH_USER_KEY = 'ku_long_auth_user';
const AUTH_TOKEN_KEY = 'ku_long_auth_token';
const MOCK_USERS_KEY = 'ku_long_mock_users';

// Default mock accounts requested by the team
const DEFAULT_MOCK_USERS: User[] = [
  {
    id: 'user-student-01',
    email: 'non@ku.th',
    full_name: 'Non',
    role: 'STUDENT',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Non',
    created_at: new Date().toISOString(),
  },
  {
    id: 'user-staff-01',
    email: 'admin@ku.th',
    full_name: 'Admin',
    role: 'STAFF',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
    created_at: new Date().toISOString(),
  },
];

function getMockUsers(): User[] {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    if (!raw) {
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(DEFAULT_MOCK_USERS));
      return DEFAULT_MOCK_USERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_MOCK_USERS;
  }
}

function saveMockUser(user: User): void {
  const users = getMockUsers();
  users.push(user);
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

export const authService = {
  /**
   * Log in with Email & Password
   */
  async login({ email, password }: LoginCredentials): Promise<{ user: User; token: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. If Supabase is fully configured, try Supabase Auth first
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!error && data.user) {
        const metadata = data.user.user_metadata || {};
        const user: User = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          full_name: metadata.full_name || cleanEmail.split('@')[0],
          role: metadata.role || 'STUDENT',
          avatar_url: metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.id}`,
        };
        const token = data.session?.access_token || 'supabase-session-token';
        this.setSession(user, token);
        return { user, token };
      }
    }

    // 2. Mock Fallback: Validates "Non" (Student) and "Admin" (Staff) with password "123456"
    // Also allows username-only inputs (e.g. typing "non" or "admin")
    const isStudent = cleanEmail === 'non@ku.th' || cleanEmail === 'non' || cleanEmail === 'student@ku.th';
    const isStaff = cleanEmail === 'admin@ku.th' || cleanEmail === 'admin' || cleanEmail === 'staff@ku.th';

    if (password === '123456') {
      if (isStudent) {
        const user = DEFAULT_MOCK_USERS[0];
        const token = 'mock-jwt-student-token';
        this.setSession(user, token);
        return { user, token };
      }
      if (isStaff) {
        const user = DEFAULT_MOCK_USERS[1];
        const token = 'mock-jwt-staff-token';
        this.setSession(user, token);
        return { user, token };
      }
    }

    // Check newly registered mock users in localStorage
    const registeredUsers = getMockUsers();
    const foundUser = registeredUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (foundUser && password.length >= 6) {
      const token = `mock-jwt-${foundUser.id}`;
      this.setSession(foundUser, token);
      return { user: foundUser, token };
    }

    throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง (Invalid email or password)');
  },

  /**
   * Sign Up new account
   * Sends full_name in options.data for Supabase Auth sync
   */
  async signUp({ email, password, full_name }: SignUpCredentials): Promise<{ user: User; token: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const trimmedName = full_name.trim();

    if (!cleanEmail.includes('@')) {
      throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
    }
    if (password.length < 6) {
      throw new Error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
    }
    if (!trimmedName) {
      throw new Error('กรุณากรอกชื่อ-นามสกุล');
    }

    // 1. Try Supabase Auth
    if (isSupabaseConfigured() && supabase) {
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

      if (!error && data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          full_name: trimmedName,
          role: 'STUDENT',
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${trimmedName}`,
        };
        const token = data.session?.access_token || 'supabase-session-token';
        this.setSession(user, token);
        return { user, token };
      }
      if (error) {
        throw new Error(error.message || 'การสมัครสมาชิกล้มเหลว');
      }
    }

    // 2. Mock Fallback Registration
    const newUser: User = {
      id: `user-${Date.now()}`,
      email: cleanEmail,
      full_name: trimmedName,
      role: 'STUDENT',
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${trimmedName}`,
      created_at: new Date().toISOString(),
    };

    saveMockUser(newUser);
    const token = `mock-token-${newUser.id}`;
    this.setSession(newUser, token);
    return { user: newUser, token };
  },

  /**
   * Log out and clear session
   */
  async logout(): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase logout error:', err);
      }
    }
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
