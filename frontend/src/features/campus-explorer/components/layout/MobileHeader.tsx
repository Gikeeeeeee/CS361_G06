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
        title="Kulong Home"
      >
        {config.showLogo && (
          <svg viewBox="0 0 400 300" className="h-8 w-auto shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="50,40 200,40 145,145 200,250 50,250" fill="#90132B" />
            <path fillRule="evenodd" fill="#C49A4D" d="M 207,40 L 360,40 L 360,173.5 A 76.5,76.5 0 0,1 207,173.5 Z M 283.5,150 A 22,22 0 1,0 283.5,194 A 22,22 0 1,0 283.5,150 Z" />
          </svg>
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
