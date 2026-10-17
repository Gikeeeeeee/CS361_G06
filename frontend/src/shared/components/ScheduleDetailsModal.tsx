import React, { useMemo } from 'react';
import { Calendar, Clock, MapPin, User, Info, X } from 'lucide-react';
import { Badge } from './Badge';
import { BookmarkButton } from '../../features/bookmarks/components/BookmarkButton';
import { AddToCalendarButton } from './AddToCalendarButton';

export interface ScheduleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: any | null;
  roomId?: string;
  onToast?: (msg: string) => void;
}

const isMaskedSchedule = (event?: any): boolean => {
  if (!event) return false;
  if (event.visibility === 'INTERNAL') return true;
  const t = (event.title || '').trim().toLowerCase();
  return t === 'reserved' || t === 'ไม่ว่าง';
};

const formatTime = (timeStr?: string) => {
  if (!timeStr) return '';
  if (timeStr.includes('T')) return timeStr.split('T')[1].substring(0, 5);
  if (timeStr.includes(' ')) return timeStr.split(' ')[1].substring(0, 5);
  return timeStr;
};

export const ScheduleDetailsModal: React.FC<ScheduleDetailsModalProps> = ({
  isOpen,
  onClose,
  schedule,
  roomId: propRoomId,
  onToast,
}) => {
  if (!isOpen || !schedule) return null;

  const isMasked = isMaskedSchedule(schedule);

  // Normalize Schedule ID
  const scheduleId = String(
    schedule.entityId || schedule.id || schedule.scheduleId || ''
  );

  // Normalize Room details
  const roomId =
    schedule.roomId ||
    schedule.room_id ||
    propRoomId ||
    schedule.roomName ||
    schedule.building ||
    'room-uuid-1';

  const roomDisplay =
    schedule.roomName && schedule.building
      ? `${schedule.roomName} (${schedule.building})`
      : schedule.roomName ||
        schedule.building ||
        schedule.location ||
        (roomId !== 'room-uuid-1' ? `Room ${roomId}` : 'Campus Room');

  // Normalize Basic Fields
  const title = schedule.title || 'Schedule Details';
  const courseCode = schedule.courseCode || schedule.course_code;
  const organizer = schedule.organizer || schedule.instructor;
  const description =
    schedule.description ||
    (schedule.subtitle && !schedule.subtitle.includes(':')
      ? schedule.subtitle
      : undefined);

  // Normalize Schedule Type
  const rawType = (schedule.type || (courseCode ? 'COURSE' : 'ACTIVITY')).toUpperCase();
  const type: 'COURSE' | 'EXAM' | 'ACTIVITY' =
    rawType === 'EXAM' ? 'EXAM' : rawType === 'ACTIVITY' ? 'ACTIVITY' : 'COURSE';

  // Normalize Dates & Times
  const startAt = schedule.startAt || schedule.start_at;
  const endAt = schedule.endAt || schedule.end_at;

  const formattedDate = useMemo(() => {
    if (!startAt) return '';
    const d = new Date(startAt);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [startAt]);

  const formattedTimeRange = useMemo(() => {
    const s = formatTime(startAt);
    const e = formatTime(endAt);
    if (s && e) return `${s} - ${e}`;
    if (s) return s;
    return schedule.subtitle || '';
  }, [startAt, endAt, schedule.subtitle]);

  // Construct normalized schedule object for AddToCalendarButton
  const exportPayload = useMemo(() => {
    return {
      ...schedule,
      id: scheduleId,
      entityId: scheduleId,
      scheduleId: scheduleId,
      roomId: roomId,
      room_id: roomId,
      roomName: schedule.roomName || roomDisplay,
      building: schedule.building,
      title: title,
      courseCode: courseCode,
      course_code: courseCode,
      startAt: startAt,
      start_at: startAt,
      endAt: endAt,
      end_at: endAt,
      description: description,
      organizer: organizer,
      type: type,
    };
  }, [
    schedule,
    scheduleId,
    roomId,
    roomDisplay,
    title,
    courseCode,
    startAt,
    endAt,
    description,
    organizer,
    type,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`px-6 py-5 border-b rounded-t-2xl flex justify-between items-center ${
            isMasked
              ? 'bg-slate-100 border-slate-200'
              : type === 'EXAM'
              ? 'bg-amber-500/10 border-amber-100'
              : type === 'ACTIVITY'
              ? 'bg-purple-500/10 border-purple-100'
              : 'bg-blue-500/10 border-blue-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl ${
                isMasked
                  ? 'bg-slate-600 text-white'
                  : type === 'EXAM'
                  ? 'bg-amber-500 text-white'
                  : type === 'ACTIVITY'
                  ? 'bg-purple-500 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <Badge
                variant={isMasked ? 'outline' : type === 'EXAM' ? 'destructive' : 'default'}
                className={
                  isMasked
                    ? 'bg-white text-slate-700 border-slate-300'
                    : type === 'ACTIVITY'
                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-100 border-none'
                    : type === 'EXAM'
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-none'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-none'
                }
              >
                {isMasked ? 'Reserved / ไม่ว่าง' : type}
              </Badge>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-xl font-bold text-slate-900 leading-snug">{title}</h3>
            {courseCode && !isMasked && (
              <span className="inline-block text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md mt-1.5 border border-blue-100">
                {courseCode}
              </span>
            )}
          </div>

          <div className="space-y-4 pt-1">
            {/* Time & Date */}
            {formattedTimeRange && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-xl text-slate-500 border border-slate-100">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Time
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formattedTimeRange}
                  </p>
                  {formattedDate && (
                    <p className="text-xs text-slate-500 mt-0.5">{formattedDate}</p>
                  )}
                </div>
              </div>
            )}

            {/* Room / Location */}
            {roomDisplay && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-xl text-slate-500 border border-slate-100">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Location
                  </p>
                  <p className="text-sm font-semibold text-slate-800">{roomDisplay}</p>
                </div>
              </div>
            )}

            {/* Masked / Internal Alert */}
            {isMasked && (
              <div className="flex items-start gap-3 pt-1">
                <div className="p-2 bg-slate-50 rounded-xl text-slate-500 border border-slate-100">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Visibility
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    รายการนี้เป็นการจองภายใน หรือข้อมูลถูกสงวนไว้ (Internal / Reserved schedule)
                  </p>
                </div>
              </div>
            )}

            {/* Organizer */}
            {organizer && !isMasked && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-xl text-slate-500 border border-slate-100">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Organizer
                  </p>
                  <p className="text-sm font-semibold text-slate-800">{organizer}</p>
                </div>
              </div>
            )}

            {/* Description / Details */}
            {description && !isMasked && (
              <div className="flex items-start gap-3 pt-1">
                <div className="p-2 bg-slate-50 rounded-xl text-slate-500 border border-slate-100">
                  <Info className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Details
                  </p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/90 rounded-b-2xl flex items-center justify-between gap-3">
          {/* US3 Unified "Add to Calendar" button */}
          <AddToCalendarButton
            roomId={roomId}
            scheduleId={scheduleId}
            scheduleData={exportPayload}
            showText={true}
            align="left"
            menuPlacement="top"
            buttonClassName="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            disabledClassName="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold cursor-not-allowed select-none transition-all shadow-2xs"
            iconClassName="text-white"
            chevronClassName="text-white/80"
            textClassName="text-sm font-semibold"
            onExportSuccess={(exportType) => {
              onToast?.(
                exportType === 'GOOGLE'
                  ? 'Opened in Google Calendar'
                  : 'Downloaded .ics calendar file'
              );
            }}
          />

          {/* Secondary Action: Save/Bookmark button */}
          <BookmarkButton
            entityId={scheduleId}
            entityType="SCHEDULE"
            title={title}
            subtitle={formattedTimeRange}
            courseCode={courseCode || (isMasked ? 'Reserved' : type)}
            startAt={startAt}
            endAt={endAt}
            roomId={roomId}
            roomName={schedule.roomName}
            building={schedule.building}
            type={type}
            organizer={organizer}
            size={16}
            showText={true}
            textClassName="text-sm font-medium"
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors shadow-2xs cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
