import React, { useEffect, useState } from 'react';
import { scheduleApi } from '../services/scheduleApi';
import type { ScheduleItem } from '../types/schedule.types';
import { ScheduleTable } from '../components/ScheduleTable';
import { EditScheduleDrawer } from '../components/EditScheduleDrawer';

export const ScheduleManagePage: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<ScheduleItem | null>(null);

  const fetchSchedules = async (token?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleApi.getAllSchedules(token);
      if (token) {
        setSchedules((prev) => [...prev, ...response.data]);
      } else {
        setSchedules(response.data);
      }
      setNextToken(response.next_token);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleLoadMore = () => {
    if (nextToken) {
      fetchSchedules(nextToken);
    }
  };

  const handleEditClick = (schedule: ScheduleItem) => {
    setEditingSchedule(schedule);
  };

  const handleCloseDrawer = () => {
    setEditingSchedule(null);
  };

  const handleApplyChanges = async (updatedSchedule: ScheduleItem) => {
    try {
      await scheduleApi.updateSchedule(updatedSchedule.id, updatedSchedule);
      // Update local state
      setSchedules((prev) => prev.map((s) => (s.id === updatedSchedule.id ? updatedSchedule : s)));
      setEditingSchedule(null);
    } catch (err: any) {
      console.error('Failed to update schedule', err);
      alert('Failed to update schedule: ' + err.message);
    }
  };

  const handleDeleteClick = (schedule: ScheduleItem) => {
    setDeletingSchedule(schedule);
  };

  const confirmDelete = async () => {
    if (deletingSchedule) {
      try {
        await scheduleApi.deleteSchedule(deletingSchedule.id);
        setSchedules((prev) => prev.filter((s) => s.id !== deletingSchedule.id));
        setDeletingSchedule(null);
      } catch (err: any) {
        console.error('Failed to delete schedule', err);
        alert('Failed to delete schedule: ' + err.message);
      }
    }
  };

  const cancelDelete = () => {
    setDeletingSchedule(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full relative overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 pb-24 lg:p-8">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Manage Schedules</h1>
            <p className="text-slate-500">Edit, reassign, and manage existing campus schedules globally.</p>
          </div>
          <button
            onClick={() => fetchSchedules()}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 text-sm font-medium"
            disabled={loading}
          >
            {loading && !nextToken ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
          {loading && !nextToken && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <ScheduleTable
            schedules={schedules}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
          />
          {nextToken && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 bg-primary text-white rounded-lg shadow-sm hover:bg-primary-hover text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </div>

      <EditScheduleDrawer
        schedule={editingSchedule}
        isOpen={!!editingSchedule}
        onClose={handleCloseDrawer}
        onApply={handleApplyChanges}
      />

      {deletingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Deletion</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete the schedule <strong>{deletingSchedule.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleManagePage;
