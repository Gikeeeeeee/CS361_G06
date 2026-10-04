import React, { useState, useMemo, useEffect } from 'react';
import type { ScheduleItem } from '../types/schedule.types';
import { scheduleApi } from '../services/scheduleApi';
import { ScheduleTable } from '../components/ScheduleTable';
import { ScheduleFilters } from '../components/ScheduleFilters';
import { EditScheduleDrawer } from '../components/EditScheduleDrawer';
import { useFacilitySelector } from '../hooks/useFacilitySelector';

export const AdminSchedulePage: React.FC = () => {
  const [rawSchedules, setRawSchedules] = useState<ScheduleItem[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<ScheduleItem | null>(null);
  
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    buildings,
    floors,
    rooms,
    selectedBuildingId,
    selectedFloorId,
    selectedRoomId,
    setSelectedBuildingId,
    setSelectedFloorId,
    setSelectedRoomId,
    loadingBuildings,
    loadingFloors,
    loadingRooms,
  } = useFacilitySelector();

  const fetchSchedules = async (token?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleApi.getAllSchedules(token);
      if (token) {
        setRawSchedules(prev => [...prev, ...response.data]);
      } else {
        setRawSchedules(response.data);
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

  const handleEditClick = (schedule: ScheduleItem) => {
    setEditingSchedule(schedule);
  };

  const handleCloseDrawer = () => {
    setEditingSchedule(null);
  };

  const handleApplyChanges = async (updatedSchedule: ScheduleItem) => {
    try {
      await scheduleApi.updateSchedule(updatedSchedule.id, updatedSchedule);
      setRawSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s));
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
        setRawSchedules(prev => prev.filter(s => s.id !== deletingSchedule.id));
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

  const roomMap = useMemo(() => {
    const map: Record<string, string> = {};
    rooms.forEach(room => {
      map[room.id] = room.name.en;
    });
    return map;
  }, [rooms]);

  const filteredSchedules = useMemo(() => {
    return rawSchedules.filter(schedule => {
      // 1. Filter by Type
      if (activeTab !== 'All') {
        const typeMap: Record<string, string> = { Courses: 'COURSE', Exams: 'EXAM', Events: 'EVENT' };
        if (schedule.type !== typeMap[activeTab]) return false;
      }

      // 2. Filter by Room
      if (selectedRoomId && schedule.room_id !== selectedRoomId) {
        return false;
      }

      // 3. Filter by Search Query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCode = schedule.course_code?.toLowerCase().includes(query);
        const matchesTitle = schedule.title.toLowerCase().includes(query);
        const matchesOrganizer = schedule.organizer.toLowerCase().includes(query);
        if (!matchesCode && !matchesTitle && !matchesOrganizer) return false;
      }
      return true;
    });
  }, [rawSchedules, activeTab, selectedRoomId, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full relative overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 pb-24 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">
            Campus Schedule
          </h1>
          <p className="text-slate-500">
            View and manage class schedules, exams, and campus events.
          </p>
        </div>

        <ScheduleFilters 
          buildings={buildings}
          floors={floors}
          rooms={rooms}
          selectedBuildingId={selectedBuildingId}
          onBuildingChange={setSelectedBuildingId}
          selectedFloorId={selectedFloorId}
          onFloorChange={setSelectedFloorId}
          selectedRoomId={selectedRoomId}
          onRoomChange={setSelectedRoomId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          loadingBuildings={loadingBuildings}
          loadingFloors={loadingFloors}
          loadingRooms={loadingRooms}
        />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-6 mb-4 gap-4">
          <div className="flex bg-white rounded-lg border border-slate-200 p-1">
            {['All', 'Courses', 'Exams', 'Events'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-primary/10 text-primary border-primary shadow-sm ring-1 ring-primary'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors">
              <span className="text-lg leading-none">+</span> New Schedule
            </button>
          </div>
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
            schedules={filteredSchedules}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            roomMap={roomMap}
          />
          {nextToken && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-center">
              <button
                onClick={() => fetchSchedules(nextToken)}
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
