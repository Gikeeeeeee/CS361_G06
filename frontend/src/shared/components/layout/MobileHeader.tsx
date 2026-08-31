import React from 'react';
import { MapPin } from 'lucide-react';
import { HEADER_CONFIG } from '../../config/navigation.config';
import type { HeaderConfig } from '../../types/navigation.types';

interface MobileHeaderProps {
  config?: HeaderConfig;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ config = HEADER_CONFIG }) => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/70 border-b border-slate-100/50 px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {config.showLogo && (
          <div className="w-9 h-9 bg-primary-500/10 text-primary rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.08)] border border-primary-500/10">
            <MapPin size={18} className="stroke-[2.5]" />
          </div>
        )}
        {config.title && (
          <h1 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none">
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
