import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <AdminSidebar />
      <div className="flex-1 min-w-0 lg:ml-64 flex flex-col min-h-screen">
        <AdminHeader />
        <main className="flex-1 min-w-0 p-0 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
