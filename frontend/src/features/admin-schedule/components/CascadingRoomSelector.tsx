import React, { useEffect, useState } from 'react';
import { useFacilitySelector } from '../hooks/useFacilitySelector';
import { facilityCache } from '../services/facilityCache';
import { Loader2 } from 'lucide-react';

interface CascadingRoomSelectorProps {
  value: string;
  onChange: (roomId: string) => void;
}

export const CascadingRoomSelector: React.FC<CascadingRoomSelectorProps> = ({ value, onChange }) => {
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

  const [isResolving, setIsResolving] = useState(false);

  // Auto-resolve initial value
  useEffect(() => {
    if (value && value !== selectedRoomId && !isResolving) {
      // If we don't have the building selected yet, we need to resolve it
      if (!selectedBuildingId || !selectedFloorId) {
        // FAST PATH: Synchronous 0ms reverse lookup if already in cache
        if (facilityCache.roomMeta.has(value)) {
          const meta = facilityCache.roomMeta.get(value)!;
          if (meta.buildingId) setSelectedBuildingId(meta.buildingId);
          if (meta.floorId) setSelectedFloorId(meta.floorId);
          setSelectedRoomId(value);
          return;
        }

        let isMounted = true;
        setIsResolving(true);
        facilityCache.getRoom(value)
          .then(roomData => {
            if (isMounted && roomData) {
              if (roomData.building?.id) setSelectedBuildingId(roomData.building.id);
              if (roomData.floor?.id) setSelectedFloorId(roomData.floor.id);
              setSelectedRoomId(value);
            }
          })
          .catch(() => {})
          .finally(() => {
            if (isMounted) setIsResolving(false);
          });
        return () => { isMounted = false; };
      } else {
        setSelectedRoomId(value);
      }
    }
  }, [value, selectedBuildingId, selectedFloorId, selectedRoomId, isResolving, setSelectedBuildingId, setSelectedFloorId, setSelectedRoomId]);

  // Sync selected room back to parent
  useEffect(() => {
    if (selectedRoomId && selectedRoomId !== value && !isResolving) {
      onChange(selectedRoomId);
    }
  }, [selectedRoomId, value, onChange, isResolving]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
            Building
            {loadingBuildings && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
          </label>
          <select
            value={selectedBuildingId}
            onChange={(e) => {
              setSelectedBuildingId(e.target.value);
              setSelectedFloorId('');
              setSelectedRoomId('');
            }}
            disabled={isResolving}
            className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
          >
            <option value="">Select Building</option>
            {buildings.map(b => (
              <option key={b.id} value={b.id}>
                {b.code} - {b.name.en}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
            Floor
            {loadingFloors && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
          </label>
          <select
            value={selectedFloorId}
            onChange={(e) => {
              setSelectedFloorId(e.target.value);
              setSelectedRoomId('');
            }}
            disabled={!selectedBuildingId || isResolving}
            className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
          >
            <option value="">Select Floor</option>
            {floors.map(f => (
              <option key={f.id} value={f.id}>
                Floor {f.floor_number}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
            Room
            {(loadingRooms || isResolving) && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
          </label>
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            disabled={!selectedFloorId || isResolving}
            className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
          >
            <option value="">Select Room</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>
                {r.room_number} - {r.name.en}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
