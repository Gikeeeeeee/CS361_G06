import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Building2 } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  const reason = searchParams.get('reason');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    reason === 'unauthenticated' ? 'กรุณาเข้าสู่ระบบก่อนเข้าใช้งานหน้านี้' : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    try {
      const loggedInUser = await login({ email: email.trim(), password, rememberMe });
      // If Admin / Staff, navigate directly to Admin Console
      if (loggedInUser.role === 'STAFF' || loggedInUser.role === 'ADMIN') {
        navigate('/admin/schedules/manage', { replace: true });
      } else {
        const safeRedirect = redirectUrl && !redirectUrl.startsWith('/admin') ? redirectUrl : '/';
        navigate(safeRedirect, { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid email or password. Please try again.');
    }
  };

  // Helper for 1-click test fill
  const fillCredentials = (mockEmail: string) => {
    setEmail(mockEmail);
    setPassword('123456');
    setErrorMessage('');
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col justify-center py-4 px-2 sm:px-4">
      {/* App Logo & Header (Shown on mobile, desktop showcases it on left panel) */}
      <div className="flex md:hidden items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">KU Long</h1>
          <p className="text-xs text-slate-500">Your university campus companion</p>
        </div>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
        <p className="text-sm text-slate-500 mt-1">Sign in to keep your campus life in sync.</p>
      </div>

      {/* Quick Fill Demo Badges (High UX convenience) */}
      <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <p className="text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
          Demo Mock Accounts (Click to fill):
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fillCredentials('non@ku.th')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-medium transition-colors"
          >
            <span>👨‍🎓 Non (Student)</span>
          </button>
          <button
            type="button"
            onClick={() => fillCredentials('admin@ku.th')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-medium transition-colors"
          >
            <span>🛡️ Admin (Staff)</span>
          </button>
        </div>
      </div>

      {/* Error Alert Box */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 text-xs animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="login-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. non@ku.th or admin@ku.th"
              className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              id="login-password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <span>Remember me</span>
          </label>
          <span className="text-blue-600 font-medium hover:underline cursor-pointer">
            Forgot password?
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          id="login-submit-button"
          disabled={isLoading}
          className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      {/* Don't have an account? Sign Up */}
      <div className="mt-6 text-center text-xs text-slate-600">
        Don't have an account?{' '}
        <Link to="/signup" className="font-semibold text-blue-600 hover:underline">
          Sign Up
        </Link>
      </div>

      {/* Explore as Guest */}
      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400 mb-2">Just looking around?</p>
        <Link
          to="/"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          Explore as a guest
        </Link>
      </div>
    </div>
  );
};
