import { useState, useMemo } from 'react';
import { useRoomSchedule } from '../hooks/useRoomSchedule';
import { Calendar, Clock, User, ChevronLeft, ChevronRight, X, Info } from 'lucide-react';
import { Badge } from '../../../../../shared/components/Badge';

interface RoomScheduleProps {
  roomId: string;
}

const formatTime = (timeStr?: string) => {
  if (!timeStr) return '';
  if (timeStr.includes('T')) return timeStr.split('T')[1].substring(0, 5);
  if (timeStr.includes(' ')) return timeStr.split(' ')[1].substring(0, 5);
  return timeStr;
};

const toLocalDateString = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function RoomSchedule({ roomId }: RoomScheduleProps) {
  const [activeTab, setActiveTab] = useState<'COURSE' | 'OTHER'>('OTHER');
  
  return (
    <div className="w-full bg-slate-50 flex flex-col h-full">
      <div className="px-4 py-4 sticky top-0 bg-slate-50 z-10">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Room Schedule</h3>
        
        {/* Segmented Control */}
        <div className="flex bg-slate-200/60 p-1 rounded-lg">
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-0">
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
  const today = new Date();
  const currentDay = today.getDay();
  const diffToMonday = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  
  // Clone today before modifying to avoid weird side effects
  const monday = new Date(today.getTime());
  monday.setDate(diffToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday.getTime());
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1; // 0 for Mon, 6 for Sun
  });

  const { schedules, isLoading, error } = useRoomSchedule(roomId, 'COURSE', monday, sunday);

  const selectedDateStr = useMemo(() => {
    const d = new Date(monday.getTime());
    d.setDate(d.getDate() + selectedDayOffset);
    return toLocalDateString(d);
  }, [monday, selectedDayOffset]);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const schedulesForDay = useMemo(() => {
    return (schedules || []).filter((s: any) => {
      if (s.recurrence_rule) {
        const byDayMatch = s.recurrence_rule.match(/BYDAY=([^;]+)/);
        if (byDayMatch) {
          const days = byDayMatch[1].split(',');
          const daysMap: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
          return days.some((day: string) => daysMap[day] === selectedDayOffset);
        }
        const startDate = new Date(s.start_at);
        const startDay = startDate.getDay();
        const startDayOffset = startDay === 0 ? 6 : startDay - 1;
        return startDayOffset === selectedDayOffset;
      }
      return s?.start_at?.startsWith(selectedDateStr);
    });
  }, [schedules, selectedDateStr, selectedDayOffset]);

  if (error) {
    return <div className="text-red-500 text-sm text-center py-4 bg-white rounded-xl border border-red-100 shadow-sm">{error}</div>;
  }

  return (
    <div className="w-full max-w-full pt-2">
      {/* Day Selector on Top */}
      <div className="flex space-x-2 overflow-x-auto pb-4 mb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {days.map((day, idx) => (
          <button
            key={day}
            onClick={() => setSelectedDayOffset(idx)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedDayOffset === idx
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/70'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4 mt-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex space-x-4">
              <div className="h-10 w-14 bg-slate-200 rounded"></div>
              <div className="flex-1 h-20 bg-slate-200 rounded-xl"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="pb-4 mt-2">
          {TIME_SLOTS.map((slot, idx) => {
            const getEventsForSlot = (sl: any) => {
              return (schedulesForDay || []).filter((s: any) => {
                const sTime = formatTime(s.start_at);
                const eTime = formatTime(s.end_at);
                if (!sTime || !eTime) return false;
                return (sTime < sl.end && eTime > sl.start);
              });
            };

            const overlappingEvents = getEventsForSlot(slot);
            const prevEvents = idx > 0 ? getEventsForSlot(TIME_SLOTS[idx - 1]) : [];
            const nextEvents = idx < TIME_SLOTS.length - 1 ? getEventsForSlot(TIME_SLOTS[idx + 1]) : [];

            const isBreak = slot.type === 'break';
            const event = overlappingEvents.length > 0 ? overlappingEvents[0] : null;
            
            // Check if this event continues from the previous slot (and previous wasn't a break)
            const isSameAsPrev = event && !isBreak && TIME_SLOTS[idx - 1]?.type !== 'break' && prevEvents.some(p => p.id === event.id);
            // Check if this event continues into the next slot (and next isn't a break)
            const isSameAsNext = event && !isBreak && TIME_SLOTS[idx + 1]?.type !== 'break' && nextEvents.some(n => n.id === event.id);

            return (
              <div key={idx}>
                {/* Render gap between slots unless the event is continuing seamlessly */}
                {idx > 0 && !isSameAsPrev && <div className="h-2"></div>}
                
                <div className="flex flex-row space-x-2">
                  <div className="w-14 flex-shrink-0 text-right pt-1">
                    <div className="text-xs font-bold text-slate-700">{slot.start}</div>
                    <div className="text-[10px] text-slate-400 leading-tight">{slot.end}</div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {isBreak ? (
                      <div className="flex items-center justify-center py-1.5 h-full min-h-[44px] bg-slate-200/50 border border-slate-200 border-dashed rounded-lg">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{slot.title}</span>
                      </div>
                    ) : event ? (
                      <div className={`bg-blue-50 border-l-4 border-blue-500 flex flex-col justify-start h-full min-h-[44px]
                        ${!isSameAsPrev && !isSameAsNext ? 'rounded-r-lg shadow-sm' : ''}
                        ${isSameAsPrev && isSameAsNext ? 'border-y-0 rounded-none' : ''}
                        ${!isSameAsPrev && isSameAsNext ? 'rounded-tr-lg rounded-br-none border-b-0' : ''}
                        ${isSameAsPrev && !isSameAsNext ? 'rounded-br-lg rounded-tr-none border-t-0 shadow-sm' : ''}
                        ${!isSameAsPrev ? 'p-3' : 'px-3 pb-3 pt-0'}
                      `}>
                        {!isSameAsPrev && (
                          <>
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
                          </>
                        )}
                        {/* Filler if it's a continuation to maintain minimum visual continuity */}
                        {isSameAsPrev && <div className="min-h-[16px]"></div>}
                      </div>
                    ) : (
                      <div className="h-full min-h-[44px] border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-white">
                        <span className="text-[11px] text-slate-400 font-medium">Available</span>
                      </div>
                    )}
                  </div>
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
  
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Generate Calendar Grid for currentMonth
  const daysGrid = useMemo(() => {
    const days: Date[] = [];
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    // Pad start to Sunday
    const startOffset = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - startOffset);
    
    // Pad end to Saturday
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

  const gridStart = daysGrid[0];
  const gridEnd = new Date(daysGrid[daysGrid.length - 1]);
  gridEnd.setHours(23, 59, 59, 999);

  const { schedules, isLoading, error } = useRoomSchedule(roomId, undefined, gridStart, gridEnd);

  const filteredSchedules = useMemo(() => {
    return (schedules || []).filter((s: any) => s?.type === 'EXAM' || s?.type === 'ACTIVITY');
  }, [schedules]);

  const selectedDateStr = toLocalDateString(selectedDate);
  const todayStr = toLocalDateString(today);
  
  const selectedDayEvents = useMemo(() => {
    return filteredSchedules.filter((s: any) => {
      if (s.recurrence_rule) {
        const byDayMatch = s.recurrence_rule.match(/BYDAY=([^;]+)/);
        if (byDayMatch) {
          const days = byDayMatch[1].split(',');
          const daysMap: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
          const selectedDay = selectedDate.getDay();
          const selectedOffset = selectedDay === 0 ? 6 : selectedDay - 1;
          return days.some((day: string) => daysMap[day] === selectedOffset);
        }
      }
      return s?.start_at?.startsWith(selectedDateStr);
    });
  }, [filteredSchedules, selectedDateStr, selectedDate]);

  const getEventMarker = (date: Date) => {
    const dStr = toLocalDateString(date);
    const events = filteredSchedules.filter((s: any) => s?.start_at?.startsWith(dStr));
    if (!events || events.length === 0) return null;
    if (events.some((e: any) => e?.type === 'EXAM')) return 'bg-amber-500';
    return 'bg-purple-500';
  };

  if (error) {
    return <div className="text-red-500 text-sm text-center py-4 bg-white rounded-xl border border-red-100 shadow-sm">{error}</div>;
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  return (
    <div className="w-full pt-2 pb-8">
      {/* Agenda List Below Calendar */}
      <div className="mb-6">
        <h4 className="font-bold text-slate-800 mb-4 flex items-center">
          <Calendar className="w-4 h-4 mr-2 text-slate-500" />
          {selectedDateStr === todayStr 
            ? "Today's Events" 
            : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </h4>

        {isLoading && selectedDayEvents.length === 0 ? (
          <div className="space-y-3">
             <div className="h-24 bg-white rounded-xl shadow-sm border border-slate-100 animate-pulse w-full"></div>
          </div>
        ) : selectedDayEvents.length > 0 ? (
          <div className="space-y-3">
            {selectedDayEvents.map((event: any) => (
              <button 
                key={event.id} 
                onClick={() => setSelectedEvent(event)}
                className="w-full text-left bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-md hover:border-slate-200 cursor-pointer"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${event.type === 'EXAM' ? 'bg-amber-500' : 'bg-purple-500'}`}></div>
                
                <div className="flex justify-between items-start mb-2 pl-2 w-full">
                  <Badge variant={event.type === 'EXAM' ? 'destructive' : 'default'} className={event.type === 'ACTIVITY' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : event.type === 'EXAM' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-none' : ''}>
                    {event.type}
                  </Badge>
                  <div className="flex items-center text-xs font-medium text-slate-500">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTime(event.start_at)} - {formatTime(event.end_at)}
                  </div>
                </div>
                
                <h5 className="font-bold text-slate-800 pl-2">{event.title}</h5>
                {event.description && <p className="text-sm text-slate-600 mt-1 pl-2 truncate w-full">{event.description}</p>}
                
                {event.organizer && (
                  <div className="flex items-center mt-3 pt-3 border-t border-slate-50 text-xs text-slate-500 pl-2">
                    <User className="w-3 h-3 mr-1" />
                    <span className="truncate">{event.organizer}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-slate-100 border-dashed">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-slate-400" />
            </div>
            <h5 className="font-medium text-slate-700">No events scheduled</h5>
            <p className="text-sm text-slate-500 mt-1">There are no exams or activities on this date.</p>
          </div>
        )}
      </div>

      {/* Calendar Grid on Top */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        
        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-4 px-1">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h4>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => {
              setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedDate(today);
            }} className="px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 rounded-md transition-colors text-slate-600">
              Today
            </button>
            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
            <div key={i} className="text-center text-xs font-semibold text-slate-400">
              {d}
            </div>
          ))}
        </div>
        
        {isLoading && filteredSchedules.length === 0 ? (
          <div className="grid grid-cols-7 gap-1 h-40 animate-pulse">
            {daysGrid.map((_, i) => (
              <div key={i} className="bg-slate-100 rounded-md m-1"></div>
            ))}
          </div>
        ) : (
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
                  onClick={() => setSelectedDate(d)}
                  className={`
                    relative flex items-center justify-center h-10 w-full rounded-lg text-sm transition-all
                    ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700 hover:bg-slate-50'}
                    ${isSelected ? 'bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md z-10' : ''}
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

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedEvent(null)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`px-6 py-5 border-b flex justify-between items-center ${selectedEvent.type === 'EXAM' ? 'bg-amber-500/10 border-amber-100' : 'bg-purple-500/10 border-purple-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedEvent.type === 'EXAM' ? 'bg-amber-500 text-white' : 'bg-purple-500 text-white'}`}>
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <Badge variant={selectedEvent.type === 'EXAM' ? 'destructive' : 'default'} className={selectedEvent.type === 'ACTIVITY' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : event?.type === 'EXAM' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-none' : ''}>
                    {selectedEvent.type}
                  </Badge>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-1">{selectedEvent.title}</h3>
              {selectedEvent.course_code && (
                <p className="text-sm font-medium text-slate-500 mb-4">{selectedEvent.course_code}</p>
              )}
              
              <div className="space-y-4 mt-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Time</p>
                    <p className="text-sm font-medium text-slate-800">
                      {formatTime(selectedEvent.start_at)} - {formatTime(selectedEvent.end_at)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(selectedEvent.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {selectedEvent.organizer && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Organizer</p>
                      <p className="text-sm font-medium text-slate-800">{selectedEvent.organizer}</p>
                    </div>
                  </div>
                )}

                {selectedEvent.description && (
                  <div className="flex items-start gap-3 pt-2">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
                      <Info className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Details</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedEvent.description}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
