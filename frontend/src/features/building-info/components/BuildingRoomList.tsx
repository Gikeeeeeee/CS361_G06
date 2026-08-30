import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Floor } from '../types/buildingInfo.types';
import { Card, CardContent } from '../../../shared/components/Card';
import { Badge } from '../../../shared/components/Badge';
import { Search, MapPin, ChevronRight, Beaker, GraduationCap, Briefcase, UserRound, ArrowUpDown } from 'lucide-react';

interface BuildingRoomListProps {
  floor: Floor;
}

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

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'LAB': return 'destructive';
      case 'CLASSROOM': return 'default';
      case 'OFFICE': return 'secondary';
      default: return 'outline';
    }
  };

  const allItems = useMemo(() => {
    return [
      ...floor.rooms.map(r => ({ ...r, isFacility: false })),
      ...floor.facilities.map(f => ({ ...f, isFacility: true, number: 'FAC' }))
    ];
  }, [floor]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return allItems;
    const lowerQuery = searchQuery.toLowerCase();
    return allItems.filter(
      item => 
        item.name.toLowerCase().includes(lowerQuery) || 
        item.number?.toLowerCase().includes(lowerQuery) ||
        item.type.toLowerCase().includes(lowerQuery)
    );
  }, [allItems, searchQuery]);

  const handleItemClick = (item: any) => {
    if (item.isFacility) {
      if (item.svgId) {
        console.log('Clicked facility to highlight svgId:', item.svgId);
      }
      return;
    }
    if (buildingId) {
      navigate(`/rooms/${buildingId}-${item.number.toLowerCase()}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search rooms or facilities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
        />
      </div>

      <div className="space-y-3 pb-24">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No rooms or facilities found.</p>
            <p className="text-sm text-slate-400 mt-1">Try a different search term</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className="overflow-hidden cursor-pointer group active:scale-[0.98] transition-all duration-300 mb-3 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
              onClick={() => handleItemClick(item)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-primary-50 group-hover:text-primary transition-colors">
                    {getIconForType(item.type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{item.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {!item.isFacility ? `Room ${item.number}` : 'Facility'}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                      <Badge variant={getBadgeVariant(item.type) as any} className="text-[10px] py-0 h-4 px-2 font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 border-none">
                        {item.type}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
