import { useState, useEffect } from 'react';
import type { Building, Floor } from '../../../shared/types/domain.types';
import { buildingService } from '../../../services/buildingService';
import { floorService } from '../../../services/floorService';

interface UseBuildingDetailsReturn {
  building: Building | null;
  selectedFloor: Floor | null;
  isLoading: boolean;
  error: string | null;
  selectFloor: (floorId: string) => void;
}

export function useBuildingDetails(buildingId: string | undefined): UseBuildingDetailsReturn {
  const [building, setBuilding] = useState<Building | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchBuilding() {
      if (!buildingId) {
        setError('No building ID provided');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await buildingService.getBuildingById(buildingId);
        if (isMounted) {
          if (data) {
            setBuilding(data as any); // Type assertion until domain types match perfectly
            if (data.floors && data.floors.length > 0) {
              const sortedFloors = [...data.floors].sort((a, b) => a.floor_number - b.floor_number);
              const defaultFloor = sortedFloors[0];
              
              // Fetch detailed floor info for the default floor
              try {
                const floorDetails = await floorService.getFloorDetails(buildingId, defaultFloor.id);
                if (isMounted) {
                  setSelectedFloor(floorDetails as any);
                }
              } catch (floorErr) {
                console.error("Failed to load default floor details:", floorErr);
                if (isMounted) {
                  setSelectedFloor({
                    ...defaultFloor,
                    rooms: [],
                    facilities: []
                  } as any);
                }
              }
            }
          } else {
            setError(`Building with id ${buildingId} not found`);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
          setBuilding(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchBuilding();

    return () => {
      isMounted = false;
    };
  }, [buildingId]);

  const selectFloor = async (floorId: string) => {
    if (!buildingId) return;
    try {
      const floorDetails = await floorService.getFloorDetails(buildingId, floorId);
      setSelectedFloor(floorDetails as any);
    } catch (err) {
      console.error("Failed to load selected floor details:", err);
    }
  };

  return {
    building,
    selectedFloor,
    isLoading,
    error,
    selectFloor,
  };
}
