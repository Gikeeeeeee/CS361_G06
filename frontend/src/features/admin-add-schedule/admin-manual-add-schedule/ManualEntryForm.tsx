import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  createManualSchedule,
  type CreateSchedulePayload,
} from '../services/manualScheduleService';
import { CascadingRoomSelector } from '../../admin-schedule/components/CascadingRoomSelector';
import { CustomSelect } from '../../../shared/components/CustomSelect';

const WEEKDAYS = [
  { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' },
  { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' },
  { key: 'FR', label: 'Fri' },
];

const COURSE_TIMES = [
  '08:00', '09:30', '11:00', '12:30', '13:30', '15:00', '16:30', '18:00'
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

export default function ManualEntryForm() {
  const [type, setType] = useState<'Course' | 'Activity' | 'Exam'>('Course');
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [organizer, setOrganizer] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [courseStartTime, setCourseStartTime] = useState('');
  const [courseEndTime, setCourseEndTime] = useState('');

  // Room State
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Recurrence state
  const [isWeekly, setIsWeekly] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>(['MO']);
  const [repeatWeeks, setRepeatWeeks] = useState(16);

  // Submit & Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Handle Type Change
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'Course' | 'Activity' | 'Exam';
    setType(newType);
    if (newType === 'Course') {
      setIsWeekly(true);
    } else {
      setIsWeekly(false);
    }
  };

  // Toggle Day Selection
  const toggleDay = (dayKey: string) => {
    if (selectedDays.includes(dayKey)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayKey));
      }
    } else {
      setSelectedDays([...selectedDays, dayKey]);
    }
  };

  const handleStartDateChange = (date: Date | null) => {
    setStartDate(date);
    if (date && type === 'Course') {
      const dayIndex = date.getDay();
      const dayMap: Record<number, string> = { 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR' };
      const dayKey = dayMap[dayIndex];
      
      if (dayKey) {
        setSelectedDays(prev => {
          if (prev.includes(dayKey)) return prev;
          if (prev.length <= 1) return [dayKey]; // Replace if only 1 (or 0) day was selected
          return [...prev, dayKey]; // Add if multiple were already selected
        });
      }
    }
  };

  // Dynamic Label and Placeholder based on Type
  const getOrganizerMeta = () => {
    switch (type) {
      case 'Course':
        return {
          label: 'Instructor / Lecturer',
          placeholder: 'e.g. Prof. Smith, Dr. Jane Doe',
        };
      case 'Exam':
        return {
          label: 'Examiner / Proctor',
          placeholder: 'e.g. Prof. Smith (Lead Examiner)',
        };
      case 'Activity':
      default:
        return {
          label: 'Organizer / Host',
          placeholder: 'e.g. Student Council, Tech Club',
        };
    }
  };

  const organizerMeta = getOrganizerMeta();

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!selectedRoomId) {
      setErrorMessage('Please select a room.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please enter a title.');
      return;
    }

    if (type === 'Course') {
      if (!startDate) {
        setErrorMessage('Please select a date.');
        return;
      }
      if (!courseStartTime || !courseEndTime) {
        setErrorMessage('Please select both start and end times.');
        return;
      }

      const startMinutes = parseInt(courseStartTime.split(':')[0]) * 60 + parseInt(courseStartTime.split(':')[1]);
      const endMinutes = parseInt(courseEndTime.split(':')[0]) * 60 + parseInt(courseEndTime.split(':')[1]);
      
      if (startMinutes >= endMinutes) {
        setErrorMessage('Start time must be before End time.');
        return;
      }
    } else {
      if (!startDate || !endDate) {
        setErrorMessage('Please select both Start at and End at date & time.');
        return;
      }

      if (startDate >= endDate) {
        setErrorMessage('Start time must be before End time.');
        return;
      }
    }

    setIsSubmitting(true);

    let finalStartAt = '';
    let finalEndAt = '';

    if (type === 'Course') {
      const [startH, startM] = courseStartTime.split(':').map(Number);
      const [endH, endM] = courseEndTime.split(':').map(Number);
      
      const start = new Date(startDate as Date);
      start.setHours(startH, startM, 0, 0);
      
      const end = new Date(startDate as Date);
      end.setHours(endH, endM, 0, 0);
      
      finalStartAt = formatIsoWithTimezone(start);
      finalEndAt = formatIsoWithTimezone(end);
    } else {
      finalStartAt = formatIsoWithTimezone(startDate as Date);
      finalEndAt = formatIsoWithTimezone(endDate as Date);
    }

    const recurrenceRule =
      isWeekly && selectedDays.length > 0
        ? `FREQ=WEEKLY;BYDAY=${selectedDays.join(',')};COUNT=${repeatWeeks}`
        : undefined;

    const backendStatus: 'CONFIRM' | 'CANCELLED' = status === 'Active' ? 'CONFIRM' : 'CANCELLED';

    const payload: CreateSchedulePayload = {
      type: type.toUpperCase() as 'COURSE' | 'EXAM' | 'ACTIVITY',
      title: title.trim(),
      start_at: finalStartAt,
      end_at: finalEndAt,
      time_zone: 'Asia/Bangkok',
      status: backendStatus,
      course_code: courseCode.trim() || undefined,
      organizer: organizer.trim() || undefined,
      description: description.trim() || undefined,
      recurrence_rule: recurrenceRule,
    };

    const { status: resStatus, body } = await createManualSchedule(selectedRoomId, payload);

    setIsSubmitting(false);

    if (resStatus === 201) {
      setSuccessMessage(`Schedule "${title}" created successfully!`);
      // Reset form fields
      setTitle('');
      setCourseCode('');
      setStatus('Active');
      setOrganizer('');
      setDescription('');
      setStartDate(null);
      setEndDate(null);
      setCourseStartTime('');
      setCourseEndTime('');
    } else {
      const errorMsg =
        body?.error?.message ||
        (body?.error?.code === 'SCHEDULE_CONFLICT'
          ? 'Schedule conflict: This room is already booked for the selected time.'
          : 'Failed to create schedule. Please check the form data.');
      setErrorMessage(errorMsg);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
      {/* Success Notification */}
      {successMessage && (
        <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2 border border-green-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-medium text-sm">{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium text-sm">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="grid grid-cols-2 gap-6">
        {/* Row 1: Type & Start at */}
        <div className="col-span-1 space-y-1">
          <label className="text-sm font-medium text-slate-700">Type</label>
          <CustomSelect
            value={type}
            onChange={(val) => handleTypeChange({ target: { value: val } } as any)}
            options={[
              { value: 'Course', label: 'Course' },
              { value: 'Activity', label: 'Activity' },
              { value: 'Exam', label: 'Exam' }
            ]}
          />
        </div>

        <div className="col-span-1 space-y-1 flex flex-col">
          <label className="text-sm font-medium text-slate-700">
            {type === 'Course' ? 'Date' : 'Date & Start Time'}
          </label>
          <DatePicker
            selected={startDate}
            onChange={handleStartDateChange}
            showTimeSelect={type !== 'Course'}
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat={type === 'Course' ? "MM/dd/yyyy" : "MM/dd/yyyy h:mm aa"}
            placeholderText={type === 'Course' ? "mm/dd/yyyy" : "mm/dd/yyyy --:--"}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Row 2: Title & End at */}
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
          <label className="text-sm font-medium text-slate-700">
            {type === 'Course' ? 'Time' : 'End Time'}
          </label>
          {type === 'Course' ? (
            <div className="flex gap-2 h-[42px]">
              <div className="w-1/2">
                <CustomSelect
                  value={courseStartTime}
                  onChange={setCourseStartTime}
                  placeholder="Start Time"
                  options={COURSE_TIMES.map(time => ({ value: time, label: time }))}
                  className="h-full"
                />
              </div>
              <div className="w-1/2">
                <CustomSelect
                  value={courseEndTime}
                  onChange={setCourseEndTime}
                  placeholder="End Time"
                  options={COURSE_TIMES.map(time => ({ value: time, label: time }))}
                  className="h-full"
                />
              </div>
            </div>
          ) : (
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
          )}
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
          <CustomSelect
            value={status}
            onChange={(val) => setStatus(val as 'Active' | 'Inactive')}
            options={[
              { value: 'Active', label: 'Confirmed' },
              { value: 'Inactive', label: 'Pending' }
            ]}
          />
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

        {/* Row 5: Recurring Schedule (Full Width - Zero layout shift for Room & Organizer!) */}
        <div className="col-span-2 space-y-2">
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
                  <div className="flex gap-2.5 max-w-md">
                    {WEEKDAYS.map((day) => {
                      const isSelected = selectedDays.includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => toggleDay(day.key)}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
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

        {/* Row 6: Description */}
        <div className="col-span-2 space-y-1 mt-2">
          <label className="text-sm font-medium text-slate-700">Notes / Remarks</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details, setup instructions, or notes for attendees..."
            rows={4}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Submit Button */}
        <div className="col-span-2 flex justify-end mt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </form>
    </div>
  );
}
