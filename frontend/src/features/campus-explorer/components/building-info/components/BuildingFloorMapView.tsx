import React, { useState, useEffect, useMemo } from 'react';
import { Search, SlidersHorizontal, Loader2, MapPin, RotateCcw } from 'lucide-react';
import type { Building, Floor, Room } from '../../../../../shared/types/domain.types';
import { useSvgFloorPlan } from '../../floor-viewer/hooks/useSvgFloorPlan';
import { InteractiveSvgMap } from '../../floor-viewer/components/InteractiveSvgMap';
import { statusApi } from '../../../../admin-status/services/statusApi';
import { campusService } from '../../../services';

interface BuildingFloorMapViewProps {
  building: Building;
  floor: Floor;
  highlightedRoomId?: string | null;
  onRoomSelect: (room: Room | { id: string; room_number: string; name?: any }) => void;
}

export const BuildingFloorMapView: React.FC<BuildingFloorMapViewProps> = ({
  building,
  floor,
  highlightedRoomId: externalHighlight,
  onRoomSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [statusOverlay, setStatusOverlay] = useState<Record<string, { status: string; note?: string | null }>>({});

  const [resolvedFloor, setResolvedFloor] = useState<Floor | null>(null);

  useEffect(() => {
    if (!floor.floor_plan?.url && floor.id) {
      campusService
        .getFloorById(floor.id)
        .then((fullFloor) => {
          if (fullFloor?.floor_plan?.url) {
            setResolvedFloor(fullFloor as any);
          }
        })
        .catch(console.error);
    }
  }, [floor.id, floor.floor_plan?.url]);

  const activeFloor = (resolvedFloor?.id === floor.id && resolvedFloor.floor_plan?.url) ? resolvedFloor : floor;
  const svgUrl = activeFloor.floor_plan?.url || activeFloor.map?.url;
  const { svgContent, loading, error, retry } = useSvgFloorPlan(svgUrl);

  // Live operational status overlay synchronization
  useEffect(() => {
    if (!floor?.id) return;
    let isMounted = true;

    const loadStatus = () => {
      statusApi
        .getFloorStatusOverlay(floor.id)
        .then((data) => {
          if (!isMounted) return;
          const map: Record<string, { status: string; note?: string | null }> = {};
          data.rooms?.forEach((r) => {
            const entry = { status: r.status, note: r.status_note };
            map[r.room_id] = entry;
            if (r.room_code) {
              map[r.room_code] = entry;
              map[r.room_code.toLowerCase()] = entry;
              map[`room-${r.room_code}`] = entry;
              map[`room-${r.room_code}`.toLowerCase()] = entry;
              map[`room-${r.room_code.replace(/\//g, '-')}`] = entry;
              map[`room-${r.room_code.replace(/\//g, '-')}`.toLowerCase()] = entry;
            }
          });
          setStatusOverlay(map);
        })
        .catch(() => {});
    };

    loadStatus();

    const handleUpdate = () => loadStatus();
    window.addEventListener('floor-status-updated', handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('floor-status-updated', handleUpdate);
    };
  }, [floor?.id]);

  // Active highlighted room: from search, click, or external prop
  const activeHighlight = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      // 1. Try exact room number match first (e.g. "101" vs "101/1")
      const exactRoom = floor.rooms?.find(
        (r) => r.room_number?.toLowerCase() === q
      );
      if (exactRoom?.room_number) return exactRoom.room_number;

      // 2. Try substring match in room numbers and names
      const matched = floor.rooms?.find(
        (r) =>
          r.room_number?.toLowerCase().includes(q) ||
          r.name?.th?.toLowerCase().includes(q) ||
          r.name?.en?.toLowerCase().includes(q)
      );
      if (matched?.room_number) return matched.room_number;
      return q;
    }
    if (selectedRoomId) return selectedRoomId;

    if (externalHighlight) {
      const matchedRoom = floor.rooms?.find((r) => r.id === externalHighlight);
      if (matchedRoom) {
        return matchedRoom.room_number || matchedRoom.name?.en || matchedRoom.name?.th || externalHighlight;
      }
      return externalHighlight;
    }
    return null;
  }, [searchQuery, selectedRoomId, externalHighlight, floor.rooms]);

  // Handle room click on SVG
  const handleRoomClick = (roomIdentifier: string, rawElementId: string) => {
    const cleanIdent = roomIdentifier.toLowerCase().trim();
    const cleanRaw = rawElementId.toLowerCase().trim();
    const alphanumericIdent = cleanIdent.replace(/[^a-z0-9]/gi, '');

    // Look up room object from floor data
    const matchedRoom = floor.rooms?.find((r) => {
      // 1. Direct ID match
      if (r.id === rawElementId || r.id === roomIdentifier) return true;

      // 2. Exact room_number match
      if (r.room_number && r.room_number.toLowerCase().trim() === cleanIdent) return true;

      // 3. Alphanumeric match on room_number (e.g. 101-1 vs 101/1)
      if (
        alphanumericIdent &&
        r.room_number &&
        r.room_number.replace(/[^a-z0-9]/gi, '').toLowerCase() === alphanumericIdent
      ) {
        return true;
      }

      // 4. RawElementId contains room number (e.g. room-305 contains 305)
      if (r.room_number && cleanRaw.includes(r.room_number.toLowerCase())) {
        return true;
      }

      // 5. Name match (Thai or English contains identifier, e.g. "500" in "ห้องเรียน 500 คน")
      if (alphanumericIdent) {
        const th = r.name?.th?.toLowerCase() || '';
        const en = r.name?.en?.toLowerCase() || '';
        if (th.includes(alphanumericIdent) || en.includes(alphanumericIdent)) {
          return true;
        }
      }

      // 6. Name match for labels like "room-faculty-office" vs "Faculty Office" or "ห้องพักอาจารย์"
      if (
        cleanIdent.includes('office') &&
        ((r.name?.th || '').includes('อาจารย์') || (r.name?.en || '').toLowerCase().includes('office'))
      ) {
        return true;
      }
      if (
        cleanIdent.includes('restroom') &&
        ((r.name?.th || '').includes('น้ำ') || (r.name?.en || '').toLowerCase().includes('restroom'))
      ) {
        return true;
      }

      return false;
    });

    const resolvedRoomNumber =
      matchedRoom?.room_number ||
      matchedRoom?.name?.th ||
      matchedRoom?.name?.en ||
      roomIdentifier;

    setSelectedRoomId(matchedRoom?.room_number || roomIdentifier);

    if (matchedRoom) {
      onRoomSelect(matchedRoom);
    } else {
      // Create fallback room representation
      onRoomSelect({
        id: rawElementId,
        room_number: resolvedRoomNumber,
        name: {
          th: `ห้อง ${resolvedRoomNumber}`,
          en: `Room ${resolvedRoomNumber}`,
        },
      });
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Search Bar & Filter (Matching Figma) */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search rooms or facilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-xs"
          />
        </div>
        <button
          type="button"
          aria-label="Filter"
          className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 active:scale-95 transition-all shadow-xs"
        >
          <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
        </button>
      </div>

      {/* SVG Floor Map Container */}
      <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs relative min-h-[380px] h-[400px] sm:h-[460px] flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs font-medium text-slate-500">Loading floor plan...</span>
          </div>
        )}

        {error && !svgContent && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-2.5 z-10">
            <MapPin className="w-8 h-8 opacity-40 text-slate-400" />
            <p className="text-xs font-semibold text-slate-700">Failed to load floor plan</p>
            <p className="text-[11px] text-slate-400 max-w-xs">{error.message || String(error)}</p>
            <button
              onClick={retry}
              className="mt-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {!loading && !error && !svgContent && !svgUrl && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-2">
            <MapPin className="w-8 h-8 opacity-40 text-slate-400" />
            <p className="text-xs font-medium">Floor plan unavailable for this level</p>
          </div>
        )}

        {svgContent && (
          <div className="w-full h-full flex items-center justify-center">
            <InteractiveSvgMap
              svgContent={svgContent}
              highlightedRoomId={activeHighlight}
              statusOverlay={statusOverlay}
              onRoomClick={handleRoomClick}
            />
          </div>
        )}
      </div>

      {/* Floor Plan Legend */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-2xs"></span>
            <span className="text-[11px] font-medium text-slate-600">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-2xs"></span>
            <span className="text-[11px] font-medium text-slate-600">Maintenance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-2xs"></span>
            <span className="text-[11px] font-medium text-slate-600">Closed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-2xs"></span>
            <span className="text-[11px] font-medium text-slate-600">Selected</span>
          </div>
        </div>
        <span className="font-semibold text-slate-700 text-[11px]">
          {building.code} - Floor {floor.floor_number}
        </span>
      </div>
    </div>
  );
};
