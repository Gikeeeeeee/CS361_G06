import * as LucideIcons from 'lucide-react';
import type { RoomDetail } from '../../../shared/types/domain.types';

interface RoomEquipmentListProps {
  room: RoomDetail;
}

export function RoomEquipmentList({ room }: RoomEquipmentListProps) {
  if (!room.amenities || room.amenities.length === 0) return null;

  return (
    <section className="px-5 py-2 mb-8">
      <h3 className="text-sm font-bold text-slate-800 mb-4">Equipment & Facilities</h3>
      <div className="flex flex-col gap-3">
        {room.amenities.map((amenity) => {
          // Dynamically resolve icon from lucide-react, fallback to a standard icon if not found
          const iconName = amenity.icon as keyof typeof LucideIcons;
          const IconComponent = (LucideIcons[iconName] as React.ElementType) || LucideIcons.CheckCircle;
          
          return (
            <div key={amenity.id} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
              <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary">
                <IconComponent size={16} strokeWidth={2.5} />
              </div>
              <span className="text-sm font-semibold text-slate-700">{amenity.name}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
