import React, { useState, useMemo } from 'react';
import type { ScheduleItem } from '../types/schedule.types';
import { mockSchedulesData } from '../mocks/us3/schedule.api.mock';
import { ScheduleTable } from '../components/ScheduleTable';
import { ScheduleFilters } from '../components/ScheduleFilters';
import type { FacilityData } from '../components/ScheduleFilters';
import { EditScheduleDrawer } from '../components/EditScheduleDrawer';

const FACILITIES: FacilityData = {
  'Lumen Center (LC4)': {
    'Floor 1 (Ground)': [
      { id: '330e8400-e29b-41d4-a716-446655440030', name: 'Room LC4-101 (Cap. 120)' },
      { id: 'LC4-102', name: 'Room LC4-102 (Cap. 40)' }
    ],
    'Floor 2': [
      { id: 'LC4-201', name: 'Room LC4-201' }
    ]
  },
  'Engineering Building': {
    'Floor 1': [
      { id: '330e8400-e29b-41d4-a716-446655440031', name: 'Room ENG-101' }
    ]
  }
};

export const AdminSchedulePage: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(mockSchedulesData);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<ScheduleItem | null>(null);
  
  const [activeTab, setActiveTab] = useState('All');
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleDeleteClick = (schedule: ScheduleItem) => {
    setDeletingSchedule(schedule);
  };

  const confirmDelete = () => {
    if (deletingSchedule) {
      setSchedules((prev) => prev.filter(s => s.id !== deletingSchedule.id));
      setDeletingSchedule(null);
    }
  };

  const cancelDelete = () => {
    setDeletingSchedule(null);
  };

  const roomMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(FACILITIES).forEach(building => {
      Object.values(building).forEach(floor => {
        floor.forEach(room => {
          map[room.id] = room.name;
        });
      });
    });
    return map;
  }, []);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      // 1. Filter by Tab Type
      if (activeTab === 'Courses' && schedule.type !== 'COURSE') return false;
      if (activeTab === 'Exams' && schedule.type !== 'EXAM') return false;
      if (activeTab === 'Events' && schedule.type !== 'EVENT') return false;

      // 2. Filter by Room
      if (selectedRoom && schedule.room_id !== selectedRoom) return false;
      // If floor/building are selected but no room, we could filter by all rooms in that floor/building,
      // but typically room selection is what matters most. For completeness, we can check building/floor if needed.
      if (selectedBuilding && !selectedRoom) {
        let validRooms: string[] = [];
        if (selectedFloor) {
          validRooms = (FACILITIES[selectedBuilding][selectedFloor] || []).map(r => r.id);
        } else {
          validRooms = Object.values(FACILITIES[selectedBuilding] || {})
            .flat()
            .map(r => r.id);
        }
        if (!validRooms.includes(schedule.room_id)) return false;
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
  }, [schedules, activeTab, selectedBuilding, selectedFloor, selectedRoom, searchQuery]);

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
          facilities={FACILITIES}
          selectedBuilding={selectedBuilding}
          onBuildingChange={(b) => {
            setSelectedBuilding(b);
            setSelectedFloor('');
            setSelectedRoom('');
          }}
          selectedFloor={selectedFloor}
          onFloorChange={(f) => {
            setSelectedFloor(f);
            setSelectedRoom('');
          }}
          selectedRoom={selectedRoom}
          onRoomChange={setSelectedRoom}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <ScheduleTable
            schedules={filteredSchedules}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            roomMap={roomMap}
          />
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
