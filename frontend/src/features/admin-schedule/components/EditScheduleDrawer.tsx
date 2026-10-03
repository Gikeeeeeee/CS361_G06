import React, { useState, useEffect } from 'react';
import { X, Info, CheckCircle2 } from 'lucide-react';
import type { ScheduleItem } from '../types/schedule.types';

interface EditScheduleDrawerProps {
  isOpen: boolean;
  schedule: ScheduleItem | null;
  onClose: () => void;
  onApply: (updatedSchedule: ScheduleItem) => void;
}

export const EditScheduleDrawer: React.FC<EditScheduleDrawerProps> = ({
  isOpen,
  schedule,
  onClose,
  onApply,
}) => {
  const [formData, setFormData] = useState<ScheduleItem | null>(null);

  useEffect(() => {
    if (schedule) {
      setFormData({ ...schedule });
    } else {
      setFormData(null);
    }
  }, [schedule]);

  if (!isOpen || !formData) {
    return (
      <div
        className="fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl border-l border-slate-200 transform translate-x-full transition-transform duration-300 z-50"
      />
    );
  }

  const isCourse = formData.type === 'COURSE';
  const isExamOrEvent = formData.type === 'EXAM' || formData.type === 'EVENT';

  const handleDayToggle = (dayCode: string) => {
    if (!formData.recurrence_rule) return;
    const rule = formData.recurrence_rule;
    const match = rule.match(/BYDAY=([^;]+)/);
    let days: string[] = [];
    if (match) {
      days = match[1].split(',');
    }
    
    if (days.includes(dayCode)) {
      days = days.filter(d => d !== dayCode);
    } else {
      days.push(dayCode);
    }
    
    let newRule = rule;
    if (match) {
      newRule = rule.replace(`BYDAY=${match[1]}`, `BYDAY=${days.join(',')}`);
    } else {
      newRule = `${rule};BYDAY=${days.join(',')}`;
    }
    setFormData({ ...formData, recurrence_rule: newRule });
  };

  const getActiveDays = () => {
    if (!formData.recurrence_rule) return [];
    const match = formData.recurrence_rule.match(/BYDAY=([^;]+)/);
    if (match) return match[1].split(',');
    return [];
  };
  
  const activeDays = getActiveDays();

  const daysList = [
    { code: 'MO', text: 'M' },
    { code: 'TU', text: 'T' },
    { code: 'WE', text: 'W' },
    { code: 'TH', text: 'Th' },
    { code: 'FR', text: 'F' },
  ];

  const handleDateChange = (field: 'start_at' | 'end_at', value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl border-l border-slate-200 transform transition-transform duration-300 z-50 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
              MODE: EDIT SCHEDULE
            </p>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {formData.title || 'Edit Schedule'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Schedule Type</label>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium">
              {formData.type === 'COURSE' ? 'COURSE (RECURRING)' : formData.type}
            </div>
          </div>

          {isCourse && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex gap-3 text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <p>Safe Allocation: Room {formData.room_id} is available during this recurring slot.</p>
            </div>
          )}

          {isExamOrEvent && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3 text-sm text-blue-800">
              <Info className="w-5 h-5 text-blue-500 shrink-0" />
              <p>Exams require precise start and end dates instead of recurring patterns to avoid conflict scans.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Course Code</label>
            <input
              type="text"
              value={formData.course_code || ''}
              onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Assigned Room</label>
            <input
              type="text"
              value={formData.room_id}
              onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Start Date/Time</label>
              <input
                type="text"
                value={formData.start_at}
                onChange={(e) => handleDateChange('start_at', e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">End Date/Time</label>
              <input
                type="text"
                value={formData.end_at}
                onChange={(e) => handleDateChange('end_at', e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {isCourse && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Recurrence Days (COURSE only)</label>
              <div className="flex gap-2">
                {daysList.map(({ code, text }) => {
                  const isSelected = activeDays.includes(code);
                  return (
                    <button
                      key={code}
                      onClick={() => handleDayToggle(code)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex items-center gap-3 bg-white">
          <button
            onClick={() => onApply(formData)}
            className="flex-1 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            Apply Changes
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};
