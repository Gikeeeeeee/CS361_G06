import React, { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { facilityCache } from '../services/facilityCache';
import type { ScheduleItem } from '../types/schedule.types';

interface ScheduleTableProps {
  schedules: ScheduleItem[];
  onEdit: (schedule: ScheduleItem) => void;
  onDelete: (schedule: ScheduleItem) => void;
  roomMap?: Record<string, string>;
}


const RoomLabel: React.FC<{ roomId: string; roomMap: Record<string, string> }> = ({ roomId, roomMap }) => {
  const [label, setLabel] = useState<string | null>(roomMap[roomId] || null);

  useEffect(() => {
    if (roomMap[roomId]) {
      setLabel(roomMap[roomId]);
      return;
    }
    
    // FAST PATH: Synchronous 0ms lookup if already in cache
    if (facilityCache.roomMeta.has(roomId)) {
      const meta = facilityCache.roomMeta.get(roomId)!;
      const buildingCode = meta.buildingCode ? `${meta.buildingCode} - ` : '';
      setLabel(`${buildingCode}${meta.roomNumber} ${meta.nameEn}`.trim());
      return;
    }
    
    let isMounted = true;
    
    facilityCache.getRoom(roomId)
      .then(room => {
        if (isMounted && room) {
          const buildingCode = room.building?.code ? `${room.building.code} - ` : '';
          const name = room.name?.en || '';
          setLabel(`${buildingCode}${room.room_number} ${name}`.trim());
        }
      })
      .catch(() => {
        // fallback to UUID behavior implicitly since label will remain null
      });

    return () => {
      isMounted = false;
    };
  }, [roomId, roomMap]);

  const display = label || (roomId.length > 15 ? `${roomId.slice(0, 8)}...` : roomId);
  const fullTitle = label || roomId;

  return (
    <span 
      className="inline-block max-w-[200px] truncate text-sm font-medium text-slate-900"
      title={fullTitle}
    >
      {display}
    </span>
  );
};

export const ScheduleTable: React.FC<ScheduleTableProps> = ({ schedules, onEdit, onDelete, roomMap = {} }) => {
  const getTypePill = (type: string) => {
    switch (type) {
      case 'COURSE':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">COURSE</span>;
      case 'EXAM':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-pink-50 text-pink-600 border border-pink-100">EXAM</span>;
      case 'EVENT':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">EVENT</span>;
      default:
        return null;
    }
  };

  const getStatusPill = (status: string) => {
    switch (status) {
      case 'CONFIRM':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-emerald-600 border border-green-100">Confirmed</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-100">Cancelled</span>;
      default:
        return null;
    }
  };

  const formatTimePattern = (item: ScheduleItem) => {
    const start = new Date(item.start_at);
    const end = new Date(item.end_at);
    const startTimeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (item.type === 'COURSE') {
      let daysStr = '';
      if (item.recurrence_rule) {
        const match = item.recurrence_rule.match(/BYDAY=([^;]+)/);
        if (match) {
          daysStr = match[1].split(',').map(d => d.slice(0, 2)).join('/');
        }
      }
      return `${daysStr ? daysStr + ' ' : ''}${startTimeStr} - ${endTimeStr}`;
    } else {
      const startDay = start.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `${startDay}, ${startTimeStr} - ${endTimeStr}`;
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">TYPE</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">CODE</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">TITLE / INSTRUCTOR</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">ROOM</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">DATE & TIME</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">STATUS</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedules.length > 0 ? (
              schedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">{getTypePill(schedule.type)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{schedule.course_code || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="font-medium text-slate-900">{schedule.title}</div>
                    <div className="text-xs text-slate-500">{schedule.organizer}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <RoomLabel roomId={schedule.room_id} roomMap={roomMap} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatTimePattern(schedule)}</td>
                  <td className="px-4 py-3">{getStatusPill(schedule.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(schedule)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary-50 rounded-md transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onDelete(schedule)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No schedules found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50/50 mt-auto text-xs text-slate-500">
        Showing {schedules.length} entries
      </div>
    </div>
  );
};
