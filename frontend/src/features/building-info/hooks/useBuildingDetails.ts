import { useState, useEffect } from 'react';
import type { Building, Floor } from '../types/buildingInfo.types';
import { buildingService } from '../services/buildingService';

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
          setBuilding(data);
          // Default to the first floor if available
          if (data.floors.length > 0) {
            // Sort by level ascending and pick the first one
            const sortedFloors = [...data.floors].sort((a, b) => a.level - b.level);
            setSelectedFloor(sortedFloors[0]);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch building details');
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
