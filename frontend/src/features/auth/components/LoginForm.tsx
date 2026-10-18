import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    reason === 'unauthenticated' ? 'Please sign in to access this page.' : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedInUser = await login({ email: email.trim(), password, rememberMe });
      
      // If Staff, route to Admin Console; otherwise to homepage or safe redirect
      if (loggedInUser.role === 'STAFF' || loggedInUser.role === 'ADMIN') {
        navigate('/admin/schedules/manage', { replace: true });
      } else {
        const safeRedirect = redirectUrl && !redirectUrl.startsWith('/admin') ? redirectUrl : '/';
        navigate(safeRedirect, { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between p-6 sm:p-8">
      <div>
        {/* Top Navigation */}
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <svg viewBox="0 0 400 300" className="h-7 w-auto shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="50,40 200,40 145,145 200,250 50,250" fill="#90132B" />
              <path fillRule="evenodd" fill="#C49A4D" d="M 207,40 L 360,40 L 360,173.5 A 76.5,76.5 0 0,1 207,173.5 Z M 283.5,150 A 22,22 0 1,0 283.5,194 A 22,22 0 1,0 283.5,150 Z" />
            </svg>
            <span className="font-bold text-sm text-slate-800 tracking-tight">Kulong</span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign In</h1>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Sign in to manage schedules, save favorite rooms, and sync calendar.
          </p>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 text-xs animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                id="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. student@dome.tu.ac.th"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
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
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
              />
              <span>Remember me</span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {(isSubmitting || isLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting || isLoading ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase">
            <span className="bg-white px-3 text-slate-400 font-medium tracking-wider">or</span>
          </div>
        </div>

        {/* Continue as Guest */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer text-center"
        >
          Continue as Guest
        </button>
      </div>

      {/* Footer Navigation */}
      <div className="pt-8 text-center text-xs text-slate-500">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="text-blue-600 font-semibold hover:underline">
          Create Account
        </Link>
      </div>
    </div>
  );
};
