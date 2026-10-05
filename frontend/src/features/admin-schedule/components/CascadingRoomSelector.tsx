import React, { useEffect, useState } from 'react';
import { useFacilitySelector } from '../hooks/useFacilitySelector';
import { facilityCache } from '../services/facilityCache';
import { Loader2 } from 'lucide-react';
import { CustomSelect } from '../../../shared/components/CustomSelect';

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
          <CustomSelect
            value={selectedBuildingId}
            onChange={(val) => {
              setSelectedBuildingId(val);
              setSelectedFloorId('');
              setSelectedRoomId('');
            }}
            disabled={isResolving}
            placeholder="Select Building"
            options={buildings.map(b => ({
              value: b.id,
              label: `${b.code} - ${b.name.en}`
            }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
            Floor
            {loadingFloors && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
          </label>
          <CustomSelect
            value={selectedFloorId}
            onChange={(val) => {
              setSelectedFloorId(val);
              setSelectedRoomId('');
            }}
            disabled={!selectedBuildingId || isResolving}
            placeholder="Select Floor"
            options={floors.map(f => ({
              value: f.id,
              label: `Floor ${f.floor_number}`
            }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
            Room
            {(loadingRooms || isResolving) && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
          </label>
          <CustomSelect
            value={selectedRoomId}
            onChange={setSelectedRoomId}
            disabled={!selectedFloorId || isResolving}
            placeholder="Select Room"
            options={rooms.map(r => ({
              value: r.id,
              label: `${r.room_number} - ${r.name.en}`
            }))}
          />
        </div>
      </div>
    </div>
  );
};
