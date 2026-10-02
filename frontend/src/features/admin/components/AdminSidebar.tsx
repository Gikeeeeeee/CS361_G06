import { NavLink, useLocation } from 'react-router-dom';
import { adminNavConfig } from '../config/nav.config';
import { LogOut } from 'lucide-react';

export function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0">
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200 shrink-0">
        <img src="/ku_long_logo.svg" alt="KU Long" className="w-8 h-8" />
        <span className="font-bold text-lg text-slate-800">KU Long</span>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
          ADMIN
        </span>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {adminNavConfig.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-blue-50 text-blue-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  item.badge === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <button className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
          <LogOut className="w-5 h-5" />
          Log Out
        </button>
      </div>
    </aside>
  );
}
