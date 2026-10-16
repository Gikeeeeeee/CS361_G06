import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { MobileHeader } from '../features/campus-explorer/components/layout/MobileHeader';
import { BottomNavbar } from '../features/campus-explorer/components/layout/BottomNavbar';
import { AlertCircle } from 'lucide-react';

export const UserLayout: React.FC = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isTabPage = ['/', '/saved', '/profile'].includes(location.pathname);
  const [unauthorizedToast, setUnauthorizedToast] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const stateMsg = (location.state as any)?.unauthorizedMessage;
    if (errorParam === 'unauthorized' || stateMsg) {
      setUnauthorizedToast(stateMsg || 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (Staff access only)');
      // Clean up search param
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
      const timer = setTimeout(() => setUnauthorizedToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, location.state]);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-center overflow-hidden text-slate-900">
      {/* Mobile Frame Container */}
      <div className="w-full h-[100dvh] md:max-w-md mx-auto bg-white shadow-2xl md:border-x md:border-gray-200 relative flex flex-col overflow-hidden">
        
        {/* Top Header - Only on Tab Pages */}
        {isTabPage && <MobileHeader />}

        {/* Unauthorized Toast Notification */}
        {unauthorizedToast && (
          <div className="absolute top-16 left-4 right-4 z-50 p-3 bg-rose-600 text-white rounded-xl shadow-lg flex items-center gap-2.5 text-xs animate-in slide-in-from-top duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-white" />
            <span className="font-medium flex-1">{unauthorizedToast}</span>
            <button
              onClick={() => setUnauthorizedToast(null)}
              className="text-white/80 hover:text-white text-xs font-bold px-1"
            >
              ✕
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
