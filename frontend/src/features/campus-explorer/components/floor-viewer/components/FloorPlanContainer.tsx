import { useState, useEffect, useMemo } from "react";
import { Maximize2 } from "lucide-react";
import { useFloorMetadata } from "../hooks/useFloorMetadata";
import { RoomQuickPeekModal } from "./RoomQuickPeekModal";
import { useSvgFloorPlan } from "../hooks/useSvgFloorPlan";
import { useRoomHighlight } from "../hooks/useRoomHighlight";
import { InteractiveSvgMap } from "./InteractiveSvgMap";
import { useFullscreenViewer } from "../hooks/useFullscreenViewer";
import { FullscreenFloorModal } from "./FullscreenFloorModal";
import { statusApi } from "../../../../admin-status/services/statusApi";

interface FloorPlanContainerProps {
  buildingId: string;
  floorId: string;
}

export function FloorPlanContainer({ buildingId, floorId }: FloorPlanContainerProps) {
  const { metadata: floorMetadata, loading: metaLoading, error: metaError } = useFloorMetadata(buildingId, floorId);
  const { svgContent, loading: svgLoading, error: svgError } = useSvgFloorPlan(floorMetadata?.map?.url);
  const { highlightedRoomId, setHighlightedRoom } = useRoomHighlight();
  const { isFullscreen, openFullscreen, closeFullscreen } = useFullscreenViewer();
  const [statusOverlay, setStatusOverlay] = useState<Record<string, { status: string; note?: string | null }>>({});

  useEffect(() => {
    if (!floorId) return;
    let isMounted = true;

    const loadStatus = () => {
      statusApi
        .getFloorStatusOverlay(floorId)
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
  }, [floorId]);

  const selectedRoom = useMemo(() => {
    if (!floorMetadata?.rooms) return null;
    return floorMetadata.rooms.find((r) => r.id === highlightedRoomId) || null;
  }, [highlightedRoomId, floorMetadata?.rooms]);

  if (metaLoading) {
    return <div className="p-8 text-center text-slate-500">Loading location data...</div>;
  }

  if (metaError || !floorMetadata) {
    return <div className="p-8 text-center text-red-500">Failed to load location data.</div>;
  }

  return (
    <section className="px-5 py-2 mb-8">
      <h3 className="text-sm font-bold text-slate-800 mb-4">Location</h3>
      
      <div className="w-full relative flex flex-col items-center">
        <h4 className="text-sm font-medium text-slate-600 mb-2 uppercase">
          {floorMetadata.name || floorMetadata.id.replace(/-/g, " ")}
        </h4>

        <div className="w-full h-[400px] relative bg-white border border-slate-100 rounded-lg overflow-hidden shadow-sm">
          {svgLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              Loading map...
            </div>
          )}
          {svgError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 p-4 text-center">
              <p className="font-semibold">Failed to load map.</p>
              <p className="text-xs mt-2 overflow-auto max-h-32 w-full break-words border border-red-200 p-2 rounded bg-red-50">
                {svgError.message || String(svgError)}
              </p>
            </div>
          )}
          {svgContent && (
            <>
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={openFullscreen}
                  className="p-2 bg-white/90 rounded-md shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition-colors"
                  title="View Full Screen"
                >
                  <Maximize2 size={18} />
                </button>
              </div>
              <InteractiveSvgMap
                svgContent={svgContent}
                statusOverlay={statusOverlay}
                highlightedRoomId={highlightedRoomId}
              />
            </>
          )}
          
          {/* Overlay Modal (for quick peek if we re-enable click, currently unused since click is disabled) */}
          <RoomQuickPeekModal
            room={selectedRoom}
            onClose={() => setHighlightedRoom(null)}
          />
        </div>
        
        <div className="w-full mt-3 flex flex-wrap justify-between items-center text-xs gap-2">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
              <span className="text-[11px] font-medium text-slate-600">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
              <span className="text-[11px] font-medium text-slate-600">Maintenance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-rose-500 rounded-full"></div>
              <span className="text-[11px] font-medium text-slate-600">Closed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
              <span className="text-[11px] font-medium text-slate-600">{highlightedRoomId || "Selected"}</span>
            </div>
          </div>
          
          {/* Floor Info */}
          <div className="text-right">
            <p className="text-slate-800 font-medium">
              {floorMetadata.buildingName || buildingId.toUpperCase()} - Level {floorMetadata.floor_number || floorMetadata.level}
            </p>
          </div>
        </div>
      </div>

      <FullscreenFloorModal 
        isOpen={isFullscreen}
        onClose={closeFullscreen}
        svgContent={svgContent || ''}
        floorMetadata={floorMetadata}
        statusOverlay={statusOverlay}
      />
    </section>
  );
}
