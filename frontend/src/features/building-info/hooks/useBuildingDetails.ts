import { useState, useEffect } from 'react';
import type { Building, Floor } from '../../../shared/types/domain.types';
import { buildingService } from '../../../services/buildingService';

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
              // Set the first floor as selected by default
              setSelectedFloor(sortedFloors[0] as any);
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

  const selectFloor = (floorId: string) => {
    if (building) {
      const floor = building.floors.find((f) => f.id === floorId);
      if (floor) {
        setSelectedFloor(floor);
      }
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
