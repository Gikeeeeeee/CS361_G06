import { useLocation } from 'react-router-dom';
import { adminNavConfig } from '../config/nav.config';

export function AdminHeader() {
  const location = useLocation();
  
  const activeItem = adminNavConfig.find(item => 
    item.path === location.pathname || 
    (item.path !== '/admin' && location.pathname.startsWith(item.path))
  );

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center text-sm text-slate-500">
        <span className="text-slate-400">Admin</span>
        <span className="mx-2">/</span>
        <span className="font-medium text-slate-900">
          {activeItem ? activeItem.label : 'Dashboard'}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <img 
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" 
            alt="Profile" 
            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-700">M. Registrar</span>
          </div>
        </div>
      </div>
    </header>
  );
}
