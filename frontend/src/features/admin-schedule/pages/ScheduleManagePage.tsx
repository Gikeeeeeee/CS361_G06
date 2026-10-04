import React, { useEffect, useState } from 'react';
import { scheduleApi } from '../services/scheduleApi';
import type { ScheduleItem } from '../types/schedule.types';
import { ScheduleTable } from '../components/ScheduleTable';
import { EditScheduleDrawer } from '../components/EditScheduleDrawer';
import { useSchedulePagination } from '../hooks/useSchedulePagination';
import { PaginationBar } from '../components/PaginationBar';

export const ScheduleManagePage: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    tokenHistory,
    currentToken,
    nextToken,
    setNextToken,
    resetPagination,
    handleNextPage,
    handlePrevPage,
  } = useSchedulePagination();

  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<ScheduleItem | null>(null);

  const fetchSchedules = async (token: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleApi.getAllSchedules(token ?? undefined);
      setSchedules(response.data);
      setNextToken(response.meta?.next_token ?? null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules(currentToken);
  }, [currentToken]);

  const handleRefresh = React.useCallback(() => {
    if (currentToken === null && tokenHistory.length === 0) {
      fetchSchedules(null);
    } else {
      resetPagination();
    }
  }, [currentToken, tokenHistory.length, resetPagination]);

  const handleEditClick = (schedule: ScheduleItem) => {
    setEditingSchedule(schedule);
  };

  const handleCloseDrawer = () => {
    setEditingSchedule(null);
  };

  const handleApplyChanges = async (updatedSchedule: ScheduleItem) => {
    try {
      await scheduleApi.updateSchedule(updatedSchedule.id, updatedSchedule);
      handleRefresh();
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
        handleRefresh();
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
    <div className="flex flex-col h-screen bg-slate-50 w-full relative overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0 p-6 lg:p-8">
        <div className="flex-shrink-0 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Manage Schedules</h1>
            <p className="text-slate-500">Edit, reassign, and manage existing campus schedules globally.</p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 text-sm font-medium"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="flex-shrink-0 mb-4 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
          {loading && !nextToken && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <div className="flex-1 overflow-hidden min-h-0">
            <ScheduleTable
              schedules={schedules}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
          </div>
          <div className="flex-shrink-0">
            <PaginationBar
            currentPage={tokenHistory.length + 1}
            hasNext={!!nextToken}
            hasPrev={tokenHistory.length > 0}
            onNext={handleNextPage}
            onPrev={handlePrevPage}
            isLoading={loading}
          />
          </div>
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
