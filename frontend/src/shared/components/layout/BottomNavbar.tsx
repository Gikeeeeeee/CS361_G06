import React from 'react';
import { NavLink } from 'react-router-dom';
import { BOTTOM_NAV_ITEMS } from '../../config/navigation.config';

export const BottomNavbar: React.FC = () => {
  return (
    <nav className="fixed bottom-0 w-full max-w-md mx-auto border-t border-slate-200 bg-white/95 backdrop-blur-lg pb-safe z-50">
      <ul className="flex items-center justify-around h-16 px-2">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <li key={item.path} className="flex-1 h-full">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 ${
                  isActive
                    ? 'text-blue-600 scale-105'
                    : 'text-slate-400 hover:text-slate-600 hover:scale-105'
                }`
              }
            >
              <item.icon size={22} strokeWidth={2.5} />
              <span className="text-[10px] font-medium tracking-wide">
                {item.label}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
