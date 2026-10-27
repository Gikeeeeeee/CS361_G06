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

const SESSION_CACHE_KEY = 'ku_long_facility_rooms_cache';

class FacilityCache {
  private buildingsPromise: Promise<{ buildings: Building[] }> | null = null;
  private floorsPromises: Map<string, Promise<{ floors: Floor[] }>> = new Map();
  private roomsPromises: Map<string, Promise<{ rooms: Room[] }>> = new Map();
  private roomPromises: Map<string, Promise<any>> = new Map();
  private preloadPromise: Promise<void> | null = null;
  public isPreloaded = false;

  // Unified dictionaries for 0ms latency
  public buildingsMeta = new Map<string, Building>();
  public floorsMeta = new Map<string, Floor & { buildingId: string }>();
  public roomMeta = new Map<string, CachedRoomMeta>();

  constructor() {
    try {
      const saved = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.roomMeta = new Map(parsed);
          this.isPreloaded = true;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveToSessionStorage(): void {
    try {
      if (this.roomMeta.size > 0) {
        sessionStorage.setItem(
          SESSION_CACHE_KEY,
          JSON.stringify(Array.from(this.roomMeta.entries()))
        );
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Preload all campus buildings, floors, and rooms in one bundled operation.
   * Instead of firing 20-30 individual room requests (which can cause 503 errors),
   * this fetches all rooms floor-by-floor once and caches them for 0ms lookups.
   */
  async preloadCampusRooms(): Promise<void> {
    if (this.isPreloaded && this.roomMeta.size > 0) {
      return;
    }

    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = (async () => {
      try {
        const { buildings } = await this.getBuildings();
        const floorsArray = await Promise.all(
          buildings.map(b => this.getBuildingFloors(b.id).catch(() => ({ floors: [] })))
        );
        const allFloorsWithMeta: { floor: Floor; buildingCode: string }[] = [];
        floorsArray.forEach((res, idx) => {
          const bCode = buildings[idx]?.code || '';
          res.floors.forEach(f => allFloorsWithMeta.push({ floor: f, buildingCode: bCode }));
        });

        await Promise.all(
          allFloorsWithMeta.map(({ floor, buildingCode }) => {
            const label = `${buildingCode}_Floor${floor.floor_number ?? ''}`;
            return this.getFloorRooms(floor.id, label).catch(() => ({ rooms: [] }));
          })
        );
        this.isPreloaded = true;
        this.saveToSessionStorage();
      } catch (err) {
        console.warn('FacilityCache preload error:', err);
      }
    })();

    return this.preloadPromise;
  }

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

  async getFloorRooms(floorId: string, label?: string): Promise<{ rooms: Room[] }> {
    if (!this.roomsPromises.has(floorId)) {
      const promise = scheduleApi.getFloorRooms(floorId, label)
        .then(res => {
          const floor = this.floorsMeta.get(floorId);
          const building = floor ? this.buildingsMeta.get(floor.buildingId) : null;
          
          res.rooms.forEach(r => {
            this.roomMeta.set(r.id, {
              roomId: r.id,
              roomNumber: r.room_number || '',
              nameEn: r.name?.en || '',
              buildingId: building?.id || '',
              buildingCode: building?.code || '',
              floorId: floorId,
            });
          });
          this.saveToSessionStorage();
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

    // If preloading has completed and this room isn't in any floor, fallback cleanly
    if (this.isPreloaded) {
      const fallbackMeta: CachedRoomMeta = {
        roomId,
        roomNumber: '',
        nameEn: roomId.length > 15 ? `${roomId.slice(0, 8)}...` : roomId,
        buildingId: '',
        buildingCode: '',
        floorId: '',
      };
      this.roomMeta.set(roomId, fallbackMeta);
      return {
        id: roomId,
        room_number: '',
        name: { en: fallbackMeta.nameEn },
        building: { id: '', code: '' },
        floor: { id: '' }
      };
    }

    if (!this.roomPromises.has(roomId)) {
      const promise = scheduleApi.getRoom(roomId)
        .then(res => {
          this.roomMeta.set(res.id, {
            roomId: res.id,
            roomNumber: res.room_number || '',
            nameEn: res.name?.en || '',
            buildingId: res.building?.id || '',
            buildingCode: res.building?.code || '',
            floorId: res.floor?.id || ''
          });
          return res;
        })
        .catch(err => {
          // Fallback cache so temporary 503/network failure does not trigger infinite retry loops
          this.roomMeta.set(roomId, {
            roomId,
            roomNumber: '',
            nameEn: roomId.length > 15 ? `${roomId.slice(0, 8)}...` : roomId,
            buildingId: '',
            buildingCode: '',
            floorId: '',
          });
          setTimeout(() => {
            this.roomPromises.delete(roomId);
          }, 60000);
          throw err;
        });
      this.roomPromises.set(roomId, promise);
    }
    return this.roomPromises.get(roomId)!;
  }
}

export const facilityCache = new FacilityCache();
