import type { Building } from '../../../shared/types/domain.types';
import { mockBuildings } from '../../../data/buildingData';

class BuildingService {
  /**
   * Fetches building details by ID.
   * Simulates a network request with a slight delay.
   */
  async getBuildingById(id: string): Promise<Building> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const building = mockBuildings[id.toLowerCase()];
        if (building) {
          resolve(building);
        } else {
          reject(new Error(`Building with id ${id} not found`));
        }
      }, 500); // 500ms simulated network latency
    });
  }

  /**
   * Fetches all available buildings.
   */
  async getAllBuildings(): Promise<Building[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Object.values(mockBuildings));
      }, 500);
    });
  }
}

export const buildingService = new BuildingService();
