import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import type { Floor } from '../../../shared/types/domain.types';
import { floorService } from '../../../services/floorService';
import { useSvgFloorPlan } from '../../floor-viewer/hooks/useSvgFloorPlan';
import { InteractiveSvgMap } from '../../floor-viewer/components/InteractiveSvgMap';

interface RoomFloorPlanProps {
  floor: Floor | null;
}

export function RoomFloorPlan({ floor }: RoomFloorPlanProps) {
  const [fullFloor, setFullFloor] = useState<any>(null);
  const [roomNumber, setRoomNumber] = useState<string | undefined>(undefined);

  // ดึงข้อมูลชั้น และจับคู่หาเลขห้องจากรายชื่อ rooms ในชั้นนั้นทันที (หมดปัญหา 404)
  useEffect(() => {
    if (!floor?.id) return;
    
    floorService.getFloorById(floor.id).then((res: any) => {
      if (res) {
        setFullFloor(res);

        // แกะรอยไอดีจาก URL หน้าเว็บปัจจุบัน
        const pathSegments = window.location.pathname.split('/');
        const rawSlug = pathSegments[pathSegments.length - 1];

        if (rawSlug && res.rooms) {
          // ตัดคำนำหน้า (เช่น lc3_) ออก เพื่อให้เหลือเฉพาะ UUID แท้ๆ
          const targetUuid = rawSlug.includes('_') ? rawSlug.split('_')[1] : rawSlug;

          // ค้นหาห้องที่ตรงกับไอดีในชั้นนี้ เพื่อเอาเลขห้องจริง (เช่น 101, 102/1, 103)
          const matchedRoom = res.rooms.find(
            (r: any) => r.id === targetUuid || r.id === rawSlug
          );

          if (matchedRoom) {
            setRoomNumber(matchedRoom.room_number || matchedRoom.name);
          }
        }
      }
    });
  }, [floor?.id]);

  const rawFloorPlan = fullFloor?.floor_plan || (floor as any)?.floor_plan || floor?.floor_plan_key;
  const floorKey = typeof rawFloorPlan === 'object' && rawFloorPlan !== null 
    ? (rawFloorPlan as any).url 
    : rawFloorPlan;

  const { svgContent } = useSvgFloorPlan(floorKey);

  if (!floor) return null;

  return (
    <section className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Floor Plan & Location</h3>
        </div>
        <span className="text-xs font-semibold text-blue-600">Level {floor.floor_number}</span>
      </div>

      <div className="w-full rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="w-full aspect-[4/3] flex items-center justify-center p-4">
          {svgContent ? (
            <div className="w-full h-full flex items-center justify-center">
              {/* ส่งเลขห้องที่แมตช์ได้เข้าสู่แผนผัง SVG เพื่อไฮไลต์ถูกห้อง */}
              <InteractiveSvgMap svgContent={svgContent} roomNumber={roomNumber} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
              <MapPin className="w-8 h-8 opacity-40" />
              <span className="text-[10px] font-medium uppercase tracking-wider opacity-40">Floor Plan Unavailable</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}