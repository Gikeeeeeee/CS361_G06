import { useState } from 'react';
import { MapPin, Loader2, Navigation, QrCode, X, Download } from 'lucide-react';
import type { Floor, Room, Building } from '../../../../../shared/types/domain.types';
import { useSvgFloorPlan } from '../../floor-viewer/hooks/useSvgFloorPlan';
import { InteractiveSvgMap } from '../../floor-viewer/components/InteractiveSvgMap';
import { useNavigation } from '../../../../navigation/context/NavigationContext';

interface RoomFloorPlanProps {
  room?: Room | null;
  floor: Floor | null;
  building?: Building | { id: string; code: string; name: any } | null;
}

export function RoomFloorPlan({ room, floor, building }: RoomFloorPlanProps) {
  const { navigateToRoom } = useNavigation();
  const [showQrModal, setShowQrModal] = useState(false);
  const buildingCode = building?.code || (room as any)?.building?.code || 'LC3';
  const floorNumber = floor?.floor_number || (room as any)?.floor?.floor_number || 1;
  const svgUrl = floor?.floor_plan?.url || floor?.map?.url;

  const { svgContent, loading, error } = useSvgFloorPlan(svgUrl);

  if (!floor && !room) return null;

  let highlightedRoomId = room?.room_number || null;
  if (!highlightedRoomId && room) {
    highlightedRoomId = room.name?.en || room.name?.th || (room as any).id || null;
  }

  const roomTitle = room?.room_number || room?.name?.en || room?.name?.th || room?.id || '';
  const qrPayload = `RM_${room?.room_number || room?.id || 'ROOM'}`;

  return (
    <section className="px-5 pt-4 pb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Floor Plan & Location</h3>
        </div>
        <span className="text-xs font-semibold text-blue-600">Level {floorNumber}</span>
      </div>

      {/* Floor Plan Preview with Interactive SVG */}
      <div className="w-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs min-h-[340px] h-[360px] sm:h-[420px] flex items-center justify-center relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-medium text-slate-500">Loading floor plan...</span>
          </div>
        )}

        {error && !svgContent && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-2">
            <MapPin className="w-8 h-8 opacity-40 text-slate-400" />
            <span className="text-xs font-medium">Floor Plan Unavailable</span>
          </div>
        )}

        {svgContent && (
          <div className="w-full h-full flex items-center justify-center">
            <InteractiveSvgMap
              svgContent={svgContent}
              highlightedRoomId={highlightedRoomId}
            />
          </div>
        )}
      </div>

      {/* Legend & Room Info */}
      <div className="flex items-center justify-between text-xs text-slate-500 mt-3 px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block"></span>
            <span className="font-semibold text-slate-700">Room {room?.room_number || ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-slate-200 border border-slate-300 inline-block"></span>
            <span>Other Rooms</span>
          </div>
        </div>
        <span className="font-medium text-slate-600">
          {buildingCode} • Floor {floorNumber}
        </span>
      </div>

      {/* Action Buttons: Navigate & Room QR */}
      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={() => {
            navigateToRoom(room?.id || '', roomTitle, {
              roomId: room?.id,
              floorId: floor?.id,
              floorSvgUrl: svgUrl,
              buildingCode,
              floorNumber,
              roomNumber: room?.room_number || room?.name?.en || '',
              roomName: roomTitle,
            });
          }}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <Navigation className="w-4 h-4" />
          <span>Navigate to Room</span>
        </button>

        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          title="View and print Room QR Code"
          className="py-3 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          <QrCode className="w-4 h-4 text-slate-600" />
          <span className="hidden sm:inline">Room QR</span>
        </button>
      </div>

      {/* Room QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 mb-3">
              <QrCode className="w-5 h-5" />
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Room {roomTitle} QR Code
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {buildingCode} • Level {floorNumber}
            </p>

            {/* Generated QR Image */}
            <div className="mx-auto w-48 h-48 p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shadow-inner mb-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                  qrPayload
                )}`}
                alt={`QR Code for room ${roomTitle}`}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            <div className="text-[11px] font-mono text-slate-500 bg-slate-100 py-1 px-2.5 rounded-lg inline-block mb-3">
              Payload: <span className="font-bold text-slate-800">{qrPayload}</span>
            </div>

            <p className="text-[11px] text-slate-500 mb-5 leading-relaxed">
              For facility staff: Attach this QR sticker to the room entrance for indoor navigation and student check-ins.
            </p>

            <div className="flex gap-2">
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
                  qrPayload
                )}`}
                target="_blank"
                rel="noreferrer"
                download={`qr-${qrPayload}.png`}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Image</span>
              </a>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
