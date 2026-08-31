export const endpoints = {
  buildings: {
    list: () => '/buildings',
    detail: (buildingId: string) => `/buildings/${buildingId}`,
  },
  floors: {
    detail: (buildingId: string, floorId: string) => `/buildings/${buildingId}/floors/${floorId}`,
  },
  // เส้น 4: GET Info data (room pin)
  rooms: {
    detail: (buildingId: string, floorId: string, roomId: string) => 
      `/buildings/${buildingId}/floors/${floorId}/rooms/${roomId}`,
  },
  // เส้น 5: GET Info data (facilities pin)
  facilities: {
    detail: (buildingId: string, floorId: string, facilityId: string) => 
      `/buildings/${buildingId}/floors/${floorId}/facilities/${facilityId}`,
  },
};