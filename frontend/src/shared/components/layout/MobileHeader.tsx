import React from 'react';
import { MapPin } from 'lucide-react';
import { HEADER_CONFIG } from '../../config/navigation.config';
import type { HeaderConfig } from '../../types/navigation.types';

interface MobileHeaderProps {
  config?: HeaderConfig;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ config = HEADER_CONFIG }) => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/90 border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2">
        {config.showLogo && (
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <MapPin size={22} className="text-blue-600" />
          </div>
        )}
        {config.title && (
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            {config.title}
          </h1>
        )}
      </div>
      
      {config.rightAction && (
        <div className="flex items-center">
          {config.rightAction}
        </div>
      )}
    </header>
  );
};
