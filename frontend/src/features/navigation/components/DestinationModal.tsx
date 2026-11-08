import React, { useState, useEffect, useMemo } from 'react';
import { X, MapPin, Search, ArrowRight, Navigation } from 'lucide-react';
import type { QRCheckpoint } from '../types/navigation.types';
import { facilityCache, resolveRoomNumber } from '../../admin-schedule/services/facilityCache';
import { statusApi } from '../../admin-status/services/statusApi';

interface DestinationModalProps {
  isOpen: boolean;
  checkpoint: QRCheckpoint | null;
  initialDestination?: string;
  onClose: () => void;
  onStartNavigation: (destinationId: string, destinationName: string, wheelchairAccessible?: boolean) => void;
  onChangeCheckpoint: () => void;
}

export const DestinationModal: React.FC<DestinationModalProps> = ({
  isOpen,
  checkpoint,
  initialDestination = '',
  onClose,
  onStartNavigation,
  onChangeCheckpoint,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialDestination);
  const [availableRooms, setAvailableRooms] = useState<
    Array<{ id: string; code: string; name: string; building: string; floor: number }>
  >([]);

  // Synchronize initialDestination when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialDestination || '');
    }
  }, [isOpen, initialDestination]);

  // Dynamically load rooms from facility cache / API and prioritize by active checkpoint floor
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadRooms = async () => {
      await facilityCache.preloadCampusRooms();
      if (!isMounted) return;

      const loaded: Array<{ id: string; code: string; name: string; building: string; floor: number }> = [];
      facilityCache.roomMeta.forEach((meta) => {
        const floorObj = facilityCache.floorsMeta.get(meta.floorId);
        const bCode = meta.buildingCode || '';
        const num = meta.roomNumber || resolveRoomNumber('', meta.nameEn, '');
        const code = num
          ? (bCode && !num.toLowerCase().startsWith(bCode.toLowerCase()) ? `${bCode}-${num}` : num)
          : (bCode ? `${bCode}-${meta.nameEn}` : meta.nameEn);

        loaded.push({
          id: meta.roomId,
          code,
          name: meta.nameEn || code,
          building: bCode,
          floor: floorObj?.floor_number || 1,
        });
      });

      // Context-aware sort:
      // 1. Same building and floor as active checkpoint appear FIRST
      // 2. Same building appear NEXT
      // 3. Other buildings appear LAST
      if (checkpoint) {
        loaded.sort((a, b) => {
          const aSameFloor =
            a.building.toLowerCase() === checkpoint.building_code.toLowerCase() &&
            a.floor === checkpoint.floor_number;
          const bSameFloor =
            b.building.toLowerCase() === checkpoint.building_code.toLowerCase() &&
            b.floor === checkpoint.floor_number;
          if (aSameFloor && !bSameFloor) return -1;
          if (!aSameFloor && bSameFloor) return 1;

          const aSameBldg = a.building.toLowerCase() === checkpoint.building_code.toLowerCase();
          const bSameBldg = b.building.toLowerCase() === checkpoint.building_code.toLowerCase();
          if (aSameBldg && !bSameBldg) return -1;
          if (!aSameBldg && bSameBldg) return 1;

          if (a.floor !== b.floor) return a.floor - b.floor;
          return a.code.localeCompare(b.code, undefined, { numeric: true });
        });
      }

      setAvailableRooms(loaded);
    };

    loadRooms();
    return () => {
      isMounted = false;
    };
  }, [isOpen, checkpoint]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return availableRooms;
    const q = searchQuery.toLowerCase().trim();
    return availableRooms.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.building.toLowerCase().includes(q)
    );
  }, [searchQuery, availableRooms]);

  if (!isOpen || !checkpoint) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-200"
        role="dialog"
      >
        {/* Pull Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <Navigation className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Plan Route</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Origin Badge */}
        <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Start Point (Origin)</div>
              <div className="text-xs font-bold text-slate-800">{checkpoint.name}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onChangeCheckpoint}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline px-2 py-1 cursor-pointer"
          >
            Change
          </button>
        </div>

        {/* Destination Search Box */}
        <div className="mb-3">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Select Destination
          </label>
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search room number or hall (e.g. 106, LC4-106)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* List Header Indicator */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5 px-0.5">
          <span>
            {searchQuery.trim()
              ? `Search Results (${filteredRooms.length})`
              : `Rooms on ${checkpoint.building_code} Floor ${checkpoint.floor_number}`}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {filteredRooms.length} rooms
          </span>
        </div>

        {/* Destination List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 mb-4 max-h-64 sm:max-h-72 pr-1">
          {filteredRooms.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No rooms match "{searchQuery}"
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isCurrentFloor =
                checkpoint &&
                room.building.toLowerCase() === checkpoint.building_code.toLowerCase() &&
                room.floor === checkpoint.floor_number;

              const roomStatus =
                statusApi.getRoomStatusSync(room.id) ||
                statusApi.getRoomStatusSync(room.code) ||
                statusApi.getRoomStatusSync(room.name);
              const isClosed = roomStatus?.status === 'CLOSED';
              const isMaintenance = roomStatus?.status === 'MAINTENANCE';

              return (
                <button
                  key={room.id}
                  onClick={() => onStartNavigation(room.id, `${room.code} - ${room.name}`)}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-colors group cursor-pointer ${
                    isClosed
                      ? 'bg-rose-50/40 hover:bg-rose-50/80 border-rose-100 hover:border-rose-200'
                      : isMaintenance
                      ? 'bg-amber-50/40 hover:bg-amber-50/80 border-amber-100 hover:border-amber-200'
                      : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isClosed
                          ? 'bg-rose-100 text-rose-700'
                          : isMaintenance
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-600'
                      }`}
                    >
                      {room.building}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 truncate">{room.code}</span>
                        {isClosed && (
                          <span className="shrink-0 text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Closed
                          </span>
                        )}
                        {isMaintenance && (
                          <span className="shrink-0 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Maintenance
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate mt-0.5">
                        <span className="truncate">{room.name}</span>
                        <span>•</span>
                        <span className="shrink-0">Floor {room.floor}</span>
                        {isCurrentFloor && (
                          <span className="shrink-0 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                            This Floor
                          </span>
                        )}
                      </div>
                      {roomStatus?.status_note && (
                        <div className="text-[10px] text-slate-400 italic truncate mt-0.5">
                          Note: {roomStatus.status_note}
                        </div>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 shrink-0 transition-colors ml-2" />
                </button>
              );
            })
          )}
        </div>

        {/* Start Button */}
        {searchQuery.trim() && (
          <button
            onClick={() => {
              const q = searchQuery.toLowerCase().trim();
              const matched = availableRooms.find(
                (r) =>
                  r.code.toLowerCase() === q ||
                  r.id.toLowerCase() === q ||
                  r.name.toLowerCase() === q ||
                  r.code.toLowerCase().endsWith(`-${q}`) ||
                  r.code.toLowerCase().includes(q)
              );
              onStartNavigation(
                matched?.id || `RM_${searchQuery.replace(/[^a-zA-Z0-9]/g, '_')}`,
                matched ? `${matched.code} - ${matched.name}` : searchQuery
              );
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <span>Start Navigation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
