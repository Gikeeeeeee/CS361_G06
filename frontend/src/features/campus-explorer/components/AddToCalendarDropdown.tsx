import { useState, useRef, useEffect } from 'react';
import { CalendarPlus, Download, ExternalLink, Loader2, ChevronDown, Check } from 'lucide-react';
import {
  exportScheduleToGoogleCalendar,
  exportScheduleToIcsFile,
} from '../services/icsExportService';
import { useExportedSchedules } from '../hooks/useExportedSchedules';

interface AddToCalendarDropdownProps {
  schedule: any;
  buttonClassName?: string;
  disabledClassName?: string;
  align?: 'left' | 'right';
  menuPlacement?: 'bottom' | 'top';
  iconClassName?: string;
  chevronClassName?: string;
  textClassName?: string;
  iconOnly?: boolean;
  showText?: boolean;
  onExportSuccess?: (type: 'GOOGLE' | 'ICS') => void;
}

export function AddToCalendarDropdown({
  schedule,
  buttonClassName = '',
  disabledClassName = '',
  align = 'right',
  menuPlacement = 'bottom',
  iconClassName = '',
  chevronClassName = '',
  textClassName = '',
  iconOnly = true,
  showText = false,
  onExportSuccess,
}: AddToCalendarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<'GOOGLE' | 'ICS' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isExported, markAsExported } = useExportedSchedules();

  const isAlreadyExported = isExported(schedule);
  const shouldShowText = showText || !iconOnly;

  // Close dropdown on click outside
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

  const handleExportGoogle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingType('GOOGLE');
    try {
      const ok = await exportScheduleToGoogleCalendar(schedule);
      if (ok !== false) {
        markAsExported(schedule);
        onExportSuccess?.('GOOGLE');
      }
    } finally {
      setLoadingType(null);
      setIsOpen(false);
    }
  };

  const handleExportIcs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingType('ICS');
    try {
      const ok = await exportScheduleToIcsFile(schedule);
      if (ok !== false) {
        markAsExported(schedule);
        onExportSuccess?.('ICS');
      }
    } finally {
      setLoadingType(null);
      setIsOpen(false);
    }
  };

  // Render disabled state if already exported to prevent duplicate imports
  if (isAlreadyExported) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Already added to calendar"
        className={
          disabledClassName ||
          (shouldShowText
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
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        disabled={loadingType !== null}
        className={
          buttonClassName ||
          (shouldShowText
            ? 'min-h-[44px] px-3.5 py-2.5 rounded-xl text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-2xs font-semibold text-xs'
            : 'min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-slate-600 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200/90 hover:border-blue-200 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs')
        }
      >
        {loadingType ? (
          <Loader2 className={`w-4 h-4 animate-spin ${iconClassName || 'text-blue-600'}`} />
        ) : (
          <CalendarPlus className={`w-4 h-4 shrink-0 ${iconClassName || 'text-blue-600'}`} />
        )}
        {shouldShowText && (
          <>
            <span className={textClassName || "text-xs font-semibold"}>Add to Calendar</span>
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${chevronClassName || 'text-slate-400'}`} />
          </>
        )}
      </button>


      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${
            menuPlacement === 'top'
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
}
