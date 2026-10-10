import { useControls } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, Maximize, Minimize } from "lucide-react";

interface FloorZoomControlsProps {
  onCloseFullscreen?: () => void;
}

export function FloorZoomControls({ onCloseFullscreen }: FloorZoomControlsProps) {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="flex flex-col bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => zoomIn(0.5)}
        className="p-3 text-slate-600 hover:text-blue-600 hover:bg-slate-50 border-b border-slate-100 transition-colors"
        title="Zoom In"
      >
        <ZoomIn size={20} />
      </button>
      <button
        onClick={() => zoomOut(0.5)}
        className="p-3 text-slate-600 hover:text-blue-600 hover:bg-slate-50 border-b border-slate-100 transition-colors"
        title="Zoom Out"
      >
        <ZoomOut size={20} />
      </button>
      <button
        onClick={() => resetTransform()}
        className="p-3 text-slate-600 hover:text-blue-600 hover:bg-slate-50 border-b border-slate-100 transition-colors"
        title="Reset View"
      >
        <Maximize size={20} />
      </button>
      {onCloseFullscreen && (
        <button
          onClick={onCloseFullscreen}
          className="p-3 text-slate-600 hover:text-red-600 hover:bg-slate-50 transition-colors"
          title="Exit Fullscreen"
        >
          <Minimize size={20} />
        </button>
      )}
    </div>
  );
}
