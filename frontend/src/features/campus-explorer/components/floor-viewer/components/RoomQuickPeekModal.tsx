
import { X } from "lucide-react";
import type { Room } from "../types/floorViewer.types";

interface RoomQuickPeekModalProps {
  room: Room | null;
  onClose: () => void;
}

export function RoomQuickPeekModal({ room, onClose }: RoomQuickPeekModalProps) {
  if (!room) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-11/12 max-w-sm bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20 transition-all duration-300">
      <div className="p-4 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{room.name}</h3>
          <p className="text-sm text-slate-500 capitalize">{room.type}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>
      <div className="px-4 pb-4">
        <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
          View Full Details
        </button>
      </div>
    </div>
  );
}
