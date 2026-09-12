// frontend/src/services/api/endpoints.ts
export const endpoints = {
  buildings: {
    list: () => '/buildings',
    detail: (buildingId: string) => `/buildings/${buildingId}`,
  },
  floors: {
    detail: (floorId: string) => `/floors/${floorId}`,
  },
  rooms: {
    detail: (roomId: string) => `/rooms/${roomId}`,
  },
  facilities: {
    detail: (facilityId: string) => `/facilities/${facilityId}`,
  },
};