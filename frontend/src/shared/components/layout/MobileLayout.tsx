import React from 'react';
import { MobileHeader } from './MobileHeader';
import { BottomNavbar } from './BottomNavbar';

interface MobileLayoutProps {
  children: React.ReactNode;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen max-w-md mx-auto bg-slate-50 overflow-hidden shadow-2xl flex flex-col">
      <MobileHeader />
      
      {/* Main scrollable content area, padded for top header and bottom nav */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <BottomNavbar />
    </div>
  );
};
