import { useState, useMemo } from 'react';
import { 
  X, 
  ArrowLeft, 
  AlertTriangle, 
  CornerUpLeft, 
  CornerUpRight, 
  MoveUp, 
  CheckCircle2, 
  Footprints,
  ListOrdered,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  ChevronsDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { NavigationMap } from './NavigationMap';
import { StepDirectionsDrawer } from './StepDirectionsDrawer';
import { useSvgFloorPlan } from '../../campus-explorer/components/floor-viewer/hooks/useSvgFloorPlan';
import type { RouteResult, NavigationAction } from '../types/navigation.types';

interface NavigationViewProps {
  isOpen: boolean;
  route: RouteResult | null;
  isLoading?: boolean;
  onClose: () => void;
}

function getTurnIcon(action: NavigationAction) {
  switch (action) {
    case 'TURN_LEFT':
    case 'SLIGHT_LEFT':
      return <CornerUpLeft className="w-5 h-5 text-blue-600 stroke-[2.5]" />;
    case 'TURN_RIGHT':
    case 'SLIGHT_RIGHT':
      return <CornerUpRight className="w-5 h-5 text-blue-600 stroke-[2.5]" />;
    case 'DEPART':
      return <Footprints className="w-5 h-5 text-emerald-600 stroke-[2.2]" />;
    case 'ARRIVE':
      return <CheckCircle2 className="w-5 h-5 text-emerald-600 stroke-[2.5]" />;
    case 'ELEVATOR_UP':
      return <ChevronsUp className="w-5 h-5 text-indigo-600 stroke-[2.5]" />;
    case 'ELEVATOR_DOWN':
      return <ChevronsDown className="w-5 h-5 text-indigo-600 stroke-[2.5]" />;
    case 'STAIRS_UP':
      return <ArrowUpRight className="w-5 h-5 text-amber-600 stroke-[2.5]" />;
    case 'STAIRS_DOWN':
      return <ArrowDownRight className="w-5 h-5 text-amber-600 stroke-[2.5]" />;
    case 'CONTINUE':
    default:
      return <MoveUp className="w-5 h-5 text-blue-600 stroke-[2.5]" />;
  }
}

export const NavigationView: React.FC<NavigationViewProps> = ({
  isOpen,
  route,
  isLoading = false,
  onClose,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Determine SVG floor plan URL dynamically based on route target floor
  const floorSvgUrl = useMemo(() => {
    const floorId = route?.svg_path?.floor_id || route?.summary?.floor_id;
    if (floorId) {
      const parts = floorId.replace(/^FL_/, '').split('_');
      const bCode = parts[0] || 'LC4';
      const fNum = parseInt(parts[1], 10) || 1;
      return `/floor-plans/${bCode}-floor${fNum}-neutral.svg`;
    }
    return '/floor-plans/LC4-floor1-neutral.svg';
  }, [route]);

  const { svgContent, loading: mapLoading } = useSvgFloorPlan(floorSvgUrl);

  const steps = route?.steps || [];
  const currentStep = steps[currentStepIndex] || steps[0];

  const handlePrevStep = () => {
    if (currentStepIndex > 0) setCurrentStepIndex((prev) => prev - 1);
  };

  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) setCurrentStepIndex((prev) => prev + 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-white flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Header */}
      <header className="h-14 px-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 z-30">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="text-sm font-bold text-slate-900 leading-tight">
            Navigating to {route?.summary.destination_name || 'Destination'}
          </h1>
          <p className="text-[11px] text-slate-500 font-medium">
            From {route?.summary.start_name || 'Start Point'}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors"
          aria-label="Exit Navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Blocked / Rerouted Banner if active */}
      {route?.is_rerouted && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-center gap-2.5 text-rose-800 text-xs font-semibold z-20 animate-in slide-in-from-top duration-150">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1 leading-snug">
            Corridor closed for maintenance. Alternate route calculated automatically.
          </span>
        </div>
      )}

      {/* Main Map Canvas Area */}
      <div className="relative flex-1 w-full bg-slate-50 overflow-hidden">
        {isLoading || mapLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs font-medium text-slate-500">Calculating shortest route...</span>
          </div>
        ) : svgContent ? (
          <NavigationMap
            svgContent={svgContent}
            routeNodes={route?.svg_path.nodes || []}
            activeStepNodeIndex={currentStepIndex}
            highlightedRoomId={route?.summary.destination_name}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
            Map unavailable
          </div>
        )}

        {/* Top Floating Instruction Card */}
        {currentStep && (
          <div className="absolute top-4 left-4 right-4 z-20">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200/90 flex items-start gap-3.5 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 shadow-xs">
                {getTurnIcon(currentStep.action)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100/80">
                    {currentStep.action.replace('_', ' ')}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Step {currentStepIndex + 1} of {steps.length}
                  </span>
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  {currentStep.instruction}
                </h2>
                <div className="text-[11px] font-semibold text-slate-500 mt-1">
                  Distance: {currentStep.distance} meters
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Summary & Controls Sheet */}
      <footer className="bg-white border-t border-slate-200 p-4 shadow-xl z-30 shrink-0">
        <div className="flex items-center justify-between mb-3">
          {/* Distance and Estimated Time */}
          <div>
            <div className="text-lg font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span>{route?.summary.total_distance_meters || 45} m</span>
              <span className="text-xs font-semibold text-slate-400">•</span>
              <span className="text-sm font-bold text-blue-600">
                ~{route?.summary.estimated_time_minutes || 2} min
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              Shortest path via corridor-spine
            </p>
          </div>

          {/* Step Stepper Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
              className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-700 transition-colors"
              title="Previous Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-1">
              {currentStepIndex + 1}/{steps.length || 1}
            </span>
            <button
              onClick={handleNextStep}
              disabled={currentStepIndex >= steps.length - 1}
              className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-700 transition-colors"
              title="Next Step"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ListOrdered className="w-4 h-4 text-slate-500" />
            <span>All Steps ({steps.length})</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <span>End Navigation</span>
          </button>
        </div>
      </footer>

      {/* Step Directions Drawer */}
      <StepDirectionsDrawer
        isOpen={isDrawerOpen}
        steps={steps}
        currentStepIndex={currentStepIndex}
        totalDistance={route?.summary.total_distance_meters || 45}
        estimatedMinutes={route?.summary.estimated_time_minutes || 2}
        destinationName={route?.summary.destination_name || 'Room'}
        onClose={() => setIsDrawerOpen(false)}
        onSelectStep={(idx) => {
          setCurrentStepIndex(idx);
          setIsDrawerOpen(false);
        }}
      />
    </div>
  );
};
