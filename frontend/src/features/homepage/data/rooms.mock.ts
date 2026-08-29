import type { RoomItem } from '../types/directory.types';

export const MOCK_ROOMS: RoomItem[] = [
  {
    id: '1',
    code: 'LC.4-201',
    name: 'Computer Lab A',
    building: 'LC.4',
    category: 'Labs',
    status: 'AVAILABLE',
    type: 'lab',
  },
  {
    id: '2',
    code: 'LC.4-205',
    name: 'Lecture Room 2',
    building: 'LC.4',
    category: 'Classrooms',
    status: 'OCCUPIED',
    type: 'lecture',
  },
  {
    id: '3',
    code: 'LC.3-101',
    name: 'Lecture Room 1',
    building: 'LC.3',
    category: 'Classrooms',
    status: 'AVAILABLE',
    type: 'lecture',
  },
];