import { useState, useEffect } from 'react';
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
import { facilityCache } from '../../admin-schedule/services/facilityCache';
import { campusService } from '../../campus-explorer/services';
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
  const [floorSvgUrl, setFloorSvgUrl] = useState<string | undefined>(route?.svg_path?.url);

  // Determine SVG floor plan URL dynamically from backend database / facility cache
  useEffect(() => {
    if (route?.svg_path?.url) {
      setFloorSvgUrl(route.svg_path.url);
      return;
    }

    const floorId = route?.svg_path?.floor_id || route?.summary?.floor_id;
    if (!floorId) {
      setFloorSvgUrl(undefined);
      return;
    }

    let isMounted = true;

    // 1. Check campusService by floorId from database
    campusService
      .getFloorById(floorId)
      .then((floor) => {
        if (!isMounted) return;
        const url = (floor as any)?.floor_plan?.url || (floor as any)?.map?.url;
        if (url) {
          setFloorSvgUrl(url);
          return;
        }
      })
      .catch(() => {});

    // 2. Try finding in facility cache
    const cachedFloor = facilityCache.floorsMeta.get(floorId);
    if (cachedFloor) {
      const url = (cachedFloor as any).floor_plan?.url || (cachedFloor as any).map?.url;
      if (url) {
        setFloorSvgUrl(url);
        return;
      }
    }

    // 3. Query facility cache across buildings
    facilityCache
      .getBuildings()
      .then(async (res) => {
        if (!isMounted) return;
        for (const b of res.buildings || []) {
          const floorRes = await facilityCache.getBuildingFloors(b.id).catch(() => ({ floors: [] }));
          const matched = floorRes.floors?.find(
            (f) => f.id === floorId || `FL_${b.code}_0${f.floor_number}` === floorId
          );
          if (matched) {
            const url = (matched as any).floor_plan?.url || (matched as any).map?.url;
            if (url && isMounted) {
              setFloorSvgUrl(url);
              return;
            }
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [route]);

  // Always reset to step 0 whenever route changes or modal opens
  useEffect(() => {
    setCurrentStepIndex(0);
    setIsDrawerOpen(false);
  }, [route, isOpen]);

  const steps = route?.steps || [];
  const safeStepIndex = Math.min(Math.max(0, currentStepIndex), Math.max(0, steps.length - 1));
  const currentStep = steps[safeStepIndex] || steps[0];
  const isFinished = safeStepIndex >= steps.length - 1 && steps.length > 0;
  const currentFloorNumber = currentStep?.floor_number || 1;

  // Multi-floor active floor plan resolution
  const activeFloorPlan = route?.svg_path.floor_plans?.[currentFloorNumber];
  const activeSvgUrl = activeFloorPlan?.url || floorSvgUrl;
  const activeRouteNodes = activeFloorPlan?.nodes || route?.svg_path.nodes || [];

  // Calculate local step index on the active floor
  const floorSteps = steps.filter((s) => (s.floor_number || 1) === currentFloorNumber);
  const localStepIndex = Math.max(
    0,
    floorSteps.findIndex((s) => s.step_index === currentStep?.step_index)
  );

  const { svgContent, loading: mapLoading } = useSvgFloorPlan(activeSvgUrl);

  const handlePrevStep = () => {
    if (safeStepIndex > 0) setCurrentStepIndex(safeStepIndex - 1);
  };

  const handleNextStep = () => {
    if (safeStepIndex < steps.length - 1) setCurrentStepIndex(safeStepIndex + 1);
  };

  const handleClose = () => {
    setCurrentStepIndex(0);
    setIsDrawerOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-white flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Header */}
      <header className="h-14 px-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 z-30">
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="text-sm font-bold text-slate-900 leading-tight">
            Navigating to {route?.summary.destination_name || 'Destination'}
          </h1>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Level {currentFloorNumber}
            </span>
            <span className="text-[11px] text-slate-400">•</span>
            <span className="text-[11px] text-slate-500 font-medium">
              From {route?.summary.start_name || 'Start Point'}
            </span>
          </div>
        </div>

        <button
          onClick={handleClose}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 z-20 gap-2.5">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs font-semibold text-slate-600">
              {mapLoading ? `Loading Floor ${currentFloorNumber} map...` : 'Calculating shortest route...'}
            </span>
          </div>
        ) : svgContent ? (
          <NavigationMap
            svgContent={svgContent}
            routeNodes={activeRouteNodes}
            activeStepNodeIndex={localStepIndex}
            highlightedRoomId={route?.summary.destination_name}
            isFinished={isFinished}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs font-medium text-slate-600">Loading Floor {currentFloorNumber} map...</span>
          </div>
        )}

        {/* Bottom Floating Instruction Card (Unobstructs SVG Floor Plan) */}
        {currentStep && (
          <div className="absolute bottom-3 left-3 right-3 z-20">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 shadow-xl border border-slate-200/90 flex items-start gap-3 transition-all animate-in fade-in slide-in-from-bottom-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 shadow-xs">
                {getTurnIcon(currentStep.action)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100/80">
                    {currentStep.action.replace('_', ' ')}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Step {safeStepIndex + 1} of {steps.length}
                  </span>
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  {currentStep.instruction}
                </h2>
                <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
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
              disabled={safeStepIndex === 0}
              className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-700 transition-colors"
              title="Previous Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-1">
              {safeStepIndex + 1}/{steps.length || 1}
            </span>
            <button
              onClick={handleNextStep}
              disabled={safeStepIndex >= steps.length - 1}
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
            onClick={handleClose}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer ${
              isFinished
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {isFinished ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Finished Navigation</span>
              </>
            ) : (
              <span>End Navigation</span>
            )}
          </button>
        </div>
      </footer>

      {/* Step Directions Drawer */}
      <StepDirectionsDrawer
        isOpen={isDrawerOpen}
        steps={steps}
        currentStepIndex={safeStepIndex}
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
