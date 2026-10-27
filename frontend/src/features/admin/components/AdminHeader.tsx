import { useLocation, useNavigate } from 'react-router-dom';
import { adminNavConfig } from '../config/nav.config';
import { useAuth } from '../../auth/context/AuthContext';
import { LogOut } from 'lucide-react';

export function AdminHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const activeItem = adminNavConfig.find(item => 
    item.path === location.pathname || 
    (item.path !== '/admin' && location.pathname.startsWith(item.path))
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center text-sm text-slate-500">
        <span className="text-slate-400">Admin</span>
        <span className="mx-2">/</span>
        <span className="font-medium text-slate-900">
          {activeItem ? activeItem.label : 'Dashboard'}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <img 
            src={user?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'} 
            alt="Profile" 
            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-700">{user?.full_name || 'Admin'}</span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">{user?.role || 'STAFF'}</span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200" />

        <button
          onClick={handleLogout}
          id="admin-header-logout-btn"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer active:scale-95"
          title="Sign out of Admin Console"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </div>
    </header>
  );
}
