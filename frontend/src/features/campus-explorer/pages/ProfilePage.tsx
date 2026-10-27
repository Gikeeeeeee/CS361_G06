import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import { useBookmarks } from '../../bookmarks/context/BookmarkContext';
import {
  Bookmark,
  Calendar,
  Bell,
  LogOut,
  ChevronRight,
  LogIn,
  Building,
  CheckCircle2,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, role, isAuthenticated, logout } = useAuth();
  const { bookmarks } = useBookmarks();
  const navigate = useNavigate();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const savedRoomsCount = bookmarks.filter((b) => b.entityType === 'ROOM').length;
  const savedSchedulesCount = bookmarks.filter((b) => b.entityType === 'SCHEDULE').length;

  useEffect(() => {
    if (role === 'STAFF' || role === 'ADMIN') {
      navigate('/admin/schedules/manage', { replace: true });
    }
  }, [role, navigate]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportAllIcs = () => {
    // Generate sample consolidated .ics download
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KU Long//Student Timetable//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:KU Long Student Timetable
X-WR-TIMEZONE:Asia/Bangkok
BEGIN:VEVENT
SUMMARY:CS361 Software Architecture
DTSTART:20261019T090000
DTEND:20261019T120000
LOCATION:LC4 Room 210
DESCRIPTION:Exported from KU Long Timetable
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${user?.full_name || 'My'}_KU_Timetable.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('ดาวน์โหลดไฟล์ปฏิทิน (.ics) สำเร็จแล้ว!');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // If Unauthenticated (Guest View)
  if (!isAuthenticated || !user) {
    return (
      <div className="p-4 sm:p-6 max-w-md mx-auto space-y-6">
        <h1 className="text-xl font-bold text-slate-900">Profile</h1>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <LogIn className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">Browsing as Guest</h2>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Sign in to bookmark favorite classrooms, access personal schedules, and export to calendar.
          </p>

          <div className="space-y-2">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-sm transition-all"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
            >
              Create New Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isStaff = role === 'STAFF' || role === 'ADMIN';

  if (isStaff) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[300px] text-slate-500 text-xs">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span>กำลังนำทางไปยัง Admin Console...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto space-y-5 pb-20">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Title */}
      <h1 className="text-xl font-bold text-slate-900">Profile</h1>

      {/* User Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center text-center shadow-xs">
        <img
          src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name}`}
          alt={user.full_name}
          className="w-20 h-20 rounded-full bg-slate-100 border-2 border-white shadow-md mb-3 object-cover"
        />
        <h2 className="text-base font-bold text-slate-900">{user.full_name}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>

        <span className="mt-2.5 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
          STUDENT
        </span>
      </div>

      {/* Student View Stats (Rooms & Schedules) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xl font-bold text-slate-900">{savedRoomsCount}</span>
            <Building className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xs text-slate-500 font-medium">Saved Rooms</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xl font-bold text-slate-900">{savedSchedulesCount}</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xs text-slate-500 font-medium">Bookmarked Schedules</p>
        </div>
      </div>

      {/* Action List Group */}
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-xs">
        <p className="px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50">
          Your Account
        </p>

        <button
          onClick={() => navigate('/saved')}
          className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-slate-700 text-xs font-medium">
            <Bookmark className="w-4 h-4 text-blue-600" />
            <span>My Saved Items</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={handleExportAllIcs}
          className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-slate-700 text-xs font-medium">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Export All Schedules to .ics</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={() => showToast('การแจ้งเตือนเปิดใช้งานอยู่แล้ว')}
          className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-slate-700 text-xs font-medium">
            <Bell className="w-4 h-4 text-blue-600" />
            <span>Notification Settings</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Log Out Button */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 active:scale-[0.99]"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out</span>
      </button>
    </div>
  );
}
