import { supabase } from '../lib/supabase';

// Signup with dummy email & role
export async function signUpWithDummyEmail(email: string, pass: string, fullName: string, role: 'STUDENT' | 'STAFF' = 'STUDENT') {
    return await supabase.auth.signUp({
        email,
        password: pass,
        options: {
            data: {
                full_name: fullName,
                role: role
            }
        }
    });
}

// Signin returns session containing the JWT access token
export async function signIn(email: string, pass: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
    });
    if (error) throw error;
    return data.session?.access_token;
}

export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: 'STUDENT' | 'STAFF';
    created_at: string;
    last_login: string | null;
}

export interface UserMeResponse {
    success: boolean;
    data: UserProfile;
}

// Fetch current user profile & role via GET /api/v1/users/me
export async function getCurrentUser(token: string): Promise<UserProfile> {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
        },
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
        throw new Error(body?.error?.message || 'Failed to fetch user profile');
    }

    return body.data;
}
