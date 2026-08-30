import type { Building } from '../shared/types/domain.types';

export const mockBuildings: Record<string, Building> = {
  lc4: {
    id: 'lc4',
    code: 'LC4',
    name: 'Lecture Complex 4',
    description: 'Modern lecture complex featuring large capacity lecture halls, state-of-the-art laboratories, and collaborative study spaces designed for interactive learning.',
    imageUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1000',
    status: 'OPEN',
    latitude: 14.0722,
    longitude: 100.6055,
    opening_hours: {
      "monday": "08:00 - 20:00",
      "tuesday": "08:00 - 20:00",
      "wednesday": "08:00 - 20:00",
      "thursday": "08:00 - 20:00",
      "friday": "08:00 - 20:00",
      "saturday": "closed",
      "sunday": "closed"
    },
    stats: {
      totalFloors: 3,
      totalRooms: 12,
      availableFacilities: ['LAB', 'CLASSROOM', 'RESTROOM', 'STAIRS', 'ELEVATOR'],
    },
    floors: [
      {
        id: 'lc4-f1',
        floor_number: 1,
        name: 'Floor 1',
        map: { type: 'svg', url: '/maps/lc4/lc4-f1.svg' },
        rooms: [
          { id: 'room-4101', name: 'Large Lecture Hall', type: 'CLASSROOM', latitude: 0, longitude: 0 },
          { id: 'room-4102', name: 'Physics Lab', type: 'LAB', latitude: 0, longitude: 0 },
        ],
        facilities: [
          { id: 'fac-rr1', name: 'Restrooms', type: 'RESTROOM', latitude: 0, longitude: 0 },
          { id: 'fac-el1', name: 'Elevator', type: 'ELEVATOR', latitude: 0, longitude: 0 },
        ],
      },
      {
        id: 'lc4-f2',
        floor_number: 2,
        name: 'Floor 2',
        map: { type: 'svg', url: '/maps/lc4/lc4-f2.svg' },
        rooms: [
          { id: 'room-4201', name: 'Computer Lab A', type: 'LAB', latitude: 0, longitude: 0 },
          { id: 'room-4202', name: 'Seminar Room', type: 'CLASSROOM', latitude: 0, longitude: 0 },
          { id: 'room-4203', name: 'Faculty Office', type: 'OFFICE', latitude: 0, longitude: 0 },
        ],
        facilities: [
          { id: 'fac-rr2', name: 'Restrooms', type: 'RESTROOM', latitude: 0, longitude: 0 },
        ],
      },
      {
        id: 'lc4-f3',
        floor_number: 3,
        name: 'Floor 3',
        map: { type: 'svg', url: '/maps/lc4/lc4-f3.svg' },
        rooms: [
          { id: 'room-4301', name: 'Chemistry Lab', type: 'LAB', latitude: 0, longitude: 0 },
          { id: 'room-4302', name: 'Chemistry Lab', type: 'LAB', latitude: 0, longitude: 0 },
        ],
        facilities: [
          { id: 'fac-rr3', name: 'Restrooms', type: 'RESTROOM', latitude: 0, longitude: 0 },
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
    latitude: 14.0725,
    longitude: 100.6058,
    opening_hours: {
      "monday": "08:00 - 18:00",
      "tuesday": "08:00 - 18:00",
      "wednesday": "08:00 - 18:00",
      "thursday": "08:00 - 18:00",
      "friday": "08:00 - 18:00",
      "saturday": "closed",
      "sunday": "closed"
    },
    stats: {
      totalFloors: 2,
      totalRooms: 8,
      availableFacilities: ['CLASSROOM', 'OFFICE', 'RESTROOM', 'STAIRS'],
    },
    floors: [
      {
        id: 'lc3-f1',
        floor_number: 1,
        name: 'Floor 1',
        map: { type: 'svg', url: '/maps/lc3/lc3-f1.svg' },
        rooms: [
          { id: 'room-3101', name: 'Classroom A', type: 'CLASSROOM', latitude: 0, longitude: 0 },
          { id: 'room-3102', name: 'Classroom B', type: 'CLASSROOM', latitude: 0, longitude: 0 },
        ],
        facilities: [
          { id: 'fac-rr1', name: 'Restrooms', type: 'RESTROOM', latitude: 0, longitude: 0 },
        ],
      },
      {
        id: 'lc3-f2',
        floor_number: 2,
        name: 'Floor 2',
        map: { type: 'svg', url: '/maps/lc3/lc3-f2.svg' },
        rooms: [
          { id: 'room-3201', name: 'Admin Office', type: 'OFFICE', latitude: 0, longitude: 0 },
          { id: 'room-3202', name: 'Meeting Room', type: 'OFFICE', latitude: 0, longitude: 0 },
        ],
        facilities: [
          { id: 'fac-rr2', name: 'Restrooms', type: 'RESTROOM', latitude: 0, longitude: 0 },
        ],
      },
    ],
  }
};
