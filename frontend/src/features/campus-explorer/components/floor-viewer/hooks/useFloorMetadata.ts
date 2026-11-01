import { useState, useEffect, useCallback, useRef } from "react";
import type { FloorMetadata } from "../types/floorViewer.types";
import { campusService } from "../../../services";

export function useFloorMetadata(buildingId: string, floorId: string) {
  const [metadata, setMetadata] = useState<FloorMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const activeFloorIdRef = useRef<string>(floorId);

  useEffect(() => {
    activeFloorIdRef.current = floorId;
  }, [floorId]);

  const fetchFloor = useCallback(async (bId: string, fId: string) => {
    if (!bId || !fId) return;

    setLoading(true);
    setError(null);

    try {
      const data: any = await campusService.getFloorById(fId);
      if (activeFloorIdRef.current === fId) {
        setMetadata(data);
        setError(null);
      }
    } catch (err: any) {
      if (activeFloorIdRef.current === fId) {
        console.error("Metadata Fetch Error:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (activeFloorIdRef.current === fId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!buildingId || !floorId) {
      return;
    }

    fetchFloor(buildingId, floorId);
  }, [buildingId, floorId, fetchFloor]);

  const refetch = useCallback(() => {
    if (buildingId && floorId) {
      fetchFloor(buildingId, floorId);
    }
  }, [buildingId, floorId, fetchFloor]);

  return { metadata, loading, error, refetch };
}
