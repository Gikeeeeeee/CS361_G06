import React from 'react';
import { Search } from 'lucide-react';
import type { Building, Floor, Room } from '../services/scheduleApi';

interface ScheduleFiltersProps {
  buildings: Building[];
  floors: Floor[];
  rooms: Room[];
  selectedBuildingId: string;
  onBuildingChange: (b: string) => void;
  selectedFloorId: string;
  onFloorChange: (f: string) => void;
  selectedRoomId: string;
  onRoomChange: (r: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  loadingBuildings: boolean;
  loadingFloors: boolean;
  loadingRooms: boolean;
}

export const ScheduleFilters: React.FC<ScheduleFiltersProps> = ({
  buildings,
  floors,
  rooms,
  selectedBuildingId,
  onBuildingChange,
  selectedFloorId,
  onFloorChange,
  selectedRoomId,
  onRoomChange,
  searchQuery,
  onSearchChange,
  loadingBuildings,
  loadingFloors,
  loadingRooms,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">
        Find by Location
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-2">
            Building {loadingBuildings && <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>}
          </label>
          <select 
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none disabled:bg-slate-100 disabled:text-slate-400"
            value={selectedBuildingId}
            onChange={(e) => onBuildingChange(e.target.value)}
            disabled={loadingBuildings || buildings.length === 0}
          >
            <option value="">Select Building</option>
            {buildings.map(b => (
              <option key={b.id} value={b.id}>{b.name.en} / {b.name.th}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-2">
            Floor {loadingFloors && <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>}
          </label>
          <select 
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none disabled:bg-slate-100 disabled:text-slate-400"
            value={selectedFloorId}
            onChange={(e) => onFloorChange(e.target.value)}
            disabled={!selectedBuildingId || loadingFloors || floors.length === 0}
          >
            <option value="">Select Floor</option>
            {floors.map(f => (
              <option key={f.id} value={f.id}>Floor {f.floor_number}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-2">
            Room {loadingRooms && <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>}
          </label>
          <select 
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none disabled:bg-slate-100 disabled:text-slate-400"
            value={selectedRoomId}
            onChange={(e) => onRoomChange(e.target.value)}
            disabled={!selectedFloorId || loadingRooms || rooms.length === 0}
          >
            <option value="">Select Room</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.room_number} - {r.name.en}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Search by course code, title, or instructor..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
