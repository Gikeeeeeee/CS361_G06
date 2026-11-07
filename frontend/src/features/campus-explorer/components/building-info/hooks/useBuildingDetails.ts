import { useState, useEffect, useRef } from 'react';
import type { Building, Floor } from '../../../../../shared/types/domain.types';
import { campusService } from '../../../services';

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
  const selectionRef = useRef(0);
  const floorCacheRef = useRef<Map<string, Floor>>(new Map());

  useEffect(() => {
    let isMounted = true;
    const initialSelection = ++selectionRef.current;
    setBuilding(null);
    setSelectedFloor(null);
    floorCacheRef.current.clear();

    async function fetchBuilding() {
      if (!buildingId) {
        setError('No building ID provided');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await campusService.getBuildingById(buildingId);
        if (isMounted) {
          if (data) {
            setBuilding(data as any);
            if (data.floors && data.floors.length > 0) {
              const sortedFloors = [...data.floors].sort((a, b) => a.floor_number - b.floor_number);
              const defaultFloor = sortedFloors[0];
              
              // Fetch detailed floor info for the default floor
              try {
                const floorDetails = await campusService.getFloorById(defaultFloor.id);
                if (isMounted && selectionRef.current === initialSelection) {
                  const resolved = (floorDetails || defaultFloor) as any;
                  floorCacheRef.current.set(defaultFloor.id, resolved);
                  setSelectedFloor(resolved);
                }
              } catch (floorErr) {
                console.error("Failed to load default floor details:", floorErr);
                if (isMounted && selectionRef.current === initialSelection) {
                  const fallback = {
                    ...defaultFloor,
                    rooms: [],
                    facilities: []
                  } as any;
                  floorCacheRef.current.set(defaultFloor.id, fallback);
                  setSelectedFloor(fallback);
                }
              }

              // Background prefetch remaining floors for 0ms floor switching latency
              sortedFloors.slice(1).forEach((otherFloor) => {
                campusService.getFloorById(otherFloor.id).then((details) => {
                  if (isMounted && details) {
                    floorCacheRef.current.set(otherFloor.id, details as any);
                  }
                }).catch(() => {});
              });
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
      ++selectionRef.current;
    };
  }, [buildingId]);

  const selectFloor = async (floorId: string) => {
    if (!buildingId) return;

    const selection = ++selectionRef.current;
    setError(null);
    // Clear the old map immediately while the selected floor details load.
    const summary = building?.floors?.find((floor) => floor.id === floorId);
    setSelectedFloor(summary || null);
    // Fast path: use cached floor detail if available
    const cached = floorCacheRef.current.get(floorId);
    if (cached) {
      setSelectedFloor(cached);
      return;
    }

    try {
      const floorDetails = await campusService.getFloorById(floorId);
      if (selection !== selectionRef.current) return;
      if (floorDetails) {
        floorCacheRef.current.set(floorId, floorDetails as any);
        setSelectedFloor(floorDetails as any);
      } else {
        setError("Failed to load selected floor details. Select the floor to retry.");
      }
    } catch (err) {
      if (selection === selectionRef.current) setError("Failed to load selected floor details. Select the floor to retry.");
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
