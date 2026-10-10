import { scheduleApi } from './scheduleApi';
import type { Building, Floor, Room } from './scheduleApi';

export interface CachedRoomMeta {
  roomId: string;
  roomNumber: string;
  nameEn: string;
  buildingId: string;
  buildingCode: string;
  floorId: string;
}

class FacilityCache {
  private buildingsPromise: Promise<{ buildings: Building[] }> | null = null;
  private floorsPromises: Map<string, Promise<{ floors: Floor[] }>> = new Map();
  private roomsPromises: Map<string, Promise<{ rooms: Room[] }>> = new Map();
  private roomPromises: Map<string, Promise<any>> = new Map();

  // Unified dictionaries for 0ms latency
  public buildingsMeta = new Map<string, Building>();
  public floorsMeta = new Map<string, Floor & { buildingId: string }>();
  public roomMeta = new Map<string, CachedRoomMeta>();

  async getBuildings(): Promise<{ buildings: Building[] }> {
    if (!this.buildingsPromise) {
      this.buildingsPromise = scheduleApi.getBuildings()
        .then(res => {
          res.buildings.forEach(b => this.buildingsMeta.set(b.id, b));
          return res;
        })
        .catch(err => {
          this.buildingsPromise = null;
          throw err;
        });
    }
    return this.buildingsPromise;
  }

  async getBuildingFloors(buildingId: string): Promise<{ floors: Floor[] }> {
    if (!this.floorsPromises.has(buildingId)) {
      const promise = scheduleApi.getBuildingFloors(buildingId)
        .then(res => {
          res.floors.forEach(f => this.floorsMeta.set(f.id, { ...f, buildingId }));
          return res;
        })
        .catch(err => {
          this.floorsPromises.delete(buildingId);
          throw err;
        });
      this.floorsPromises.set(buildingId, promise);
    }
    return this.floorsPromises.get(buildingId)!;
  }

  async getFloorRooms(floorId: string): Promise<{ rooms: Room[] }> {
    if (!this.roomsPromises.has(floorId)) {
      const promise = scheduleApi.getFloorRooms(floorId)
        .then(res => {
          const floor = this.floorsMeta.get(floorId);
          const building = floor ? this.buildingsMeta.get(floor.buildingId) : null;
          
          res.rooms.forEach(r => {
            this.roomMeta.set(r.id, {
              roomId: r.id,
              roomNumber: r.room_number,
              nameEn: r.name?.en || '',
              buildingId: building?.id || '',
              buildingCode: building?.code || '',
              floorId: floorId,
            });
          });
          return res;
        })
        .catch(err => {
          this.roomsPromises.delete(floorId);
          throw err;
        });
      this.roomsPromises.set(floorId, promise);
    }
    return this.roomsPromises.get(floorId)!;
  }

  async getRoom(roomId: string): Promise<any> {
    if (this.roomMeta.has(roomId)) {
      const meta = this.roomMeta.get(roomId)!;
      // Synthesize backend response format for compatibility
      return {
        id: meta.roomId,
        room_number: meta.roomNumber,
        name: { en: meta.nameEn },
        building: { id: meta.buildingId, code: meta.buildingCode },
        floor: { id: meta.floorId }
      };
    }

    if (!this.roomPromises.has(roomId)) {
      const promise = scheduleApi.getRoom(roomId)
        .then(res => {
          this.roomMeta.set(res.id, {
            roomId: res.id,
            roomNumber: res.room_number,
            nameEn: res.name?.en || '',
            buildingId: res.building?.id || '',
            buildingCode: res.building?.code || '',
            floorId: res.floor?.id || ''
          });
          return res;
        })
        .catch(err => {
          this.roomPromises.delete(roomId);
          throw err;
        });
      this.roomPromises.set(roomId, promise);
    }
    return this.roomPromises.get(roomId)!;
  }
}

export const facilityCache = new FacilityCache();
