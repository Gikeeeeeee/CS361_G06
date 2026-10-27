import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CalendarPlus, Download, ExternalLink, Loader2, ChevronDown, Check } from 'lucide-react';
import {
  fetchScheduleDetail,
  buildGoogleCalendarUrl,
  downloadIcsEvent,
  type IcsEventOptions,
} from '../../features/campus-explorer/services/icsExportService';
import { useExportedSchedules } from '../../features/campus-explorer/hooks/useExportedSchedules';

export interface AddToCalendarButtonProps {
  roomId?: string;
  scheduleId?: string | number;
  scheduleData?: any;
  buttonClassName?: string;
  disabledClassName?: string;
  align?: 'left' | 'right';
  menuPlacement?: 'bottom' | 'top';
  iconClassName?: string;
  chevronClassName?: string;
  textClassName?: string;
  showText?: boolean;
  onExportSuccess?: (type: 'GOOGLE' | 'ICS') => void;
}

/**
 * Shared AddToCalendarButton Component (US3 Single Source of Truth)
 * 
 * Encapsulates the entire export logic:
 * - Accepts `roomId` and `scheduleId` (with optional fallback `scheduleData`).
 * - "Google Calendar": Fetches data from GET /api/v1/rooms/{roomId}/schedules/{scheduleId},
 *   constructs the action=TEMPLATE URL, and opens it in a new tab.
 * - "Outlook / Apple Calendar (.ics)": Fetches data, generates RFC 5545 string
 *   (including UID:${scheduleId}@campus-explorer.app), and triggers a browser download.
 * - Prevents duplicate exports via localStorage tracking with "Added ✓" disabled state.
 */
export const AddToCalendarButton: React.FC<AddToCalendarButtonProps> = ({
  roomId: propRoomId,
  scheduleId: propScheduleId,
  scheduleData,
  buttonClassName = '',
  disabledClassName = '',
  align = 'right',
  menuPlacement = 'bottom',
  iconClassName = '',
  chevronClassName = '',
  textClassName = '',
  showText = false,
  onExportSuccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<'GOOGLE' | 'ICS' | null>(null);
  const [computedPlacement, setComputedPlacement] = useState<'bottom' | 'top'>(menuPlacement);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isExported, markAsExported } = useExportedSchedules();

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 220 && rect.top > 220) {
        setComputedPlacement('top');
      } else {
        setComputedPlacement(menuPlacement);
      }
    }
  }, [isOpen, menuPlacement]);

  // Resolve scheduleId and roomId from props or fallback scheduleData
  const scheduleId = useMemo(() => {
    const raw =
      propScheduleId ??
      scheduleData?.entityId ??
      scheduleData?.id ??
      scheduleData?.scheduleId;
    return raw ? String(raw).trim() : '';
  }, [propScheduleId, scheduleData]);

  const roomId = useMemo(() => {
    const raw =
      propRoomId ||
      scheduleData?.roomId ||
      scheduleData?.room_id ||
      scheduleData?.roomName ||
      scheduleData?.building ||
      'room-uuid-1';
    return String(raw).trim();
  }, [propRoomId, scheduleData]);

  // Check if this schedule has already been exported
  const alreadyExported = useMemo(() => {
    if (!scheduleId) return false;
    return isExported(scheduleId);
  }, [scheduleId, isExported]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  /**
   * Fetch fresh details from GET /api/v1/rooms/{roomId}/schedules/{scheduleId}
   * with fallback to local scheduleData
   */
  const resolveEventOptions = async (): Promise<IcsEventOptions> => {
    let detail: any = null;
    if (roomId && scheduleId) {
      try {
        detail = await fetchScheduleDetail(roomId, scheduleId);
      } catch (err) {
        console.warn(
          `[AddToCalendarButton] Could not fetch fresh schedule details (${roomId}/${scheduleId}), falling back to local data:`,
          err
        );
      }
    }

    const title =
      detail?.title || scheduleData?.title || 'Schedule Details';
    const startAt =
      detail?.start_at || scheduleData?.startAt || scheduleData?.start_at || new Date().toISOString();
    const endAt =
      detail?.end_at || scheduleData?.endAt || scheduleData?.end_at;
    const courseCode =
      detail?.course_code || scheduleData?.courseCode || scheduleData?.course_code;
    const description =
      detail?.description || scheduleData?.description || scheduleData?.subtitle || 'Exported from KU Long Campus Explorer';
    const organizer =
      detail?.organizer || scheduleData?.organizer || 'KU Long';
    const type =
      detail?.type || scheduleData?.type;
    const timeZone =
      detail?.time_zone || scheduleData?.time_zone || 'Asia/Bangkok';

    const roomObj = detail?.room || {
      id: roomId,
      name: scheduleData?.roomName || detail?.room_name,
      building_name: scheduleData?.building || detail?.building_name,
    };

    return {
      id: scheduleId,
      scheduleId: scheduleId,
      title,
      start_at: startAt,
      end_at: endAt,
      course_code: courseCode,
      description,
      organizer,
      time_zone: timeZone,
      type,
      room: roomObj,
    };
  };

  // Google Calendar handler
  const handleExportGoogle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoadingType('GOOGLE');
    try {
      const eventOptions = await resolveEventOptions();
      const url = buildGoogleCalendarUrl(eventOptions);
      window.open(url, '_blank', 'noopener,noreferrer');
      if (scheduleId) {
        markAsExported(scheduleId);
      }
      onExportSuccess?.('GOOGLE');
    } catch (err) {
      console.error('[AddToCalendarButton] Failed to export to Google Calendar:', err);
    } finally {
      setLoadingType(null);
      setIsOpen(false);
    }
  };

  // Outlook / Apple (.ics) handler
  const handleExportIcs = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoadingType('ICS');
    try {
      const eventOptions = await resolveEventOptions();
      downloadIcsEvent(eventOptions);
      if (scheduleId) {
        markAsExported(scheduleId);
      }
      onExportSuccess?.('ICS');
    } catch (err) {
      console.error('[AddToCalendarButton] Failed to export to .ics:', err);
    } finally {
      setLoadingType(null);
      setIsOpen(false);
    }
  };

  // If already exported, display disabled state to prevent duplicate imports
  if (alreadyExported) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Already added to calendar"
        className={
          disabledClassName ||
          (showText
            ? 'min-h-[44px] px-3.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-not-allowed select-none transition-all inline-flex items-center justify-center gap-1.5 shadow-2xs'
            : 'min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-not-allowed select-none transition-all inline-flex items-center justify-center gap-1 shadow-2xs')
        }
      >
        <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
        <span>Added ✓</span>
      </button>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        title="Add to Calendar"
        aria-label="Add to Calendar"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        disabled={loadingType !== null}
        className={
          buttonClassName ||
          (showText
            ? 'min-h-[44px] px-3.5 py-2.5 rounded-xl text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-2xs font-semibold text-xs'
            : 'min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-slate-600 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200/90 hover:border-blue-200 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs')
        }
      >
        {loadingType ? (
          <Loader2 className={`w-4 h-4 animate-spin ${iconClassName || 'text-blue-600'}`} />
        ) : (
          <CalendarPlus className={`w-4 h-4 shrink-0 ${iconClassName || 'text-blue-600'}`} />
        )}
        {showText && (
          <>
            <span className={textClassName || 'text-xs font-semibold'}>Add to Calendar</span>
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${chevronClassName || 'text-slate-400'}`} />
          </>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${
            computedPlacement === 'top'
              ? 'bottom-full mb-2 origin-bottom'
              : 'mt-1.5 origin-top'
          } w-60 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-slate-100">
            <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
              Add to Calendar
            </p>
          </div>

          <div className="p-1 space-y-0.5">
            {/* 1. Google Calendar Option */}
            <button
              type="button"
              onClick={handleExportGoogle}
              disabled={loadingType !== null}
              className="w-full flex items-center justify-between px-3 py-2 text-left rounded-xl hover:bg-blue-50/70 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800">Google Calendar</div>
                  <div className="text-[10px] text-slate-400">Open in new tab</div>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 ml-2" />
            </button>

            {/* 2. Outlook / Apple Calendar (.ics) Option */}
            <button
              type="button"
              onClick={handleExportIcs}
              disabled={loadingType !== null}
              className="w-full flex items-center justify-between px-3 py-2 text-left rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                  <Download className="w-4 h-4 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800">Outlook / Apple (.ics)</div>
                  <div className="text-[10px] text-slate-400">Download calendar file</div>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 ml-2" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
