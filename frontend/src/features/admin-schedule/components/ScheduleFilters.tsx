import React from 'react';
import { Search } from 'lucide-react';

export interface FacilityData {
  [building: string]: {
    [floor: string]: { id: string; name: string }[];
  };
}

interface ScheduleFiltersProps {
  facilities: FacilityData;
  selectedBuilding: string;
  onBuildingChange: (b: string) => void;
  selectedFloor: string;
  onFloorChange: (f: string) => void;
  selectedRoom: string;
  onRoomChange: (r: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const ScheduleFilters: React.FC<ScheduleFiltersProps> = ({
  facilities,
  selectedBuilding,
  onBuildingChange,
  selectedFloor,
  onFloorChange,
  selectedRoom,
  onRoomChange,
  searchQuery,
  onSearchChange,
}) => {
  const buildings = Object.keys(facilities);
  const floors = selectedBuilding ? Object.keys(facilities[selectedBuilding] || {}) : [];
  const rooms = selectedBuilding && selectedFloor ? facilities[selectedBuilding][selectedFloor] || [] : [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">
        Find by Location
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Building
          </label>
          <select 
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none"
            value={selectedBuilding}
            onChange={(e) => onBuildingChange(e.target.value)}
          >
            <option value="">All Buildings</option>
            {buildings.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Floor
          </label>
          <select 
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none disabled:bg-slate-100 disabled:text-slate-400"
            value={selectedFloor}
            onChange={(e) => onFloorChange(e.target.value)}
            disabled={!selectedBuilding}
          >
            <option value="">All Floors</option>
            {floors.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Room
          </label>
          <select 
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none disabled:bg-slate-100 disabled:text-slate-400"
            value={selectedRoom}
            onChange={(e) => onRoomChange(e.target.value)}
            disabled={!selectedFloor}
          >
            <option value="">All Rooms</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
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
