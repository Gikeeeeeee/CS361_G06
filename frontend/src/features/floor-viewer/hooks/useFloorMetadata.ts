import { useState, useEffect } from "react";
import type { FloorMetadata } from "../types/floorViewer.types";
import { floorService } from "../../../services/floorService";

export function useFloorMetadata(buildingId: string, floorId: string) {
  const [metadata, setMetadata] = useState<FloorMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!buildingId || !floorId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    floorService.getFloorDetails(buildingId, floorId)
      .then((data: any) => {
        if (isMounted) {
          setMetadata(data.data || data);
        }
      })
      .catch((err) => {
        console.error("Metadata Fetch Error:", err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [buildingId, floorId]);

  return { metadata, loading, error };
}
