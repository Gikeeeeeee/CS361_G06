import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-datepicker/dist/react-datepicker.css';
import { X, Loader2 } from 'lucide-react';
import type { ScheduleItem, ScheduleStatus } from '../types/schedule.types';
import { CascadingRoomSelector } from './CascadingRoomSelector';
import { facilityCache } from '../services/facilityCache';

interface EditScheduleDrawerProps {
  isOpen: boolean;
  schedule: ScheduleItem | null;
  onClose: () => void;
  onApply: (updatedSchedule: ScheduleItem) => Promise<void>;
}

const WEEKDAYS = [
  { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' },
  { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' },
  { key: 'FR', label: 'Fri' },
];

function formatIsoWithTimezone(date: Date): string {
  const tzOffsetMinutes = -date.getTimezoneOffset();
  const sign = tzOffsetMinutes >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const hours = pad(tzOffsetMinutes / 60);
  const mins = pad(tzOffsetMinutes % 60);

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const min = pad(date.getMinutes());
  const sec = pad(date.getSeconds());

  return `${year}-${month}-${day}T${hour}:${min}:${sec}${sign}${hours}:${mins}`;
}

export const EditScheduleDrawer: React.FC<EditScheduleDrawerProps> = ({
  isOpen,
  schedule,
  onClose,
  onApply,
}) => {
  const [type, setType] = useState<'Course' | 'Activity' | 'Exam'>('Course');
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [status, setStatus] = useState<ScheduleStatus>('CONFIRM');
  const [organizer, setOrganizer] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Room State
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Submit & Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Confirmation modal states
  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<ScheduleItem | null>(null);
  const [resolvedRoomName, setResolvedRoomName] = useState('');

  // Handle Escape key for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isConfirming) {
        setIsConfirming(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfirming]);

  // Resolve human-readable room name
  useEffect(() => {
    if (selectedRoomId) {
      if (facilityCache.roomMeta.has(selectedRoomId)) {
        const meta = facilityCache.roomMeta.get(selectedRoomId)!;
        setResolvedRoomName(`${meta.buildingCode || 'Bldg'} • Floor ${facilityCache.floorsMeta.get(meta.floorId)?.floor_number || '1'} • ${meta.roomNumber} ${meta.nameEn}`.trim());
      } else {
        facilityCache.getRoom(selectedRoomId).then(room => {
          if (room) {
            setResolvedRoomName(`${room.building?.code || 'Bldg'} • Floor ${room.floor?.floor_number || '1'} • ${room.room_number} ${room.name?.en || ''}`.trim());
          }
        });
      }
    }
  }, [selectedRoomId]);

  // Recurrence state
  const [isWeekly, setIsWeekly] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>(['MO']);
  const [repeatWeeks, setRepeatWeeks] = useState(16);

  useEffect(() => {
    if (!isOpen) {
      setIsConfirming(false);
      setPendingPayload(null);
      setIsSubmitting(false);
      setErrorMessage('');
    }
  }, [isOpen]);
  useEffect(() => {
    if (schedule) {
      setType(schedule.type === 'ACTIVITY' ? 'Activity' : schedule.type === 'EXAM' ? 'Exam' : 'Course');
      setTitle(schedule.title || '');
      setCourseCode(schedule.course_code || '');
      setStatus(schedule.status || 'CONFIRM');
      setOrganizer(schedule.organizer || '');
      setDescription(schedule.description || '');

      try {
        setStartDate(new Date(schedule.start_at));
      } catch { setStartDate(null); }

      try {
        setEndDate(new Date(schedule.end_at));
      } catch { setEndDate(null); }

      setSelectedRoomId(schedule.room_id);

      if (schedule.recurrence_rule) {
        setIsWeekly(true);
        const dayMatch = schedule.recurrence_rule.match(/BYDAY=([^;]+)/);
        if (dayMatch) {
          setSelectedDays(dayMatch[1].split(','));
        }
        const countMatch = schedule.recurrence_rule.match(/COUNT=([^;]+)/);
        if (countMatch) {
          setRepeatWeeks(parseInt(countMatch[1]) || 16);
        }
      } else {
        setIsWeekly(false);
        setSelectedDays([]);
      }
    }
  }, [schedule]);

  if (!isOpen || !schedule) {
    return (
      <div
        className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 transform translate-x-full transition-transform duration-300 z-50"
      />
    );
  }

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'Course' | 'Activity' | 'Exam';
    setType(newType);
    if (newType === 'Course') {
      setIsWeekly(true);
    } else {
      setIsWeekly(false);
    }
  };

  const toggleDay = (dayKey: string) => {
    if (selectedDays.includes(dayKey)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayKey));
      }
    } else {
      setSelectedDays([...selectedDays, dayKey]);
    }
  };

  const getOrganizerMeta = () => {
    switch (type) {
      case 'Course': return { label: 'Instructor / Lecturer', placeholder: 'e.g. Prof. Smith, Dr. Jane Doe' };
      case 'Exam': return { label: 'Examiner / Proctor', placeholder: 'e.g. Prof. Smith (Lead Examiner)' };
      case 'Activity':
      default: return { label: 'Organizer / Host', placeholder: 'e.g. Student Council, Tech Club' };
    }
  };

  const organizerMeta = getOrganizerMeta();

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedRoomId) {
      setErrorMessage('Please select a room.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Please enter a title.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage('Please select both Start at and End at date & time.');
      return;
    }
    if (startDate >= endDate) {
      setErrorMessage('Start time must be before End time.');
      return;
    }

    // removed setIsSubmitting(true)

    const recurrenceRule =
      isWeekly && selectedDays.length > 0
        ? `FREQ=WEEKLY;BYDAY=${selectedDays.join(',')};COUNT=${repeatWeeks}`
        : null;

    // Status is directly from state
    const backendType: 'COURSE' | 'EXAM' | 'ACTIVITY' = type === 'Activity' ? 'ACTIVITY' : (type.toUpperCase() as any);

    const payload: ScheduleItem = {
      ...schedule!,
      type: backendType,
      title: title.trim(),
      start_at: formatIsoWithTimezone(startDate),
      end_at: formatIsoWithTimezone(endDate),
      time_zone: 'Asia/Bangkok',
      status: status,
      course_code: courseCode.trim() || null,
      organizer: organizer.trim() || '',
      description: description.trim() || '',
      recurrence_rule: recurrenceRule,
      room_id: selectedRoomId,
    };

    setPendingPayload(payload);
    setIsConfirming(true);
  };

  const handleConfirmSave = async () => {
    if (!pendingPayload) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await onApply(pendingPayload);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to apply changes');
      setIsConfirming(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-40 transition-opacity duration-300"
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 transform-gpu will-change-transform transition-transform duration-300 ease-in-out z-50 flex flex-col translate-x-0 overflow-hidden`}
      >
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 sticky top-0 z-10">
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
              MODE: EDIT SCHEDULE
            </p>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              Edit {title || 'Schedule'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
          {errorMessage && (
            <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2 border border-red-200">
              <span className="font-medium text-sm">{errorMessage}</span>
            </div>
          )}

          <form id="edit-schedule-form" onSubmit={handleManualSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate-700">Type</label>
              <select
                value={type}
                onChange={handleTypeChange}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="Course">Course</option>
                <option value="Activity">Activity</option>
                <option value="Exam">Exam</option>
              </select>
            </div>

            <div className="col-span-1 space-y-1 flex flex-col">
              <label className="text-sm font-medium text-slate-700">Date & Start Time</label>
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="MM/dd/yyyy h:mm aa"
                placeholderText="mm/dd/yyyy --:--"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Data Structures"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-1 space-y-1 flex flex-col">
              <label className="text-sm font-medium text-slate-700">End Time</label>
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="MM/dd/yyyy h:mm aa"
                placeholderText="mm/dd/yyyy --:--"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {type !== 'Activity' && (
              <div className="col-span-1 space-y-1">
                <label className="text-sm font-medium text-slate-700">Course Code</label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="e.g. CS201"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ScheduleStatus)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="CONFIRM">Confirmed</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="col-span-1 sm:col-span-2 space-y-1">
              <label className="text-sm font-medium text-slate-700">Location</label>
              <CascadingRoomSelector value={selectedRoomId} onChange={setSelectedRoomId} />
            </div>

            <div className="col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate-700">
                {organizerMeta.label}
              </label>
              <input
                type="text"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder={organizerMeta.placeholder}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-1 sm:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-700">Recurring Schedule</label>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isWeekly}
                    onChange={(e) => setIsWeekly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Repeat weekly
                  </span>
                </label>

                {isWeekly && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-xs text-slate-500 font-medium block mb-2">
                        Days of the week:
                      </span>
                      <div className="flex flex-wrap gap-2.5 max-w-md">
                        {WEEKDAYS.map((day) => {
                          const isSelected = selectedDays.includes(day.key);
                          return (
                            <button
                              key={day.key}
                              type="button"
                              onClick={() => toggleDay(day.key)}
                              className={`flex-1 min-w-[3rem] py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1 text-xs text-slate-600">
                      <span className="font-medium">Total duration:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={52}
                          value={repeatWeeks}
                          onChange={(e) => setRepeatWeeks(Number(e.target.value) || 1)}
                          className="w-20 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-center outline-none focus:border-blue-500 bg-white"
                        />
                        <span className="text-slate-500 font-medium">weeks</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-1 sm:col-span-2 space-y-1 mt-2">
              <label className="text-sm font-medium text-slate-700">Notes / Remarks</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details, setup instructions, or notes for attendees..."
                rows={4}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 flex items-center gap-3 bg-white sticky bottom-0 z-10">
          <button
            type="submit"
            form="edit-schedule-form"
            disabled={isSubmitting}
            className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-colors flex justify-center items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Saving...' : 'Apply Changes'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {isConfirming && pendingPayload && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Confirm Schedule Changes</h3>
              <p className="text-sm text-slate-500 mt-1">Please review the details below before saving.</p>
            </div>
            <div className="p-5 space-y-4 text-sm text-slate-700">
              <div className="grid grid-cols-3 gap-2">
                <span className="font-medium text-slate-500">Title:</span>
                <span className="col-span-2 font-semibold text-slate-900">
                  {pendingPayload.course_code ? `${pendingPayload.course_code} - ` : ''}{pendingPayload.title}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-medium text-slate-500">Type:</span>
                <span className="col-span-2 capitalize">{pendingPayload.type.toLowerCase()}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-medium text-slate-500">Location:</span>
                <span className="col-span-2">{resolvedRoomName || pendingPayload.room_id}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-medium text-slate-500">Time:</span>
                <span className="col-span-2">
                  {new Date(pendingPayload.start_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })},{' '}
                  {new Date(pendingPayload.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(pendingPayload.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-medium text-slate-500">Organizer:</span>
                <span className="col-span-2">{pendingPayload.organizer || '—'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-medium text-slate-500">Status:</span>
                <span className="col-span-2 capitalize">{pendingPayload.status.toLowerCase()}</span>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
