import { Armchair, Snowflake, Monitor, MonitorPlay } from 'lucide-react';
import type { Room } from '../../../shared/types/domain.types';

interface RoomAmenitiesProps {
  room: Room;
}

interface AmenityItem {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function getAmenitiesFromRoom(room: Room): AmenityItem[] {
  const items: AmenityItem[] = [];

  // Derive from room.facilities (Record<string, boolean>)
  if (room.facilities) {
    const facilityMap: Record<string, { label: string; value: string; icon: React.ReactNode }> = {
      projector: { label: 'Display', value: 'Projector', icon: <MonitorPlay className="w-4 h-4 text-blue-500" /> },
      whiteboard: { label: 'Equipment', value: 'Whiteboard', icon: <Monitor className="w-4 h-4 text-blue-500" /> },
      air_conditioning: { label: 'Climate', value: 'Air Conditioning', icon: <Snowflake className="w-4 h-4 text-blue-500" /> },
      computer: { label: 'Equipment', value: 'Computer', icon: <Monitor className="w-4 h-4 text-blue-500" /> },
    };

    for (const [key, enabled] of Object.entries(room.facilities)) {
      if (enabled && facilityMap[key]) {
        items.push(facilityMap[key]);
      }
    }
  }

  // Always add seating capacity based on type
  const seatCount = room.type === 'CLASSROOM' ? 80 : room.type === 'LAB' ? 40 : room.type === 'MEETING_ROOM' ? 20 : 15;
  items.unshift({
    label: 'Seating',
    value: `${seatCount} Seats`,
    icon: <Armchair className="w-4 h-4 text-blue-500" />,
  });

  // Add climate if not already present
  if (!items.find(i => i.label === 'Climate')) {
    items.push({
      label: 'Climate',
      value: 'Air Conditioning',
      icon: <Snowflake className="w-4 h-4 text-blue-500" />,
    });
  }

  return items;
}

export function RoomAmenities({ room }: RoomAmenitiesProps) {
  const amenities = getAmenitiesFromRoom(room);

  if (amenities.length === 0) return null;

  return (
    <section className="px-5 pt-6 pb-2">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-blue-600 text-sm">☰</span>
          <h3 className="text-sm font-bold text-slate-900">Amenities & Facilities</h3>
        </div>
        <span className="text-xs font-medium text-slate-400">{amenities.length} items</span>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        {amenities.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 bg-white"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              {item.icon}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                {item.label}
              </span>
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
