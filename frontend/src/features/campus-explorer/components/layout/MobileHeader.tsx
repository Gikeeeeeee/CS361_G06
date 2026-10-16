import React from 'react';
import { Link } from 'react-router-dom';
import { HEADER_CONFIG } from '../../../../shared/config/navigation.config';
import type { HeaderConfig } from '../../../../shared/types/navigation.types';
import { useAuth } from '../../../auth/context/AuthContext';
import { User as UserIcon } from 'lucide-react';

interface MobileHeaderProps {
  config?: HeaderConfig;
}

const AuthHeaderStatus: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated && user) {
    return (
      <Link
        to="/profile"
        className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-100 transition-colors"
        title="View Profile"
      >
        <img
          src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name}`}
          alt={user.full_name}
          className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 object-cover"
        />
      </Link>
    );
  }

  return (
    <Link
      to="/login"
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100/90 hover:bg-slate-200/80 text-slate-600 text-xs font-semibold transition-colors"
      title="Sign In"
    >
      <UserIcon className="w-3.5 h-3.5" />
      <span>Guest</span>
    </Link>
  );
};

export const MobileHeader: React.FC<MobileHeaderProps> = ({ config = HEADER_CONFIG }) => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/80 border-b border-slate-100/80 px-4 py-3 flex items-center justify-center relative shrink-0">
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

      {/* Right: Action or Auth status */}
      <div className="absolute right-4 flex items-center">
        {config.rightAction ? (
          config.rightAction
        ) : (
          <AuthHeaderStatus />
        )}
      </div>
    </header>
  );
};
