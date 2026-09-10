import React from 'react';
import { Link } from 'react-router-dom';
import { HEADER_CONFIG } from '../../config/navigation.config';
import type { HeaderConfig } from '../../types/navigation.types';

interface MobileHeaderProps {
  config?: HeaderConfig;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ config = HEADER_CONFIG }) => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/80 border-b border-slate-100/80 px-4 py-3 flex items-center justify-center relative">
      {/* Center: Logo next to Title */}
      <Link
        to="/"
        className="flex items-center gap-2.5 hover:opacity-85 transition-opacity"
        title="KU Long Home"
      >
        {config.showLogo && (
          <img
            src="/ku_long_logo.svg"
            alt="KU Long Logo"
            className="h-8 w-auto object-contain"
          />
        )}
        {config.title && (
          <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none select-none">
            {config.title}
          </h1>
        )}
      </Link>

      {/* Right: Action (if any) */}
      {config.rightAction && (
        <div className="absolute right-4 flex items-center">
          {config.rightAction}
        </div>
      )}
    </header>
  );
};
