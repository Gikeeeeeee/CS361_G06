import React, { useState, useEffect, useMemo } from 'react';
import { X, MapPin, Search, ArrowRight, Accessibility, Sparkles, Navigation } from 'lucide-react';
import type { QRCheckpoint } from '../types/navigation.types';
import { facilityCache } from '../../admin-schedule/services/facilityCache';

interface DestinationModalProps {
  isOpen: boolean;
  checkpoint: QRCheckpoint | null;
  initialDestination?: string;
  onClose: () => void;
  onStartNavigation: (destinationId: string, destinationName: string, wheelchairAccessible: boolean) => void;
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
  const [wheelchairAccessible, setWheelchairAccessible] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<
    Array<{ id: string; code: string; name: string; building: string; floor: number }>
  >([]);

  // Dynamically load rooms from facility cache / API
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadRooms = async () => {
      await facilityCache.preloadCampusRooms();
      if (!isMounted) return;

      const loaded: Array<{ id: string; code: string; name: string; building: string; floor: number }> = [];
      facilityCache.roomMeta.forEach((meta) => {
        const floorObj = facilityCache.floorsMeta.get(meta.floorId);
        loaded.push({
          id: meta.roomId,
          code: `${meta.buildingCode}-${meta.roomNumber}`,
          name: meta.nameEn,
          building: meta.buildingCode,
          floor: floorObj?.floor_number || 1,
        });
      });
      setAvailableRooms(loaded);
    };

    loadRooms();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return availableRooms.slice(0, 10);
    const q = searchQuery.toLowerCase();
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
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
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
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline px-2 py-1"
          >
            Change
          </button>
        </div>

        {/* Smart Next Class Suggestion (Dynamic from loaded rooms) */}
        {availableRooms.length > 0 && (
          <div className="mb-4 p-3.5 bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200 rounded-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-500" />
                Suggested Destination
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                Quick Select
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {availableRooms[0].code}
                </div>
                <div className="text-[11px] text-slate-500">
                  Floor {availableRooms[0].floor} • {availableRooms[0].building}
                </div>
              </div>
              <button
                onClick={() =>
                  onStartNavigation(
                    availableRooms[0].id,
                    `${availableRooms[0].code} - ${availableRooms[0].name || availableRooms[0].building}`,
                    wheelchairAccessible
                  )
                }
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <span>Go</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

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
              placeholder="Search room number or hall (e.g. 201, BR2-401)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Destination List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 mb-4 max-h-48 pr-1">
          {filteredRooms.map((room) => (
            <button
              key={room.id}
              onClick={() => onStartNavigation(room.id, `${room.code} - ${room.name}`, wheelchairAccessible)}
              className="w-full p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between text-left transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-500 flex items-center justify-center text-xs font-bold transition-colors">
                  {room.building}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">{room.code}</div>
                  <div className="text-[11px] text-slate-500">{room.name} • Floor {room.floor}</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
            </button>
          ))}
        </div>

        {/* Accessibility Preference Toggle */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Accessibility className="w-4 h-4 text-slate-600" />
            <div>
              <div className="text-xs font-semibold text-slate-800">Wheelchair Accessible</div>
              <div className="text-[10px] text-slate-400">Avoid stairs, use elevators only</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={wheelchairAccessible}
            onChange={(e) => setWheelchairAccessible(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>

        {/* Start Button */}
        {searchQuery.trim() && (
          <button
            onClick={() => {
              const matched = availableRooms.find(
                (r) => r.code.toLowerCase() === searchQuery.toLowerCase() || r.id.toLowerCase() === searchQuery.toLowerCase()
              );
              onStartNavigation(
                matched?.id || `RM_${searchQuery.replace(/[^a-zA-Z0-9]/g, '_')}`,
                matched ? `${matched.code} - ${matched.name}` : searchQuery,
                wheelchairAccessible
              );
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <span>Start Navigation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
