import React from 'react';
import { HelpCircle } from 'lucide-react';
import type { Building, Room } from '../../../../../shared/types/domain.types';

interface RoomConfirmDestinationModalProps {
  isOpen: boolean;
  building: Building;
  room: (Room & { isFacility?: boolean }) | { id: string; room_number: string; name?: any } | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const RoomConfirmDestinationModal: React.FC<RoomConfirmDestinationModalProps> = ({
  isOpen,
  building,
  room,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !room) return null;

  // Format title (e.g. LC3-101)
  const roomNumber = 'room_number' in room && room.room_number ? room.room_number : room.id;
  const displayRoomTitle = roomNumber.toUpperCase().startsWith(building.code.toUpperCase())
    ? roomNumber
    : `${building.code}-${roomNumber}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl p-6 max-w-[320px] w-full text-center shadow-2xl border border-slate-100 transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Help / Question Icon Badge */}
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100/80 shadow-xs">
          <HelpCircle className="w-6 h-6 stroke-[2]" />
        </div>

        {/* Modal Title */}
        <h3 className="text-base font-bold text-slate-900 leading-snug mb-2">
          คุณจะไปห้อง {displayRoomTitle} ใช่หรือไม่
        </h3>

        {/* Subtitle */}
        <p className="text-xs text-slate-500 leading-relaxed mb-6">
          Confirm destination to start the AR pathfinding navigation.
        </p>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-sm transition-all"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
};
