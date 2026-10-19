import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MobileHeader } from '../features/campus-explorer/components/layout/MobileHeader';
import { BottomNavbar } from '../features/campus-explorer/components/layout/BottomNavbar';
import { AlertCircle, X } from 'lucide-react';

export const UserLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isTabPage = ['/', '/saved', '/profile'].includes(location.pathname);
  const [unauthorizedToast, setUnauthorizedToast] = useState<string | null>(null);

  // 1. Detect unauthorized redirect and extract message
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const stateMsg = (location.state as any)?.unauthorizedMessage;

    if (errorParam === 'unauthorized' || stateMsg) {
      const message = stateMsg || 'You do not have permission to access this page (Staff access only).';
      setUnauthorizedToast(message);

      // Clean up search param and location state so it won't re-trigger
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('error');
      const newSearch = newParams.toString() ? `?${newParams.toString()}` : '';

      navigate(`${location.pathname}${newSearch}`, {
        replace: true,
        state: {},
      });
    }
  }, [searchParams, location.state, location.pathname, navigate]);

  // 2. Auto-dismiss the toast after exactly 5 seconds
  useEffect(() => {
    if (!unauthorizedToast) return;

    const timer = setTimeout(() => {
      setUnauthorizedToast(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [unauthorizedToast]);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-center overflow-hidden text-slate-900">
      {/* Mobile Frame Container */}
      <div className="w-full h-[100dvh] md:max-w-md mx-auto bg-white shadow-2xl md:border-x md:border-gray-200 relative flex flex-col overflow-hidden">
        
        {/* Top Header - Only on Tab Pages */}
        {isTabPage && <MobileHeader />}

        {/* Unauthorized Toast Notification */}
        {unauthorizedToast && (
          <div className="absolute top-3 left-4 right-4 z-[9999] p-3.5 bg-rose-600 text-white rounded-2xl shadow-2xl border border-rose-500/40 flex items-center gap-3 text-xs animate-in slide-in-from-top-2 duration-200">
            <div className="p-1 rounded-full bg-white/20 shrink-0">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold flex-1 leading-snug">{unauthorizedToast}</span>
            <button
              type="button"
              onClick={() => setUnauthorizedToast(null)}
              className="p-1 -mr-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <Outlet />
        </main>
        
        {/* Bottom Navigation */}
        <div className="pb-safe bg-white z-50 mt-auto shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <BottomNavbar />
        </div>
      </div>
    </div>
  );
};
