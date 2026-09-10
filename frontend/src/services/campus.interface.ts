import type { Building, Floor, Room, Facility } from '../shared/types/domain.types';

export interface ICampusService {
  /**
   * Fetch all buildings on campus.
   */
  getBuildings(): Promise<Building[]>;

  /**
   * Fetch a specific building by its ID.
   */
  getBuildingById(buildingId: string): Promise<Building | null>;

  /**
   * Fetch floors for a specific building.
   */
  getFloorsByBuildingId(buildingId: string): Promise<Floor[]>;

  /**
   * Fetch a specific floor by its ID.
   */
  getFloorById(floorId: string): Promise<Floor | null>;

  /**
   * Fetch rooms for a specific floor.
   */
  getRoomsByFloorId(floorId: string): Promise<Room[]>;

  /**
   * Fetch facilities for a specific floor.
   */
  getFacilitiesByFloorId(floorId: string): Promise<Facility[]>;
}
