import { Building, ChevronRight, Clock } from 'lucide-react';
import type { CampusBuilding } from '../types/mapDirectory.types';
import { Badge } from '../../../shared/components/Badge';

interface BuildingDirectoryCardProps {
  building: CampusBuilding;
  onClick: () => void;
}

export function BuildingDirectoryCard({ building, onClick }: BuildingDirectoryCardProps) {
  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer active:scale-[0.98] group"
    >
      <div className="flex items-center gap-4">
        {/* Left icon box */}
        <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-blue-900 flex items-center justify-center text-white">
          <Building className="w-6 h-6" />
        </div>
        
        {/* Middle content */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-slate-900 font-bold text-base">{building.code}</span>
            <Badge 
              variant="default"
              className={`text-[10px] py-0 h-4 px-2 border-none ${
                building.status === 'OPEN'
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-rose-500/10 text-rose-600'
              }`}
            >
              {building.status}
            </Badge>
          </div>
          <span className="text-slate-500 text-xs font-semibold mb-1 line-clamp-1">{building.name}</span>
          <div className="flex items-center text-[11px] text-slate-400 font-medium">
            <Clock className="w-3.5 h-3.5 mr-1" />
            <span>เปิดทำการ {building.operatingHours} น.</span>
          </div>
        </div>
      </div>
      
      {/* Right Action */}
      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:bg-primary-50 transition-colors">
        <ChevronRight className="w-4 h-4" />
      </div>
    </div>
  );
}
