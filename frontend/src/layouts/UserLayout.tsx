import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MobileHeader } from '../features/campus-explorer/components/layout/MobileHeader';
import { BottomNavbar } from '../features/campus-explorer/components/layout/BottomNavbar';

export const UserLayout: React.FC = () => {
  const location = useLocation();
  const isTabPage = ['/', '/saved', '/profile'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-center overflow-hidden text-slate-900">
      {/* Mobile Frame Container */}
      <div className="w-full h-[100dvh] md:max-w-md mx-auto bg-white shadow-2xl md:border-x md:border-gray-200 relative flex flex-col overflow-hidden">
        
        {/* Top Header - Only on Tab Pages */}
        {isTabPage && <MobileHeader />}

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
