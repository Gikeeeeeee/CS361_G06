import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookmarks } from '../../bookmarks/context/BookmarkContext';
import { BookmarkButton } from '../../bookmarks/components/BookmarkButton';
import { parseScheduleTime } from '../../bookmarks/utils/scheduleConflictUtils';
import {
  Calendar,
  Clock,
  MapPin,
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  User,
} from 'lucide-react';
import { Badge } from '../../../shared/components/Badge';
import type { BookmarkItem } from '../../bookmarks/types/bookmark.types';
import { AddToCalendarButton } from '../../../components/shared/AddToCalendarButton';
import { ScheduleDetailsModal } from '../../../components/shared/ScheduleDetailsModal';

function getScheduleType(schedule: BookmarkItem): 'COURSE' | 'EXAM' | 'ACTIVITY' {
  const t = (schedule.type || '').toUpperCase();
  if (t === 'EXAM') return 'EXAM';
  if (t === 'ACTIVITY') return 'ACTIVITY';
  if (t === 'COURSE') return 'COURSE';

  const code = (schedule.courseCode || '').toUpperCase();
  if (code === 'EXAM') return 'EXAM';
  if (code === 'ACTIVITY') return 'ACTIVITY';

  const title = (schedule.title || '').toLowerCase();
  if (title.includes('exam') || title.includes('สอบ')) return 'EXAM';
  if (
    title.includes('activity') ||
    title.includes('กิจกรรม') ||
    title === 'reserved' ||
    title === 'ไม่ว่าง'
  ) {
    return 'ACTIVITY';
  }

  if (code && code.length > 0) return 'COURSE';
  return 'COURSE';
}

const TIME_SLOTS = [
  { label: '08:00 - 09:30', start: '08:00', end: '09:30', type: 'class' },
  { label: '09:30 - 11:00', start: '09:30', end: '11:00', type: 'class' },
  { label: '11:00 - 12:30', start: '11:00', end: '12:30', type: 'class' },
  { label: '12:30 - 13:30', start: '12:30', end: '13:30', type: 'break', title: 'Lunch Break' },
  { label: '13:30 - 15:00', start: '13:30', end: '15:00', type: 'class' },
  { label: '15:00 - 16:30', start: '15:00', end: '16:30', type: 'class' },
];

const WEEK_DAYS = [
  { name: 'Mon', dayIndex: 1, full: 'Monday' },
  { name: 'Tue', dayIndex: 2, full: 'Tuesday' },
  { name: 'Wed', dayIndex: 3, full: 'Wednesday' },
  { name: 'Thu', dayIndex: 4, full: 'Thursday' },
  { name: 'Fri', dayIndex: 5, full: 'Friday' },
  { name: 'Sat', dayIndex: 6, full: 'Saturday' },
  { name: 'Sun', dayIndex: 0, full: 'Sunday' },
];

const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
};

function getScheduleSlotMatch(
  schedule: BookmarkItem,
  dayIndex: number,
  slot: { start: string; end: string }
): boolean {
  const parsed = parseScheduleTime(schedule);
  if (!parsed) return false;

  let matchesDay = false;
  if (parsed.dayOfWeek !== undefined) {
    matchesDay = parsed.dayOfWeek === dayIndex;
  } else if (schedule.startAt) {
    const d = new Date(schedule.startAt);
    if (!isNaN(d.getTime())) {
      matchesDay = d.getDay() === dayIndex;
    }
  }

  if (!matchesDay) return false;

  const slotStartM = timeToMinutes(slot.start);
  const slotEndM = timeToMinutes(slot.end);

  return parsed.startMinutes < slotEndM && parsed.endMinutes > slotStartM;
}

const toLocalDateString = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function doesScheduleMatchDate(schedule: BookmarkItem, date: Date): boolean {
  const targetDateStr = toLocalDateString(date);
  if (schedule.startAt) {
    if (schedule.startAt.startsWith(targetDateStr)) return true;
    const sDate = new Date(schedule.startAt);
    if (!isNaN(sDate.getTime()) && toLocalDateString(sDate) === targetDateStr) return true;
  }
  const slot = parseScheduleTime(schedule);
  if (slot?.dateStr === targetDateStr) return true;

  const recurrenceRule = (schedule as any).recurrence_rule || (schedule as any).recurrenceRule;
  if (recurrenceRule) {
    const byDayMatch = recurrenceRule.match(/BYDAY=([^;]+)/);
    if (byDayMatch) {
      const days = byDayMatch[1].split(',');
      const daysMap: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
      if (days.some((day: string) => daysMap[day] === date.getDay())) {
        return true;
      }
    }
  }

  if (getScheduleType(schedule) === 'COURSE' && slot?.dayOfWeek !== undefined) {
    return slot.dayOfWeek === date.getDay();
  }
  return false;
}

function CourseScheduleCard({
  schedule,
  onToast,
  onSelect,
}: {
  schedule: BookmarkItem;
  onToast?: (msg: string) => void;
  onSelect?: (schedule: BookmarkItem) => void;
}) {
  const slot = parseScheduleTime(schedule);
  const durationText = `${slot?.durationHours || 2}h`;

  return (
    <div
      onClick={() => onSelect?.(schedule)}
      className="bg-blue-50/90 border border-blue-200/80 border-l-4 border-l-blue-500 rounded-r-xl rounded-l-md p-3.5 shadow-xs transition-all hover:shadow-sm flex flex-col gap-2 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded text-blue-700 bg-blue-100">
              {schedule.courseCode || 'COURSE'}
            </span>
            <span className="flex items-center text-xs font-medium text-slate-600">
              <Clock className="w-3 h-3 text-blue-600 mr-1 shrink-0" />
              {slot?.dayName ? `${slot.dayName} ` : ''}
              {slot?.formattedTime || schedule.subtitle || ''}
            </span>
          </div>

          <h4 className="font-semibold text-sm text-slate-800 leading-snug">
            {schedule.title}
          </h4>

          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              {schedule.roomName || schedule.building || 'Room'}
            </span>
            {schedule.organizer && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{schedule.organizer}</span>
              </span>
            )}
          </div>
        </div>

        <span className="text-xs font-semibold text-slate-400 shrink-0">
          {durationText}
        </span>
      </div>

      {/* Action Buttons: Spacing gap-2.5 sm:gap-4, minimum 44x44px touch targets, tooltips & clear labels */}
      <div
        className="flex items-center justify-between gap-2.5 sm:gap-4 pt-3 border-t border-blue-100/80 flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        <AddToCalendarButton
          roomId={schedule.roomId}
          scheduleId={schedule.entityId}
          scheduleData={schedule}
          showText={true}
          align="left"
          buttonClassName="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          disabledClassName="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-not-allowed select-none transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          onExportSuccess={(type) =>
            onToast?.(
              type === 'GOOGLE'
                ? 'Opened in Google Calendar'
                : 'Downloaded .ics calendar file'
            )
          }
        />
        <BookmarkButton
          entityId={schedule.entityId}
          entityType="SCHEDULE"
          title={schedule.title}
          subtitle={slot?.formattedTime || schedule.subtitle}
          courseCode={schedule.courseCode}
          startAt={schedule.startAt}
          endAt={schedule.endAt}
          roomId={schedule.roomId}
          type={schedule.type || 'COURSE'}
          organizer={schedule.organizer}
          size={18}
          showText={true}
          className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
        />
      </div>
    </div>
  );
}

function OtherScheduleCard({
  schedule,
  onToast,
  onSelect,
}: {
  schedule: BookmarkItem;
  onToast?: (msg: string) => void;
  onSelect?: (schedule: BookmarkItem) => void;
}) {
  const slot = parseScheduleTime(schedule);
  const durationText = `${slot?.durationHours || 2}h`;
  const type = getScheduleType(schedule);

  return (
    <div
      onClick={() => onSelect?.(schedule)}
      className="w-full text-left bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs flex flex-col relative transition-all hover:shadow-sm cursor-pointer"
    >
      {/* Left accent bar matching Room Detail ExamCalendar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${type === 'EXAM' ? 'bg-amber-500' : 'bg-purple-500'
          }`}
      />

      <div className="flex items-start justify-between gap-3 pl-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge
              variant={type === 'EXAM' ? 'destructive' : 'default'}
              className={
                type === 'ACTIVITY'
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-100 border-none'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-none'
              }
            >
              {type}
            </Badge>
            <span className="flex items-center text-xs font-medium text-slate-500">
              <Clock className="w-3 h-3 text-slate-400 mr-1 shrink-0" />
              {slot?.dayName ? `${slot.dayName} ` : ''}
              {slot?.formattedTime || schedule.subtitle || ''}
            </span>
          </div>

          <h5 className="font-bold text-slate-800 text-sm leading-snug">
            {schedule.title}
          </h5>

          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              {schedule.roomName || schedule.building || 'Room'}
            </span>
            {schedule.organizer && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{schedule.organizer}</span>
              </span>
            )}
          </div>
        </div>

        <span className="text-xs font-semibold text-slate-400 shrink-0">
          {durationText}
        </span>
      </div>

      {/* Action Buttons: Spacing gap-2.5 sm:gap-4, minimum 44x44px touch targets, tooltips & clear labels */}
      <div
        className="flex items-center justify-between gap-2.5 sm:gap-4 pl-1.5 pt-3 border-t border-slate-100 flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        <AddToCalendarButton
          roomId={schedule.roomId}
          scheduleId={schedule.entityId}
          scheduleData={schedule}
          showText={true}
          align="left"
          buttonClassName="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          disabledClassName="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-not-allowed select-none transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          onExportSuccess={(type) =>
            onToast?.(
              type === 'GOOGLE'
                ? 'Opened in Google Calendar'
                : 'Downloaded .ics calendar file'
            )
          }
        />
        <BookmarkButton
          entityId={schedule.entityId}
          entityType="SCHEDULE"
          title={schedule.title}
          subtitle={slot?.formattedTime || schedule.subtitle}
          courseCode={schedule.courseCode || type}
          startAt={schedule.startAt}
          endAt={schedule.endAt}
          roomId={schedule.roomId}
          type={type}
          organizer={schedule.organizer}
          size={18}
          showText={true}
          className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
        />
      </div>
    </div>
  );
}

export default function SavedPage() {
  const navigate = useNavigate();
  const { bookmarks, isLoggedIn } = useBookmarks();

  // View switcher: LIST ('LIST') vs TIMETABLE CALENDAR ('CALENDAR')
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');
  // Category filter: 'ALL' | 'COURSE' | 'OTHER' (matching Room Detail segmented control)
  const [scheduleCategory, setScheduleCategory] = useState<'ALL' | 'COURSE' | 'OTHER'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<BookmarkItem | null>(null);

  // Month Calendar & Day Selection State (matching Room Detail ExamCalendar)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const selectedDateStr = useMemo(() => toLocalDateString(selectedDate), [selectedDate]);
  const todayStr = useMemo(() => toLocalDateString(today), [today]);

  // Day selection for Course Timetable (1=Mon, 2=Tue, ..., 6=Sat, 0=Sun)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 1 : d;
  });
  // Sub-toggle for 'ALL' category in Calendar mode: 'COURSE' vs 'OTHER'
  const [calendarSubView, setCalendarSubView] = useState<'COURSE' | 'OTHER'>('COURSE');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleViewModeChange = (mode: 'LIST' | 'CALENDAR') => {
    if (mode === 'CALENDAR') {
      if (scheduleCategory === 'OTHER') {
        setCalendarSubView('OTHER');
      } else {
        setCalendarSubView('COURSE');
      }
    } else {
      if (calendarSubView === 'OTHER') {
        setScheduleCategory('OTHER');
      } else if (scheduleCategory === 'OTHER') {
        setScheduleCategory('COURSE');
      }
    }
    setViewMode(mode);
  };

  const handleCategoryChange = (cat: 'ALL' | 'COURSE' | 'OTHER') => {
    setScheduleCategory(cat);
    if (cat === 'COURSE' || cat === 'OTHER') {
      setCalendarSubView(cat);
    }
  };

  const handleCalendarSubViewChange = (sub: 'COURSE' | 'OTHER') => {
    setCalendarSubView(sub);
    setScheduleCategory(sub);
  };

  // Only keep SCHEDULE items for Timetable
  const savedSchedules = useMemo(
    () => bookmarks.filter((b) => b.entityType === 'SCHEDULE'),
    [bookmarks]
  );

  // Separate schedules into Courses vs Exams & Activities (matching Room Detail)
  const { courseSchedules, otherSchedules } = useMemo(() => {
    const courses: BookmarkItem[] = [];
    const others: BookmarkItem[] = [];
    for (const s of savedSchedules) {
      if (getScheduleType(s) === 'COURSE') {
        courses.push(s);
      } else {
        others.push(s);
      }
    }
    return { courseSchedules: courses, otherSchedules: others };
  }, [savedSchedules]);

  const visibleSchedules = useMemo(() => {
    if (viewMode === 'CALENDAR') {
      return calendarSubView === 'COURSE' ? courseSchedules : otherSchedules;
    }
    if (scheduleCategory === 'COURSE') return courseSchedules;
    if (scheduleCategory === 'OTHER') return otherSchedules;
    return savedSchedules;
  }, [viewMode, calendarSubView, scheduleCategory, courseSchedules, otherSchedules, savedSchedules]);

  // Calendar Grid for currentMonth (matching Room Detail ExamCalendar)
  const daysGrid = useMemo(() => {
    const days: Date[] = [];
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const startOffset = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - startOffset);

    const endOffset = 6 - monthEnd.getDay();
    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(gridEnd.getDate() + endOffset);

    const current = new Date(gridStart);
    while (current <= gridEnd) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const getEventMarker = (d: Date): string | null => {
    const matching = visibleSchedules.filter((s) => doesScheduleMatchDate(s, d));
    if (matching.length === 0) return null;
    if (matching.some((s) => getScheduleType(s) === 'EXAM')) return 'bg-amber-500';
    if (matching.some((s) => getScheduleType(s) === 'ACTIVITY')) return 'bg-purple-500';
    return 'bg-blue-500';
  };

  const selectedDateEvents = useMemo(() => {
    return visibleSchedules.filter((s) => doesScheduleMatchDate(s, selectedDate));
  }, [visibleSchedules, selectedDate]);

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto space-y-4 pb-24 min-h-full flex flex-col bg-slate-50/50">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in">
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
            onClick={() => handleViewModeChange('LIST')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'LIST'
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
            onClick={() => handleViewModeChange('CALENDAR')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'CALENDAR'
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



      {/* EMPTY / GUEST STATE */}
      {savedSchedules.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xs my-6">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            {!isLoggedIn ? 'Your Timetable is Empty' : 'No Saved Classes Yet'}
          </h3>
          <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto leading-relaxed">
            {!isLoggedIn
              ? 'Sign in to save your classes and keep your weekly schedule organized.'
              : 'Browse classrooms to find your courses and add them to your timetable.'}
          </p>
          {!isLoggedIn ? (
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Sign In to Save Classes
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors"
            >
              <span>Explore Classes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : viewMode === 'LIST' ? (
        /* ================= VIEW 1: LIST VIEW ================= */
        <div className="space-y-3.5 pt-1">
          {/* Segmented Control matching Room Detail page */}
          <div className="flex bg-slate-200/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleCategoryChange('ALL')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${scheduleCategory === 'ALL'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              All ({savedSchedules.length})
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange('COURSE')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${scheduleCategory === 'COURSE'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Courses ({courseSchedules.length})
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange('OTHER')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap text-center ${scheduleCategory === 'OTHER'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Event & Exam ({otherSchedules.length})
            </button>
          </div>

          {/* Categorized Schedule Lists matching Room Detail layout */}
          {scheduleCategory === 'ALL' ? (
            <div className="space-y-4">
              {/* Courses Section */}
              {courseSchedules.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="font-bold text-slate-800">
                        Courses ({courseSchedules.length})
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {courseSchedules.map((schedule) => (
                      <CourseScheduleCard
                        key={schedule.id}
                        schedule={schedule}
                        onToast={showToast}
                        onSelect={setSelectedSchedule}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Exams & Activities Section */}
              {otherSchedules.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="font-bold text-slate-800">
                        Event & Exam ({otherSchedules.length})
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {otherSchedules.map((schedule) => (
                      <OtherScheduleCard
                        key={schedule.id}
                        schedule={schedule}
                        onToast={showToast}
                        onSelect={setSelectedSchedule}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : scheduleCategory === 'COURSE' ? (
            <div className="space-y-2.5">
              {courseSchedules.length > 0 ? (
                courseSchedules.map((schedule) => (
                  <CourseScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    onToast={showToast}
                    onSelect={setSelectedSchedule}
                  />
                ))
              ) : (
                <div className="bg-white rounded-xl shadow-xs p-6 text-center border border-slate-200/80">
                  <p className="text-xs text-slate-500">No courses in your saved list.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {otherSchedules.length > 0 ? (
                otherSchedules.map((schedule) => (
                  <OtherScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    onToast={showToast}
                    onSelect={setSelectedSchedule}
                  />
                ))
              ) : (
                <div className="bg-white rounded-xl shadow-xs p-6 text-center border border-slate-200/80">
                  <p className="text-xs text-slate-500">No events or exams in your saved list.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ================= VIEW 2: CALENDAR VIEW (MATCHING ROOM DETAIL) ================= */
        <div className="space-y-4 pt-1">
          {/* Calendar View Filter Bar: Course vs Event & Exam */}
          <div className="flex bg-slate-200/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleCalendarSubViewChange('COURSE')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                calendarSubView === 'COURSE'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Course ({courseSchedules.length})
            </button>
            <button
              type="button"
              onClick={() => handleCalendarSubViewChange('OTHER')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap text-center ${
                calendarSubView === 'OTHER'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Event & Exam ({otherSchedules.length})
            </button>
          </div>

          {/* Render Course Timetable (Day-by-Day timeline) for Courses */}
          {calendarSubView === 'COURSE' ? (
            <div className="space-y-4">
              {/* DAY-BY-DAY SCHEDULE TIMELINE (MATCHING ROOM DETAIL CourseTimetable) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{WEEK_DAYS.find((d) => d.dayIndex === selectedDayIndex)?.full || 'Day'} Schedule</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {courseSchedules.filter((sched) => {
                      const p = parseScheduleTime(sched);
                      return p?.dayOfWeek === selectedDayIndex;
                    }).length} Class(es)
                  </span>
                </div>

                {/* Day Selector Pills on Top matching Room Detail */}
                <div className="flex space-x-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {WEEK_DAYS.map((day) => {
                    const isSelected = selectedDayIndex === day.dayIndex;
                    return (
                      <button
                        key={day.name}
                        type="button"
                        onClick={() => setSelectedDayIndex(day.dayIndex)}
                        className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/70'
                          }`}
                      >
                        {day.name}
                      </button>
                    );
                  })}
                </div>

                {/* Slots List for Selected Day */}
                <div className="space-y-2 pt-1">
                  {TIME_SLOTS.map((slot, idx) => {
                    const getCoursesForSlot = (sl: typeof TIME_SLOTS[0]) => {
                      return courseSchedules.filter((sched) => getScheduleSlotMatch(sched, selectedDayIndex, sl));
                    };

                    const overlappingCourses = getCoursesForSlot(slot);
                    const prevCourses = idx > 0 ? getCoursesForSlot(TIME_SLOTS[idx - 1]) : [];
                    const nextCourses = idx < TIME_SLOTS.length - 1 ? getCoursesForSlot(TIME_SLOTS[idx + 1]) : [];

                    const isBreak = slot.type === 'break';
                    const event = overlappingCourses.length > 0 ? overlappingCourses[0] : null;
                    const isSameAsPrev =
                      event &&
                      !isBreak &&
                      TIME_SLOTS[idx - 1]?.type !== 'break' &&
                      prevCourses.some((p) => p.entityId === event.entityId);
                    const isSameAsNext =
                      event &&
                      !isBreak &&
                      TIME_SLOTS[idx + 1]?.type !== 'break' &&
                      nextCourses.some((n) => n.entityId === event.entityId);

                    return (
                      <div key={idx}>
                        {idx > 0 && !isSameAsPrev && <div className="h-1.5" />}

                        <div className="flex flex-row space-x-2.5">
                          <div className="w-14 flex-shrink-0 text-right pt-1">
                            <div className="text-xs font-bold text-slate-700">{slot.start}</div>
                            <div className="text-[10px] text-slate-400 leading-tight">{slot.end}</div>
                          </div>

                          <div className="flex-1 min-w-0">
                            {isBreak ? (
                              <div className="flex items-center justify-center py-2 h-full min-h-[44px] bg-slate-100 border border-slate-200 border-dashed rounded-xl">
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                                  {slot.title}
                                </span>
                              </div>
                            ) : event ? (
                              <div
                                onClick={() => setSelectedSchedule(event)}
                                className={`bg-blue-50 border-l-4 border-blue-500 flex flex-col justify-start h-full min-h-[44px] transition-all cursor-pointer ${!isSameAsPrev && !isSameAsNext ? 'rounded-r-xl rounded-l-xs shadow-xs' : ''
                                  } ${isSameAsPrev && isSameAsNext ? 'border-y-0 rounded-none' : ''} ${!isSameAsPrev && isSameAsNext ? 'rounded-tr-xl rounded-br-none border-b-0' : ''
                                  } ${isSameAsPrev && !isSameAsNext ? 'rounded-br-xl rounded-tr-none border-t-0 shadow-xs' : ''} ${!isSameAsPrev ? 'p-3' : 'px-3 pb-3 pt-0'
                                  }`}
                              >
                                {!isSameAsPrev && (
                                  <>
                                    <div className="flex justify-between items-start mb-1.5">
                                      <span className="text-xs font-bold px-2 py-0.5 rounded text-blue-700 bg-blue-100">
                                        {event.courseCode || 'COURSE'}
                                      </span>
                                      <div
                                        className="flex items-center gap-2 shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <AddToCalendarButton
                                          roomId={event.roomId}
                                          scheduleId={event.entityId}
                                          scheduleData={event}
                                          showText={false}
                                          buttonClassName="min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-blue-200/90 bg-white hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                          disabledClassName="min-h-[44px] px-2.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-not-allowed select-none transition-all flex items-center justify-center gap-1 shadow-2xs"
                                          onExportSuccess={(type) =>
                                            showToast(
                                              type === 'GOOGLE'
                                                ? 'Opened in Google Calendar'
                                                : 'Downloaded .ics calendar file'
                                            )
                                          }
                                        />
                                        <BookmarkButton
                                          entityId={event.entityId}
                                          entityType="SCHEDULE"
                                          title={event.title}
                                          subtitle={event.subtitle}
                                          courseCode={event.courseCode}
                                          startAt={event.startAt}
                                          endAt={event.endAt}
                                          roomId={event.roomId}
                                          type={event.type || 'COURSE'}
                                          organizer={event.organizer}
                                          size={18}
                                          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-blue-200/90 bg-white hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                        />
                                      </div>
                                    </div>
                                    <h4 className="font-semibold text-sm text-slate-800 leading-snug">
                                      {event.title}
                                    </h4>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                        {event.roomName || event.building || 'Room'}
                                      </span>
                                      {event.organizer && (
                                        <span className="flex items-center gap-1">
                                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                                          <span className="truncate">{event.organizer}</span>
                                        </span>
                                      )}
                                    </div>
                                  </>
                                )}
                                {isSameAsPrev && <div className="min-h-[16px]" />}
                              </div>
                            ) : (
                              <div className="h-full min-h-[44px] border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-white">
                                <span className="text-[11px] text-slate-400 font-medium">Available</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Render Month Calendar Grid (ExamCalendar style) for Events & Exams */
            <div className="space-y-4">
              {/* Calendar Grid Card (matching Room Detail ExamCalendar) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4">
                {/* Calendar Header */}
                <div className="flex justify-between items-center mb-4 px-1">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h4>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                        setSelectedDate(today);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 rounded-lg transition-colors text-slate-600 cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Weekday Labels */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                    <div key={i} className="text-center text-xs font-semibold text-slate-400">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                  {daysGrid.map((d, i) => {
                    const dStr = toLocalDateString(d);
                    const isSelected = dStr === selectedDateStr;
                    const isToday = dStr === todayStr;
                    const marker = getEventMarker(d);
                    const isCurrentMonth = d.getMonth() === currentMonth.getMonth();

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedDate(d)}
                        className={`
                          relative flex items-center justify-center h-10 w-full rounded-xl text-sm transition-all cursor-pointer
                          ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700 hover:bg-slate-50'}
                          ${isSelected ? 'bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md z-10' : ''}
                          ${!isSelected && isToday ? 'border border-blue-300 text-blue-600 font-bold' : ''}
                        `}
                      >
                        <span>{d.getDate()}</span>
                        {!isSelected && marker && (
                          <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${marker}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Agenda List Below Calendar matching Room Detail */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between px-1">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {selectedDateStr === todayStr
                        ? "Today's Schedule"
                        : selectedDate.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      ({selectedDateEvents.length})
                    </span>
                  </h4>
                </div>

                {selectedDateEvents.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedDateEvents.map((schedule) =>
                      getScheduleType(schedule) === 'COURSE' ? (
                        <CourseScheduleCard
                          key={schedule.id}
                          schedule={schedule}
                          onToast={showToast}
                          onSelect={setSelectedSchedule}
                        />
                      ) : (
                        <OtherScheduleCard
                          key={schedule.id}
                          schedule={schedule}
                          onToast={showToast}
                          onSelect={setSelectedSchedule}
                        />
                      )
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-xs p-8 text-center border border-slate-200/80 border-dashed">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Calendar className="w-6 h-6 text-slate-400" />
                    </div>
                    <h5 className="font-bold text-slate-700 text-sm">No classes or events scheduled</h5>
                    <p className="text-xs text-slate-400 mt-1">There are no saved classes or events on this date.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schedule Details Modal */}
      <ScheduleDetailsModal
        isOpen={Boolean(selectedSchedule)}
        onClose={() => setSelectedSchedule(null)}
        schedule={selectedSchedule}
        onToast={showToast}
      />
    </div>
  );
}


