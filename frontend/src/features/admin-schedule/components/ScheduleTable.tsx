import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { ScheduleItem } from '../types/schedule.types';

interface ScheduleTableProps {
  schedules: ScheduleItem[];
  onEdit: (schedule: ScheduleItem) => void;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({ schedules, onEdit }) => {
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
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-emerald-600 border border-green-100">Confirm</span>;
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
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">TYPE</th>
            <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">CODE</th>
            <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">TITLE / ORGANIZER</th>
            <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">ROOM</th>
            <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">TIME / PATTERN</th>
            <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider">STATUS</th>
            <th className="px-4 py-3 font-semibold text-slate-600 text-xs tracking-wider text-right">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {schedules.map((schedule) => (
            <tr key={schedule.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-4 py-3">{getTypePill(schedule.type)}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{schedule.course_code || '—'}</td>
              <td className="px-4 py-3 text-slate-700">{schedule.title}</td>
              <td className="px-4 py-3 text-slate-600">{schedule.room_id}</td>
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
                  <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
        <span className="text-xs text-slate-500">Showing 1 to {schedules.length} of 24 entries</span>
        <div className="flex gap-1">
          <button className="px-3 py-1 border border-slate-200 rounded-md text-xs bg-white text-slate-600">Previous</button>
          <button className="px-3 py-1 border border-primary bg-primary rounded-md text-xs text-white">1</button>
          <button className="px-3 py-1 border border-slate-200 rounded-md text-xs bg-white text-slate-600">2</button>
          <button className="px-3 py-1 border border-slate-200 rounded-md text-xs bg-white text-slate-600">Next</button>
        </div>
      </div>
    </div>
  );
};
