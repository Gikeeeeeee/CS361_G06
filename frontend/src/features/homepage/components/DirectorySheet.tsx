import { useState, useRef } from 'react';
import { ChevronUp, Building2, ChevronRight, Clock } from 'lucide-react';

export interface BuildingItem {
  id: string;
  code: string;
  name: string;
  openHours: string;
}

interface DirectorySheetProps {
  buildings?: BuildingItem[];
  onSelectBuilding?: (building: BuildingItem) => void;
}

const MOCK_BUILDINGS_DATA: BuildingItem[] = [
  { id: 'b1', code: 'LC.4', name: 'Lecture Center 4', openHours: '08:00 - 16:00 น.' },
  { id: 'b2', code: 'LC.3', name: 'Lecture Center 3', openHours: '08:00 - 16:00 น.' },
  { id: 'b3', code: 'SC', name: 'Science Center', openHours: '08:00 - 16:00 น.' },
];

export default function DirectorySheet({
  buildings = MOCK_BUILDINGS_DATA,
  onSelectBuilding,
}: DirectorySheetProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const startYRef = useRef<number | null>(null);

  // รองรับ Touch สำหรับมือถือ
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const diffY = startYRef.current - e.changedTouches[0].clientY;
    if (diffY > 25) setIsExpanded(true);   // ลากขึ้น = เปิด
    if (diffY < -25) setIsExpanded(false); // ลากลง = ปิด
    startYRef.current = null;
  };

  // รองรับ Mouse Drag สำหรับการทดสอบบนคอมพิวเตอร์
  const handleMouseDown = (e: React.MouseEvent) => {
    startYRef.current = e.clientY;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (startYRef.current === null) return;
    const diffY = startYRef.current - e.clientY;
    if (diffY > 25) setIsExpanded(true);
    if (diffY < -25) setIsExpanded(false);
    startYRef.current = null;
  };

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 transition-all duration-300 z-20 pointer-events-auto ${
        isExpanded ? 'max-h-[38vh]' : 'max-h-12'
      } flex flex-col`}
    >
      {/* แถบสำหรับลากขึ้น-ลง (Drag Handle Bar) */}
      <div
        className="px-5 pt-2.5 pb-2 cursor-grab active:cursor-grabbing flex-shrink-0 select-none touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1.5" />
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
        <div className="p-3 overflow-y-auto space-y-2.5 flex-1 touch-pan-y">
          {buildings.map((building) => (
            <div
              key={building.id}
              onClick={() => onSelectBuilding?.(building)}
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-blue-500 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-blue-900 flex items-center justify-center text-white flex-shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{building.code}</h4>
                  <p className="text-xs text-slate-500 font-medium">{building.name}</p>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-medium mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>เปิดทำการ {building.openHours}</span>
                  </div>
                </div>
              </div>

              <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}