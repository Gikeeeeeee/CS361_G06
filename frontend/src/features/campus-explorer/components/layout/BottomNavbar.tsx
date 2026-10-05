import React from 'react';
import { NavLink } from 'react-router-dom';
import { BOTTOM_NAV_ITEMS } from '../../../../shared/config/navigation.config';

export const BottomNavbar: React.FC = () => {
  return (
    <nav className="w-full h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] flex items-center justify-around shrink-0">
      <ul className="flex items-center justify-around w-full h-full px-3">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <li key={item.path} className="flex-1 h-full">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full h-full transition-all duration-300 relative ${
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className="transition-transform duration-300 group-active:scale-95" />
                  <span className="text-[10px] tracking-wide mt-1">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
