import React, { useState } from 'react';
import type { ScheduleItem } from '../types/schedule.types';
import { mockSchedulesData } from '../mocks/us3/schedule.api.mock';
import { ScheduleTable } from '../components/ScheduleTable';
import { ScheduleFilters } from '../components/ScheduleFilters';
import { EditScheduleDrawer } from '../components/EditScheduleDrawer';

export const AdminSchedulePage: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(mockSchedulesData);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [activeTab, setActiveTab] = useState('All Schedules');

  const handleEditClick = (schedule: ScheduleItem) => {
    setEditingSchedule(schedule);
  };

  const handleCloseDrawer = () => {
    setEditingSchedule(null);
  };

  const handleApplyChanges = (updatedSchedule: ScheduleItem) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === updatedSchedule.id ? updatedSchedule : s))
    );
    setEditingSchedule(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full relative overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 pb-24 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">
            Campus Schedule & Facility Allocation
          </h1>
          <p className="text-slate-500">
            Manage, monitor, and resolve scheduling for academic courses, midterm/final exams, and custom events.
          </p>
        </div>

        <ScheduleFilters />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-6 mb-4 gap-4">
          <div className="flex bg-white rounded-lg border border-slate-200 p-1">
            {['All Schedules', 'Courses (Recurring)', 'Exams', 'Events'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-slate-100 text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-white rounded-lg border border-slate-200 p-1">
              <button className="px-4 py-1.5 text-sm font-medium rounded-md bg-white text-slate-900 shadow-sm border border-slate-200">
                Table View
              </button>
              <button className="px-4 py-1.5 text-sm font-medium rounded-md text-slate-500 hover:text-slate-700">
                Conflict Grid
              </button>
            </div>
            <button className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors">
              <span className="text-lg leading-none">+</span> New Schedule
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <ScheduleTable
            schedules={schedules}
            onEdit={handleEditClick}
          />
        </div>
      </div>

      <EditScheduleDrawer
        schedule={editingSchedule}
        isOpen={!!editingSchedule}
        onClose={handleCloseDrawer}
        onApply={handleApplyChanges}
      />
    </div>
  );
};
