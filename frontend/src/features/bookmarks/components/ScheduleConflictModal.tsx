import React from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import type { BookmarkItem } from '../types/bookmark.types';
import type { ParsedTimeSlot } from '../utils/scheduleConflictUtils';

interface ScheduleConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateItem?: Omit<BookmarkItem, 'id' | 'savedAt'> | BookmarkItem | null;
  conflictingItem?: BookmarkItem | null;
  candidateSlot?: ParsedTimeSlot | null;
  conflictingSlot?: ParsedTimeSlot | null;
}

export const ScheduleConflictModal: React.FC<ScheduleConflictModalProps> = ({
  isOpen,
  onClose,
  candidateItem,
  conflictingItem,
  candidateSlot,
  conflictingSlot,
}) => {
  if (!isOpen || !candidateItem || !conflictingItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200 border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center text-amber-500 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>

        {/* Title & Subtitle */}
        <div className="text-center mb-5">
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Schedule Conflict Detected
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Cannot bookmark this class because its time overlaps with an existing schedule on the same day.
          </p>
        </div>

        {/* Conflict Comparison Cards */}
        <div className="space-y-2.5 mb-6">
          {/* Candidate (New) */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Incoming Class (To Bookmark)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                {candidateItem.courseCode || 'New'}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900 truncate">
              {candidateItem.title}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {candidateSlot?.dayName || 'Day'}{' '}
                {candidateSlot?.formattedTime || candidateItem.subtitle || ''}
              </span>
            </div>
          </div>

          {/* Versus indicator */}
          <div className="flex items-center justify-center">
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
              Overlaps With
            </span>
          </div>

          {/* Conflicting (Existing) */}
          <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                Existing Booked Class
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                {conflictingItem.courseCode || 'Booked'}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900 truncate">
              {conflictingItem.title}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-rose-700 mt-1">
              <Clock className="w-3.5 h-3.5 text-rose-600" />
              <span>
                {conflictingSlot?.dayName || 'Day'}{' '}
                {conflictingSlot?.formattedTime || conflictingItem.subtitle || ''}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer"
        >
          Understood (Dismiss)
        </button>
      </div>
    </div>
  );
};
