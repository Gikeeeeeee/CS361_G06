export const endpoints = {
  buildings: {
    list: () => '/buildings',
    detail: (buildingId: string) => `/buildings/${buildingId}`,
  },
  floors: {
    detail: (buildingId: string, floorId: string) => `/buildings/${buildingId}/floors/${floorId}`,
  },
};
