import { mockBuildings } from './buildingData';
import type { CampusBuilding } from '../features/campus-map/types/mapDirectory.types';

// Augment the core building data with coordinate pins for map view mapping
export const campusBuildingsMock: CampusBuilding[] = [
  {
    ...mockBuildings.lc4,
    lat: 14.0722,
    lng: 100.6055,
  },
  {
    ...mockBuildings.lc3,
    lat: 14.0745,
    lng: 100.6080,
  }
];

export { mockBuildings };
export type { CampusBuilding };
