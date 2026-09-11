import * as LucideIcons from 'lucide-react';
import type { Room } from '../../../shared/types/domain.types';

interface RoomEquipmentListProps {
  room: Room;
}

export function RoomEquipmentList({ room }: RoomEquipmentListProps) {
  // Mocking amenities since they are not in the core domain spec for Room
  const amenities = room.type === 'LAB' ? [
    { id: 'am-1', name: 'Chemical Fume Hood', icon: 'Shield' },
    { id: 'am-2', name: 'Emergency Eyewash', icon: 'Heart' },
    { id: 'am-3', name: 'Lab Bench Equipment', icon: 'Wrench' }
  ] : room.type === 'CLASSROOM' ? [
    { id: 'am-1', name: 'Projector', icon: 'Projector' },
    { id: 'am-2', name: 'Whiteboard', icon: 'Square' },
    { id: 'am-3', name: 'Audio System', icon: 'Speaker' }
  ] : [
    { id: 'am-1', name: 'Desk Phone', icon: 'Phone' },
    { id: 'am-2', name: 'Meeting Table', icon: 'Grid' }
  ];

  if (amenities.length === 0) return null;

  return (
    <section className="px-5 py-2 mb-8">
      <h3 className="text-sm font-bold text-slate-800 mb-4">Equipment & Facilities</h3>
      <div className="flex flex-col gap-3">
        {amenities.map((amenity) => {
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
