import { useState } from 'react';
import { ChevronUp, Map, Laptop, DoorClosed } from 'lucide-react';
import type { RoomItem, BuildingFilter } from '../types/directory.types';

interface DirectorySheetProps {
  rooms: RoomItem[];
  onSelectRoom?: (room: RoomItem) => void;
}

const BUILDINGS: BuildingFilter[] = ['LC.4', 'LC.3', 'All'];

export default function DirectorySheet({ rooms, onSelectRoom }: DirectorySheetProps) {
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingFilter>('LC.4');
  const [isExpanded, setIsExpanded] = useState(true);

  const filteredRooms = rooms.filter(
    (room) => selectedBuilding === 'All' || room.building === selectedBuilding
  );

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 transition-all duration-300 z-20 pointer-events-auto ${
        isExpanded ? 'max-h-[38vh]' : 'max-h-12'
      } flex flex-col`}
    >
      {/* Handle Bar & Header */}
      <div
        className="px-5 pt-2.5 pb-2 cursor-pointer flex-shrink-0"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-2" />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Directory</h3>
          <ChevronUp
            className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Building Tabs */}
          <div className="flex items-center space-x-6 px-5 border-b border-slate-100 flex-shrink-0">
            {BUILDINGS.map((building) => {
              const isActive = selectedBuilding === building;
              return (
                <button
                  key={building}
                  onClick={() => setSelectedBuilding(building)}
                  className={`pb-2 text-xs font-semibold transition-all relative ${
                    isActive ? 'text-blue-900' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {building}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-900 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Room Cards List */}
          <div className="p-3 overflow-y-auto space-y-2.5 flex-1">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
                    {room.type === 'lab' ? (
                      <Laptop className="w-4 h-4" />
                    ) : (
                      <DoorClosed className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{room.code}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">{room.name}</p>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          room.status === 'AVAILABLE' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      <span
                        className={`text-[9px] font-bold tracking-wider ${
                          room.status === 'AVAILABLE' ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                      >
                        {room.status}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onSelectRoom?.(room)}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-blue-900 hover:bg-slate-50 transition-colors"
                >
                  <Map className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}