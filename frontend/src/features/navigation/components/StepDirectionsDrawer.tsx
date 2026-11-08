import React from 'react';
import { 
  X, 
  CornerUpLeft, 
  CornerUpRight, 
  MoveUp, 
  CheckCircle2, 
  Footprints,
  ChevronsUp,
  ChevronsDown,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import type { RouteStep, NavigationAction } from '../types/navigation.types';

interface StepDirectionsDrawerProps {
  isOpen: boolean;
  steps: RouteStep[];
  currentStepIndex: number;
  totalDistance?: number;
  estimatedMinutes?: number;
  destinationName: string;
  onClose: () => void;
  onSelectStep?: (index: number) => void;
}

function getActionIcon(action: NavigationAction) {
  switch (action) {
    case 'TURN_LEFT':
    case 'SLIGHT_LEFT':
      return <CornerUpLeft className="w-4 h-4 text-blue-600" />;
    case 'TURN_RIGHT':
    case 'SLIGHT_RIGHT':
      return <CornerUpRight className="w-4 h-4 text-blue-600" />;
    case 'DEPART':
      return <Footprints className="w-4 h-4 text-emerald-600" />;
    case 'ARRIVE':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case 'ELEVATOR_UP':
      return <ChevronsUp className="w-4 h-4 text-indigo-600" />;
    case 'ELEVATOR_DOWN':
      return <ChevronsDown className="w-4 h-4 text-indigo-600" />;
    case 'STAIRS_UP':
      return <ArrowUpRight className="w-4 h-4 text-amber-600" />;
    case 'STAIRS_DOWN':
      return <ArrowDownRight className="w-4 h-4 text-amber-600" />;
    case 'CONTINUE':
    default:
      return <MoveUp className="w-4 h-4 text-blue-600" />;
  }
}

export const StepDirectionsDrawer: React.FC<StepDirectionsDrawerProps> = ({
  isOpen,
  steps,
  currentStepIndex,
  destinationName,
  onClose,
  onSelectStep,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-150">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-200"
        role="dialog"
      >
        {/* Pull Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Step-by-Step Directions</h2>
            <p className="text-[11px] text-slate-500">
              {steps.length} steps to {destinationName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-2">
          {steps.map((step, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isPast = idx < currentStepIndex;

            return (
              <div
                key={step.step_index || idx}
                onClick={() => onSelectStep?.(idx)}
                className={`p-3 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-50/70 border-blue-200 shadow-xs ring-1 ring-blue-400'
                    : isPast
                    ? 'bg-slate-50/50 border-slate-100 opacity-60'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Step badge */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isPast
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {getActionIcon(step.action)}
                </div>

                {/* Instruction details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                      Step {step.step_index || idx + 1} • {step.action.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-800 leading-snug">
                    {step.instruction}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Return Button */}
        <div className="pt-3 border-t border-slate-100 mt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Back to Map
          </button>
        </div>
      </div>
    </div>
  );
};
