import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  createManualSchedule,
  getAvailableRooms,
  type CreateSchedulePayload,
  type RoomOption,
} from '../services/manualScheduleService';

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

export default function ManualEntryForm() {
  const [type, setType] = useState<'Course' | 'Activity' | 'Exam'>('Course');
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [organizer, setOrganizer] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Room State
  const [availableRooms, setAvailableRooms] = useState<RoomOption[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [customRoomId, setCustomRoomId] = useState<string>('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // Recurrence state
  const [isWeekly, setIsWeekly] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>(['MO']);
  const [repeatWeeks, setRepeatWeeks] = useState(16);

  // Submit & Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch available rooms on mount
  useEffect(() => {
    let isMounted = true;
    getAvailableRooms().then((rooms) => {
      if (isMounted) {
        setAvailableRooms(rooms);
        if (rooms.length > 0) {
          setSelectedRoomId(rooms[0].id);
        }
        setIsLoadingRooms(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Dynamic Label and Placeholder based on Type
  const getOrganizerMeta = () => {
    switch (type) {
      case 'Course':
        return {
          label: 'Instructor / Professor',
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
          label: 'Organizer',
          placeholder: 'e.g. Student Council, Tech Club',
        };
    }
  };

  const organizerMeta = getOrganizerMeta();

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    // Determine target room ID
    const targetRoomId = selectedRoomId === 'custom' ? customRoomId.trim() : selectedRoomId.trim();

    if (!targetRoomId) {
      setErrorMessage('Please select or specify a room.');
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

    setIsSubmitting(true);

    const recurrenceRule =
      isWeekly && selectedDays.length > 0
        ? `FREQ=WEEKLY;BYDAY=${selectedDays.join(',')};COUNT=${repeatWeeks}`
        : undefined;

    const backendStatus: 'CONFIRM' | 'CANCELLED' = status === 'Active' ? 'CONFIRM' : 'CANCELLED';

    const payload: CreateSchedulePayload = {
      type: type.toUpperCase() as 'COURSE' | 'EXAM' | 'ACTIVITY',
      title: title.trim(),
      start_at: formatIsoWithTimezone(startDate),
      end_at: formatIsoWithTimezone(endDate),
      time_zone: 'Asia/Bangkok',
      status: backendStatus,
      course_code: courseCode.trim() || undefined,
      organizer: organizer.trim() || undefined,
      description: description.trim() || undefined,
      recurrence_rule: recurrenceRule,
    };

    const { status: resStatus, body } = await createManualSchedule(targetRoomId, payload);

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
          <label className="text-sm font-medium text-slate-700">Start at</label>
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
          <label className="text-sm font-medium text-slate-700">End at</label>
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

        {/* Row 3: Course Code & Status */}
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

        <div className="col-span-1 space-y-1">
          <label className="text-sm font-medium text-slate-700">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {/* Row 4: Room & Dynamic Organizer / Instructor / Examiner */}
        <div className="col-span-1 space-y-1">
          <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
            <span>Room</span>
            {isLoadingRooms && (
              <span className="text-xs text-slate-400 flex items-center gap-1 font-normal">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading rooms...
              </span>
            )}
          </label>
          {availableRooms.length > 0 ? (
            <div className="space-y-1.5">
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              >
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.buildingCode} - {r.name} (Fl. {r.floorNumber})
                  </option>
                ))}
                <option value="custom">-- Custom Room ID --</option>
              </select>

              {selectedRoomId === 'custom' && (
                <input
                  type="text"
                  value={customRoomId}
                  onChange={(e) => setCustomRoomId(e.target.value)}
                  placeholder="Enter custom Room UUID..."
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
          ) : (
            <input
              type="text"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              placeholder="e.g. 2c9f4d6f-65a0-5efa-a12c-a2431c6cc91a"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          )}
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
        <div className="col-span-2 space-y-1">
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes or description..."
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
