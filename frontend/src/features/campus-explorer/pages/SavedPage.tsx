import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookmarks } from '../../bookmarks/context/BookmarkContext';
import { BookmarkButton } from '../../bookmarks/components/BookmarkButton';
import { parseScheduleTime } from '../../bookmarks/utils/scheduleConflictUtils';
import {
  Calendar,
  Clock,
  MapPin,
  Download,
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

// Color themes matching the Figma timetable design
const COURSE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CS361: { bg: 'bg-blue-100/90', text: 'text-blue-700', border: 'border-blue-200' },
  CS366: { bg: 'bg-purple-100/90', text: 'text-purple-700', border: 'border-purple-200' },
  CS371: { bg: 'bg-emerald-100/90', text: 'text-emerald-700', border: 'border-emerald-200' },
  CS367: { bg: 'bg-emerald-100/90', text: 'text-emerald-700', border: 'border-emerald-200' },
  CS362: { bg: 'bg-purple-100/90', text: 'text-purple-700', border: 'border-purple-200' },
  CS372: { bg: 'bg-amber-100/90', text: 'text-amber-700', border: 'border-amber-200' },
  CS363: { bg: 'bg-emerald-100/90', text: 'text-emerald-700', border: 'border-emerald-200' },
  CS368: { bg: 'bg-blue-100/90', text: 'text-blue-700', border: 'border-blue-200' },
  CS369: { bg: 'bg-purple-100/90', text: 'text-purple-700', border: 'border-purple-200' },
  CS364: { bg: 'bg-amber-100/90', text: 'text-amber-700', border: 'border-amber-200' },
  CS365: { bg: 'bg-blue-100/90', text: 'text-blue-700', border: 'border-blue-200' },
  CS370: { bg: 'bg-emerald-100/90', text: 'text-emerald-700', border: 'border-emerald-200' },
};

function getScheduleColor(code?: string) {
  if (code && COURSE_COLORS[code]) {
    return COURSE_COLORS[code];
  }
  const fallbackList = [
    { bg: 'bg-blue-100/90', text: 'text-blue-700', border: 'border-blue-200' },
    { bg: 'bg-purple-100/90', text: 'text-purple-700', border: 'border-purple-200' },
    { bg: 'bg-emerald-100/90', text: 'text-emerald-700', border: 'border-emerald-200' },
    { bg: 'bg-amber-100/90', text: 'text-amber-700', border: 'border-amber-200' },
  ];
  let sum = 0;
  for (let i = 0; i < (code?.length || 0); i++) {
    sum += code?.charCodeAt(i) || 0;
  }
  return fallbackList[sum % fallbackList.length];
}

const DAYS_HEADER = [
  { dayOfWeek: 1, name: 'Mon', dateNum: 14 },
  { dayOfWeek: 2, name: 'Tue', dateNum: 15 },
  { dayOfWeek: 3, name: 'Wed', dateNum: 16 },
  { dayOfWeek: 4, name: 'Thu', dateNum: 17 },
  { dayOfWeek: 5, name: 'Fri', dateNum: 18 },
];

const TIME_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const START_HOUR = 8;
const HOUR_ROW_HEIGHT = 50; // px per hour

export default function SavedPage() {
  const navigate = useNavigate();
  const { bookmarks, isLoggedIn, activeUser, loginAsStudentDemo, logoutDemo } = useBookmarks();

  // View switcher: LIST ('LIST') vs TIMETABLE CALENDAR ('CALENDAR')
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Only keep SCHEDULE items for Timetable as requested
  const savedSchedules = useMemo(
    () => bookmarks.filter((b) => b.entityType === 'SCHEDULE'),
    [bookmarks]
  );

  // Initialize selected schedules when list changes
  useMemo(() => {
    setSelectedScheduleIds(savedSchedules.map((s) => s.entityId));
  }, [savedSchedules]);

  const allSelected =
    savedSchedules.length > 0 &&
    selectedScheduleIds.length === savedSchedules.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedScheduleIds([]);
    } else {
      setSelectedScheduleIds(savedSchedules.map((s) => s.entityId));
    }
  };

  const handleToggleSchedule = (entityId: string) => {
    setSelectedScheduleIds((prev) =>
      prev.includes(entityId)
        ? prev.filter((id) => id !== entityId)
        : [...prev, entityId]
    );
  };

  // Calculate actual total hours dynamically
  const totalHours = useMemo(() => {
    const selectedItems = savedSchedules.filter((s) =>
      selectedScheduleIds.includes(s.entityId)
    );
    return selectedItems.reduce((acc, curr) => {
      const slot = parseScheduleTime(curr);
      return acc + (slot?.durationHours || 3);
    }, 0);
  }, [savedSchedules, selectedScheduleIds]);

  // Export timetable as .ics calendar file
  const handleExportTimetableIcs = () => {
    const selectedItems = savedSchedules.filter((s) =>
      selectedScheduleIds.includes(s.entityId)
    );

    if (selectedItems.length === 0) {
      showToast('Please select at least 1 class to export');
      return;
    }

    const eventsBlock = selectedItems
      .map((s) => {
        const slot = parseScheduleTime(s);
        const dayOffset = (slot?.dayOfWeek || 1) - 1;
        const sH = String(Math.floor((slot?.startMinutes || 540) / 60)).padStart(2, '0');
        const sM = String((slot?.startMinutes || 540) % 60).padStart(2, '0');
        const eH = String(Math.floor((slot?.endMinutes || 720) / 60)).padStart(2, '0');
        const eM = String((slot?.endMinutes || 720) % 60).padStart(2, '0');
        const dayNum = String(14 + Math.max(0, dayOffset)).padStart(2, '0');

        return `BEGIN:VEVENT
SUMMARY:${s.courseCode || ''} ${s.title}
DTSTART:202609${dayNum}T${sH}${sM}00
DTEND:202609${dayNum}T${eH}${eM}00
LOCATION:${s.roomName || s.building || 'KU Campus'}
DESCRIPTION:Exported from KU Long Timetable
STATUS:CONFIRMED
END:VEVENT`;
      })
      .join('\n');

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KU Long//Student Timetable//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:KU Long Student Timetable
X-WR-TIMEZONE:Asia/Bangkok
${eventsBlock}
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'My_Timetable.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Successfully downloaded ${selectedItems.length} classes to calendar (.ics)!`);
  };

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto space-y-4 pb-32 min-h-full flex flex-col bg-slate-50/50">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header: Title and View Switcher */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            My Timetable
          </h1>
        </div>

        {/* View Toggle Buttons [ List | Calendar ] */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('LIST')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'LIST'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-400 hover:text-slate-600'
            }`}
            title="List View"
            aria-label="List View"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('CALENDAR')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'CALENDAR'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-400 hover:text-slate-600'
            }`}
            title="Calendar View"
            aria-label="Calendar View"
          >
            <CalendarDays className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Role State Banner (Guest vs Student NON) */}
      {!isLoggedIn ? (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300/60">
              Guest Mode (Not Signed In)
            </span>
          </div>
          <p className="text-[11px] text-amber-900 font-medium leading-relaxed mb-2.5">
            Guest users do not have a personal timetable. Please sign in with a student account (Role: <strong>NON</strong>) to save and organize your classes.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs text-center"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={loginAsStudentDemo}
              className="py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-[11px] font-semibold rounded-xl transition cursor-pointer"
              title="Switch to Student Role to view sample timetable"
            >
              Try Student Demo (NON)
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-blue-50/70 border border-blue-100 rounded-xl px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-slate-800 text-[11px]">
              {activeUser?.name || 'KU Student'}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
              Role: {activeUser?.role || 'NON'}
            </span>
          </div>
          <button
            type="button"
            onClick={logoutDemo}
            className="text-[10px] text-slate-500 hover:text-rose-600 font-medium underline cursor-pointer"
          >
            Switch to Guest
          </button>
        </div>
      )}

      {/* Schedules Count Badge & Subtitle */}
      <div>
        <div className="w-full py-2 bg-white border border-blue-200/80 rounded-xl text-center shadow-2xs mb-1.5">
          <span className="text-xs font-bold text-blue-600">
            Schedules ({savedSchedules.length})
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Schedules selected - review and export your timetable
        </p>
      </div>

      {/* EMPTY / GUEST STATE */}
      {savedSchedules.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xs my-6">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            {!isLoggedIn ? 'Guest Timetable is Empty' : 'No Bookmarked Schedules'}
          </h3>
          <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
            {!isLoggedIn
              ? 'Guest users do not have a personal timetable. Please sign in with a student account (Role: NON) to bookmark classes.'
              : 'Explore classroom schedules and tap the bookmark icon to add classes to your timetable.'}
          </p>
          {!isLoggedIn ? (
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors"
              >
                Sign In to Save Classes
              </button>
              <button
                onClick={loginAsStudentDemo}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition-colors"
              >
                Try Student Demo (Role: NON) to view 12 classes
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors"
            >
              <span>Find Classes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : viewMode === 'LIST' ? (
        /* ================= VIEW 1: LIST VIEW ================= */
        <div className="space-y-3 pt-1">
          {/* List Sub-header: 'Schedules' & 'Showing X of Y' */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-slate-900">Schedules</span>
            <span className="text-slate-400 font-medium">
              Showing {selectedScheduleIds.length} of {savedSchedules.length}
            </span>
          </div>

          {/* Select All Row */}
          <div className="flex items-center justify-between px-1 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
              />
              <span className="font-semibold">
                Select All ({savedSchedules.length})
              </span>
            </label>
            <span className="font-bold text-blue-600 text-xs">
              {totalHours} hours
            </span>
          </div>

          {/* Schedule Cards List */}
          <div className="space-y-3">
            {savedSchedules.map((schedule) => {
              const isChecked = selectedScheduleIds.includes(schedule.entityId);
              const slot = parseScheduleTime(schedule);
              const durationText = `${slot?.durationHours || 2}h`;

              return (
                <div
                  key={schedule.id}
                  className={`bg-white border rounded-2xl p-4 shadow-xs transition-all flex flex-col gap-2 ${
                    isChecked
                      ? 'border-blue-200/90 ring-1 ring-blue-500/10'
                      : 'border-slate-200/80 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSchedule(schedule.entityId)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 mt-1 cursor-pointer"
                      />
                      <div>
                        {schedule.courseCode && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-1">
                            {schedule.courseCode}
                          </span>
                        )}
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {schedule.title}
                        </h4>
                        <div className="flex flex-col gap-1 text-xs text-slate-500 mt-1.5">
                          <span className="flex items-center gap-1.5 font-medium text-slate-600">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            {slot?.dayName || 'Mon'} {slot?.formattedTime || schedule.subtitle || ''}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {schedule.roomName || schedule.building || 'LC4-210'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between h-full gap-4 shrink-0">
                      <span className="text-xs font-semibold text-slate-400">
                        {durationText}
                      </span>
                      {/* Active Bookmark Button to unsave */}
                      <BookmarkButton
                        entityId={schedule.entityId}
                        entityType="SCHEDULE"
                        title={schedule.title}
                        className="p-1 hover:bg-slate-100 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================= VIEW 2: CALENDAR TIMETABLE VIEW ================= */
        <div className="space-y-3 pt-1">
          {/* Date Range with < > Navigation */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-extrabold text-slate-900">
              14–18 September 2026
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekly Timetable Grid Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto [scrollbar-width:none]">
            <div className="min-w-[340px]">
              {/* Day Header Row */}
              <div className="grid grid-cols-[48px_repeat(5,1fr)] border-b border-slate-100 text-center py-2 bg-slate-50/60 text-xs">
                <div></div>
                {DAYS_HEADER.map((d) => (
                  <div key={d.dayOfWeek} className="flex flex-col items-center">
                    <span className="text-[10px] font-medium text-slate-400 uppercase">
                      {d.name}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {d.dateNum + weekOffset * 7}
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid Body with Absolute Event Blocks */}
              <div className="relative">
                {/* Horizontal hour lines */}
                {TIME_HOURS.map((h) => (
                  <div
                    key={h}
                    className="grid grid-cols-[48px_repeat(5,1fr)] border-b border-slate-100/90 text-slate-400 text-[10px] font-medium"
                    style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                  >
                    <div className="pr-2 text-right -mt-2.5">
                      {String(h).padStart(2, '0')}:00
                    </div>
                    {/* 5 Day column cells */}
                    <div className="border-l border-slate-100/70"></div>
                    <div className="border-l border-slate-100/70"></div>
                    <div className="border-l border-slate-100/70"></div>
                    <div className="border-l border-slate-100/70"></div>
                    <div className="border-l border-slate-100/70"></div>
                  </div>
                ))}

                {/* Event Blocks Overlay */}
                <div className="absolute inset-0 grid grid-cols-[48px_repeat(5,1fr)] pointer-events-none">
                  <div></div> {/* Time col spacing */}

                  {/* Columns for Mon (1) to Fri (5) */}
                  {DAYS_HEADER.map((dayCol) => {
                    const dayEvents = savedSchedules.filter((s) => {
                      // Only show schedules that are checked/selected
                      if (!selectedScheduleIds.includes(s.entityId)) return false;
                      const slot = parseScheduleTime(s);
                      return slot?.dayOfWeek === dayCol.dayOfWeek;
                    });

                    return (
                      <div
                        key={dayCol.dayOfWeek}
                        className="relative h-full pointer-events-auto"
                      >
                        {dayEvents.map((event) => {
                          const slot = parseScheduleTime(event);
                          if (!slot) return null;

                          const startMinutes = slot.startMinutes;
                          const endMinutes = slot.endMinutes;
                          const baseStart = START_HOUR * 60; // 08:00 = 480

                          const topPx =
                            ((startMinutes - baseStart) / 60) * HOUR_ROW_HEIGHT;
                          const heightPx =
                            ((endMinutes - startMinutes) / 60) * HOUR_ROW_HEIGHT;

                          const colors = getScheduleColor(event.courseCode);

                          return (
                            <div
                              key={event.id}
                              style={{
                                top: `${topPx}px`,
                                height: `${Math.max(34, heightPx - 2)}px`,
                              }}
                              className={`absolute left-0.5 right-0.5 p-1 rounded-lg ${colors.bg} ${colors.border} border border-l-3 border-l-current text-left overflow-hidden shadow-2xs transition-all hover:scale-[1.02] hover:z-20 cursor-pointer`}
                              title={`${event.courseCode || ''} ${event.title}\n${slot.formattedTime}\n${event.roomName || ''}`}
                            >
                              <p className={`text-[11px] font-black leading-tight ${colors.text}`}>
                                {event.courseCode || event.title}
                              </p>
                              {event.roomName && (
                                <p className="text-[9px] font-bold text-slate-600 truncate mt-0.5">
                                  {event.roomName}
                                </p>
                              )}
                              <p className="text-[8px] text-slate-500 font-medium">
                                {slot.formattedTime.replace(/\s+/g, '')}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Summary & Export Bar (Matches Figma Exactly) */}
      {savedSchedules.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3.5 shadow-lg flex flex-col gap-2.5 pointer-events-auto">
            {/* Summary Line */}
            <div className="flex items-center justify-between text-xs px-0.5">
              <span className="font-bold text-slate-900">
                {selectedScheduleIds.length} Classes in Timetable
              </span>
              <span className="text-slate-400 font-medium">Weekly</span>
            </div>

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExportTimetableIcs}
              disabled={selectedScheduleIds.length === 0}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Timetable to .ics</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
