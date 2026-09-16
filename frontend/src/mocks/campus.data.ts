import type { Building, Floor, Room, Facility } from '../shared/types/domain.types';

export const mockRooms: Room[] = [
  {
    id: 'room-1',
    room_number: 'LC4-101',
    name: { th: 'ห้องเรียน 101', en: 'Classroom 101' },
    type: 'CLASSROOM',
    facilities: { projector: true, whiteboard: true },
    schedule: null,
    event: null,
    image_key: 'rooms/lc4-101/image.jpg',
    latitude: 14.0740,
    longitude: 100.6060,
  },
];

export const mockFacilities: Facility[] = [
  {
    id: 'fac-1',
    name: { th: 'ห้องน้ำชาย', en: 'Men Restroom' },
    description: null,
    type: 'RESTROOM' as any, // In case domain doesn't have RESTROOM in FacilityType, we cast or assume it's valid if we add it
    latitude: 14.0741,
    longitude: 100.6061,
  },
];

export const mockFloors: Floor[] = [
  {
    id: 'floor-1',
    floor_number: 1,
    floor_plan_key: 'floors/lc4-1/plan.svg',
    rooms: mockRooms,
    facilities: mockFacilities,
  },
];

export const mockBuildings: Building[] = [
  {
    id: 'bldg-1',
    code: 'LC4',
    name: { th: 'อาคารเรียนรวม 4', en: 'Lecture Center 4' },
    description: { th: 'ศูนย์รวมห้องเรียนบรรยายขนาดใหญ่ พร้อมอุปกรณ์สื่อการเรียนการสอนครบครัน รองรับนิสิตทุกคณะ', en: 'Large lecture hall complex equipped with comprehensive teaching technologies for all faculties.' },
    image_url: null,
    opening_hours: '08:00 - 20:00 (Mon - Sat)',
    latitude: 14.0740,
    longitude: 100.6060,
    floors: mockFloors,
  },
  {
    id: 'bldg-2',
    code: 'LC3',
    name: { th: 'อาคารเรียนรวม 3', en: 'Lecture Center 3' },
    description: { th: 'อาคารเรียนบรรยายขนาดกลาง พร้อมระบบเครือข่ายอินเทอร์เน็ตความเร็วสูง', en: 'Medium lecture building with high-speed wireless campus network access.' },
    image_url: null,
    opening_hours: '08:00 - 20:00 (Mon - Fri)',
    latitude: 14.0750,
    longitude: 100.6070,
    floors: [],
  }
];
