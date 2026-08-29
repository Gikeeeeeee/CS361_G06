import { ChevronUp, ChevronDown } from 'lucide-react';
import { Badge } from '../../../shared/components/Badge';

interface SheetDragHeaderProps {
  isExpanded: boolean;
  totalBuildings: number;
  totalRooms: number;
  onToggle: () => void;
}

export function SheetDragHeader({ isExpanded, totalBuildings, totalRooms, onToggle }: SheetDragHeaderProps) {
  return (
    <div className="w-full flex flex-col items-center pt-3 pb-4 rounded-t-[32px] bg-white flex-shrink-0 relative z-20 cursor-grab active:cursor-grabbing border-b border-slate-50">
      <div className="w-12 h-1.5 bg-slate-300 rounded-full mb-3.5" />
      
      <div className="w-full px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-slate-900 font-bold text-lg">Directory</h2>
          <Badge variant="secondary" className="bg-slate-50 text-slate-500 font-bold text-xs px-2.5 py-0.5 border-none">
            {totalBuildings} buildings • {totalRooms} rooms
          </Badge>
        </div>
        <button 
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-500" />
          ) : (
            <ChevronUp className="w-5 h-5 text-slate-500" />
          )}
        </button>
      </div>
    </div>
  );
}
