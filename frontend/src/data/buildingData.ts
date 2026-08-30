import type { Building } from '../shared/types/domain.types';

export const mockBuildings: Record<string, Building> = {
  lc4: {
    id: 'lc4',
    code: 'LC4',
    name: 'Lecture Complex 4',
    description: 'Modern lecture complex featuring large capacity lecture halls, state-of-the-art laboratories, and collaborative study spaces designed for interactive learning.',
    imageUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1000',
    status: 'OPEN',
    operatingHours: '08:00 - 20:00',
    stats: {
      totalFloors: 3,
      totalRooms: 12,
      availableFacilities: ['LAB', 'CLASSROOM', 'RESTROOM', 'STAIRS', 'ELEVATOR'],
    },
    floors: [
      {
        id: 'lc4-f1',
        level: 1,
        name: 'Floor 1',
        rooms: [
          { id: 'r-4101', number: '4101', name: 'Large Lecture Hall', type: 'CLASSROOM', svgId: 'room-4101' },
          { id: 'r-4102', number: '4102', name: 'Physics Lab', type: 'LAB', svgId: 'room-4102' },
        ],
        facilities: [
          { id: 'f-rr1', name: 'Restrooms', type: 'RESTROOM', svgId: 'fac-rr1' },
          { id: 'f-el1', name: 'Elevator', type: 'ELEVATOR', svgId: 'fac-el1' },
        ],
      },
      {
        id: 'lc4-f2',
        level: 2,
        name: 'Floor 2',
        rooms: [
          { id: 'r-4201', number: '4201', name: 'Computer Lab A', type: 'LAB', svgId: 'room-4201' },
          { id: 'r-4202', number: '4202', name: 'Seminar Room', type: 'CLASSROOM', svgId: 'room-4202' },
          { id: 'r-4203', number: '4203', name: 'Faculty Office', type: 'OFFICE', svgId: 'room-4203' },
        ],
        facilities: [
          { id: 'f-rr2', name: 'Restrooms', type: 'RESTROOM', svgId: 'fac-rr2' },
        ],
      },
      {
        id: 'lc4-f3',
        level: 3,
        name: 'Floor 3',
        rooms: [
          { id: 'r-4301', number: '4301', name: 'Chemistry Lab', type: 'LAB', svgId: 'room-4301' },
          { id: 'r-4302', number: '4302', name: 'Chemistry Lab', type: 'LAB', svgId: 'room-4302' },
        ],
        facilities: [
          { id: 'f-rr3', name: 'Restrooms', type: 'RESTROOM', svgId: 'fac-rr3' },
        ],
      }
    ],
  },
  lc3: {
    id: 'lc3',
    code: 'LC3',
    name: 'Lecture Complex 3',
    description: 'Traditional lecture complex with medium-sized classrooms and administrative offices.',
    imageUrl: 'https://images.unsplash.com/photo-1592289146196-1c70e309fb13?auto=format&fit=crop&q=80&w=1000',
    status: 'CLOSED',
    operatingHours: '08:00 - 18:00',
    stats: {
      totalFloors: 2,
      totalRooms: 8,
      availableFacilities: ['CLASSROOM', 'OFFICE', 'RESTROOM', 'STAIRS'],
    },
    floors: [
      {
        id: 'lc3-f1',
        level: 1,
        name: 'Floor 1',
        rooms: [
          { id: 'r-3101', number: '3101', name: 'Classroom A', type: 'CLASSROOM', svgId: 'room-3101' },
          { id: 'r-3102', number: '3102', name: 'Classroom B', type: 'CLASSROOM', svgId: 'room-3102' },
        ],
        facilities: [
          { id: 'f-rr1', name: 'Restrooms', type: 'RESTROOM', svgId: 'fac-rr1' },
        ],
      },
      {
        id: 'lc3-f2',
        level: 2,
        name: 'Floor 2',
        rooms: [
          { id: 'r-3201', number: '3201', name: 'Admin Office', type: 'OFFICE', svgId: 'room-3201' },
          { id: 'r-3202', number: '3202', name: 'Meeting Room', type: 'OFFICE', svgId: 'room-3202' },
        ],
        facilities: [
          { id: 'f-rr2', name: 'Restrooms', type: 'RESTROOM', svgId: 'fac-rr2' },
        ],
      },
    ],
  }
};
