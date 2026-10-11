import { X } from 'lucide-react';
import { InteractiveSvgMap } from './InteractiveSvgMap';
import type { FloorMetadata } from '../types/floorViewer.types';

interface FullscreenFloorModalProps {
  isOpen: boolean;
  onClose: () => void;
  svgContent: string;
  floorMetadata?: FloorMetadata | null;
}

export function FullscreenFloorModal({ isOpen, onClose, svgContent, floorMetadata }: FullscreenFloorModalProps) {
  if (!isOpen || !svgContent) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col backdrop-blur-sm">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-black/50 text-white border-b border-white/10">
        <h3 className="font-medium tracking-wide">
          {floorMetadata?.name || floorMetadata?.id.replace(/-/g, " ")} - Map Viewer
        </h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"
          title="Close Fullscreen (Esc)"
        >
          <X size={20} />
          <span className="text-sm font-medium hidden sm:inline">Close</span>
        </button>
      </div>

      {/* Viewer Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        <div className="w-[90vw] h-[80vh] flex items-center justify-center">
          <InteractiveSvgMap
            svgContent={svgContent}
            minScale={0.3}
            maxScale={5}
            showControls={true}
          />
        </div>
      </div>
    </div>
  );
}
