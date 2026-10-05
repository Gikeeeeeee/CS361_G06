import { useState, useMemo } from 'react';
import { useRoomSchedule } from '../hooks/useRoomSchedule';
import { Calendar, Clock, User } from 'lucide-react';
import { Badge } from '../../../../../shared/components/Badge';

interface RoomScheduleProps {
  roomId: string;
}

export function RoomSchedule({ roomId }: RoomScheduleProps) {
  const [activeTab, setActiveTab] = useState<'COURSE' | 'OTHER'>('OTHER');

  return (
    <div className="w-full bg-white flex flex-col h-full">
      <div className="px-4 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
        <h3 className="text-lg font-bold text-slate-800 mb-3">Room Schedule</h3>
        
        {/* Segmented Control */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('COURSE')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'COURSE' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Courses
          </button>
          <button
            onClick={() => setActiveTab('OTHER')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'OTHER' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Exams & Activities
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {activeTab === 'COURSE' ? (
          <CourseTimetable roomId={roomId} />
        ) : (
          <ExamCalendar roomId={roomId} />
        )}
      </div>
    </div>
  );
}

// --- Courses Timetable ---

const TIME_SLOTS = [
  { label: '08:00 - 09:30', start: '08:00', end: '09:30', type: 'class' },
  { label: '09:30 - 11:00', start: '09:30', end: '11:00', type: 'class' },
  { label: '11:00 - 12:30', start: '11:00', end: '12:30', type: 'class' },
  { label: '12:30 - 13:30', start: '12:30', end: '13:30', type: 'break', title: 'Lunch Break' },
  { label: '13:30 - 15:00', start: '13:30', end: '15:00', type: 'class' },
  { label: '15:00 - 16:30', start: '15:00', end: '16:30', type: 'class' },
];

function CourseTimetable({ roomId }: { roomId: string }) {
  // Get start (Monday) and end (Sunday) of current week
  const today = new Date();
  const currentDay = today.getDay();
  const diffToMonday = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1; // 0 for Mon, 6 for Sun
  });

  const { schedules, isLoading, error } = useRoomSchedule(roomId, 'COURSE', monday, sunday);

  const selectedDateStr = useMemo(() => {
    const d = new Date(monday);
    d.setDate(d.getDate() + selectedDayOffset);
    return d.toISOString().split('T')[0];
  }, [monday, selectedDayOffset]);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const schedulesForDay = useMemo(() => {
    return schedules.filter(s => {
      // Basic check, start_time should be on this day
      return s.start_time.startsWith(selectedDateStr);
    });
  }, [schedules, selectedDateStr]);

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>;
  }

  return (
    <div className="w-full max-w-full">
      {/* Day Selector */}
      <div className="flex space-x-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {days.map((day, idx) => (
          <button
            key={day}
            onClick={() => setSelectedDayOffset(idx)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedDayOffset === idx
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4 mt-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex space-x-4">
              <div className="h-10 w-20 bg-slate-200 rounded"></div>
              <div className="flex-1 h-20 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 space-y-2 pb-4">
          {TIME_SLOTS.map((slot, idx) => {
            if (slot.type === 'break') {
              return (
                <div key={idx} className="flex items-center justify-center py-1.5 bg-slate-50 border border-slate-100 border-dashed rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{slot.title}</span>
                </div>
              );
            }

            // Find overlapping events
            const overlappingEvents = schedulesForDay.filter(s => {
              const sTime = s.start_time.split('T')[1].substring(0, 5);
              const eTime = s.end_time.split('T')[1].substring(0, 5);
              // Simple string comparison works for HH:mm
              return (sTime < slot.end && eTime > slot.start);
            });

            return (
              <div key={idx} className="flex flex-row space-x-2">
                <div className="w-14 flex-shrink-0 text-right pt-1">
                  <div className="text-xs font-bold text-slate-700">{slot.start}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">{slot.end}</div>
                </div>
                
                <div className="flex-1 min-w-0">
                  {overlappingEvents.length > 0 ? (
                    overlappingEvents.map(event => (
                      <div key={event.id} className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-3 mb-2 shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                            {event.course_code || 'COURSE'}
                          </span>
                        </div>
                        <h4 className="font-semibold text-slate-800 text-sm truncate">{event.title}</h4>
                        {event.organizer && (
                          <div className="flex items-center mt-2 text-xs text-slate-600">
                            <User className="w-3 h-3 mr-1" />
                            <span className="truncate">{event.organizer}</span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="h-full min-h-[44px] border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-slate-50/50">
                      <span className="text-[11px] text-slate-400 font-medium">Available</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Exam & Activity Calendar ---

function ExamCalendar({ roomId }: { roomId: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDay = new Date(today);
  endDay.setDate(today.getDate() + 30);
  endDay.setHours(23, 59, 59, 999);

  // We omit type so we can fetch both EXAM and ACTIVITY, or we handle it in API hook.
  // Wait, API hook accepts single type, but we want EXAM & ACTIVITY. Let's just fetch all schedules and filter, 
  // or pass undefined for type to fetch all, and filter locally.
  const { schedules, isLoading, error } = useRoomSchedule(roomId, undefined, today, endDay);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => s.type === 'EXAM' || s.type === 'ACTIVITY');
  }, [schedules]);

  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Generate 30 days grid
  const daysGrid = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(today);
    // Rewind to Sunday of the first week to align grid
    const firstDayOfWeek = current.getDay();
    current.setDate(current.getDate() - firstDayOfWeek);
    
    // We want 5 weeks (35 days) to ensure we cover 30 days ahead properly
    for (let i = 0; i < 35; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [today]);

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  
  const selectedDayEvents = useMemo(() => {
    return filteredSchedules.filter(s => s.start_time.startsWith(selectedDateStr));
  }, [filteredSchedules, selectedDateStr]);


  const getEventMarker = (date: Date) => {
    const dStr = date.toISOString().split('T')[0];
    const events = filteredSchedules.filter(s => s.start_time.startsWith(dStr));
    if (events.length === 0) return null;
    if (events.some(e => e.type === 'EXAM')) return 'bg-amber-500';
    return 'bg-purple-500';
  };

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>;
  }

  return (
    <div className="w-full">
      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-xs font-semibold text-slate-400">
              {d}
            </div>
          ))}
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1 h-40 animate-pulse">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="bg-slate-100 rounded-md m-1"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-y-2 gap-x-1">
            {daysGrid.map((d, i) => {
              const isPast = d < today;
              const isSelected = d.toISOString().split('T')[0] === selectedDateStr;
              const isToday = d.toISOString().split('T')[0] === today.toISOString().split('T')[0];
              const marker = getEventMarker(d);

              return (
                <button
                  key={i}
                  disabled={isPast}
                  onClick={() => setSelectedDate(d)}
                  className={`
                    relative flex items-center justify-center h-10 w-full rounded-lg text-sm transition-all
                    ${isPast ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50'}
                    ${isSelected ? 'bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md' : ''}
                    ${!isSelected && isToday ? 'border border-blue-200 text-blue-600 font-bold' : ''}
                  `}
                >
                  <span>{d.getDate()}</span>
                  {!isSelected && marker && (
                    <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${marker}`}></span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Agenda List */}
      <div>
        <h4 className="font-bold text-slate-800 mb-4 flex items-center">
          <Calendar className="w-4 h-4 mr-2 text-slate-500" />
          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </h4>

        {isLoading ? (
          <div className="space-y-3">
             <div className="h-24 bg-slate-100 rounded-lg animate-pulse w-full"></div>
          </div>
        ) : selectedDayEvents.length > 0 ? (
          <div className="space-y-3 pb-8">
            {selectedDayEvents.map(event => (
              <div key={event.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${event.type === 'EXAM' ? 'bg-amber-500' : 'bg-purple-500'}`}></div>
                
                <div className="flex justify-between items-start mb-2 pl-2">
                  <Badge variant={event.type === 'EXAM' ? 'destructive' : 'default'} className={event.type === 'ACTIVITY' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : event.type === 'EXAM' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-none' : ''}>
                    {event.type}
                  </Badge>
                  <div className="flex items-center text-xs font-medium text-slate-500">
                    <Clock className="w-3 h-3 mr-1" />
                    {event.start_time.split('T')[1].substring(0, 5)} - {event.end_time.split('T')[1].substring(0, 5)}
                  </div>
                </div>
                
                <h5 className="font-bold text-slate-800 pl-2">{event.title}</h5>
                {event.description && <p className="text-sm text-slate-600 mt-1 pl-2">{event.description}</p>}
                
                {event.organizer && (
                  <div className="flex items-center mt-3 pt-3 border-t border-slate-50 text-xs text-slate-500 pl-2">
                    <User className="w-3 h-3 mr-1" />
                    <span>{event.organizer}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-8 text-center border border-slate-100 border-dashed">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Calendar className="w-6 h-6 text-slate-400" />
            </div>
            <h5 className="font-medium text-slate-700">No events scheduled</h5>
            <p className="text-sm text-slate-500 mt-1">There are no exams or activities on this date.</p>
          </div>
        )}
      </div>
    </div>
  );
}
