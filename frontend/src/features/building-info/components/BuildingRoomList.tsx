import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Floor, Room, Facility } from '../../../shared/types/domain.types';
import { Card, CardContent } from '../../../shared/components/Card';
import { Search, MapPin, ChevronRight, Beaker, GraduationCap, Briefcase, UserRound, ArrowUpDown } from 'lucide-react';

interface BuildingRoomListProps {
  floor: Floor;
}

type BuildingListItem = 
  | (Room & { isFacility: false })
  | (Facility & { isFacility: true });

export function BuildingRoomList({ floor }: BuildingRoomListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { buildingId } = useParams<{ buildingId: string }>();

  const getIconForType = (type: string) => {
    switch (type) {
      case 'LAB': return <Beaker className="w-4 h-4" />;
      case 'CLASSROOM': return <GraduationCap className="w-4 h-4" />;
      case 'OFFICE': return <Briefcase className="w-4 h-4" />;
      case 'RESTROOM': return <UserRound className="w-4 h-4" />;
      case 'ELEVATOR': return <ArrowUpDown className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'LAB': return 'bg-emerald-50 text-emerald-700';
      case 'CLASSROOM': return 'bg-blue-50 text-blue-700';
      case 'OFFICE': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const allItems: BuildingListItem[] = useMemo(() => {
    return [
      ...(floor.rooms || []).map(r => ({ ...r, isFacility: false as const })),
      ...(floor.facilities || []).map(f => ({ ...f, isFacility: true as const }))
    ];
  }, [floor]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return allItems;
    const lowerQuery = searchQuery.toLowerCase();
    return allItems.filter(item => {
      const matchName = item.name.th.toLowerCase().includes(lowerQuery) ||
        item.name.en.toLowerCase().includes(lowerQuery);
      const matchType = item.type.toLowerCase().includes(lowerQuery);
      let matchRoom = false;
      if (!item.isFacility) {
        const roomItem = item as Room & { isFacility: false };
        matchRoom = roomItem.room_number
          ? roomItem.room_number.toLowerCase().includes(lowerQuery)
          : false;
      }
      return matchName || matchType || matchRoom;
    });
  }, [allItems, searchQuery]);

  const handleItemClick = (item: BuildingListItem) => {
    if (!buildingId) return;
    if (item.isFacility) {
      navigate(`/facilities/${buildingId}_${item.id}`);
    } else {
      navigate(`/rooms/${buildingId}_${item.id}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Search Bar & Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search rooms or facilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
          />
        </div>
        <button className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
        </button>
      </div>

      <div className="space-y-3 pb-24">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-100">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium text-sm">No rooms or facilities found.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className="overflow-hidden cursor-pointer group active:scale-[0.98] transition-all duration-300 mb-3 border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl bg-white"
              onClick={() => handleItemClick(item)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-primary-50 group-hover:text-primary transition-colors flex-shrink-0">
                    {getIconForType(item.type)}
                  </div>
                  {/* เพิ่ม min-w-0 เพื่อบังคับให้ flex ยอมหดตัวและทำงานร่วมกับ truncate ได้สมบูรณ์ */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <h3 className="font-bold text-slate-800 text-[13px] leading-tight truncate">{item.name.th}</h3>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">{item.name.en}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex-shrink-0">
                        {item.isFacility
                          ? 'FACILITY'
                          : `ROOM ${(item as Room & { isFacility: false }).room_number || ''}`
                        }
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300 flex-shrink-0"></span>
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${getBadgeStyle(item.type)}`}>
                        {item.type}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors flex-shrink-0 ml-2" />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}