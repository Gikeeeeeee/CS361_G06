import { useState, useEffect } from 'react';
import type { Facility, Floor } from '../../../shared/types/domain.types';
import { campusService } from '../../../services';

export function useFacilityDetail(facilityParam: string | undefined) {
  const [facility, setFacility] = useState<Facility | null>(null);
  const [floor, setFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityParam) {
      setError('Facility ID is required');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchFacility = async () => {
      const parts = facilityParam.split('_');
      if (parts.length < 2) {
        if (isMounted) { setError('Invalid facility identifier format'); setLoading(false); }
        return;
      }

      const bid = parts[0];
      const targetFacilityId = parts.slice(1).join('_');

      try {
        const building = await campusService.getBuildingById(bid);
        if (!building) {
          if (isMounted) { setError('Building not found'); setLoading(false); }
          return;
        }

        const floors = await campusService.getFloorsByBuildingId(bid);

        for (const flr of floors) {
          if (!isMounted) return;
          try {
            const facilities = await campusService.getFacilitiesByFloorId(flr.id);
            const f = facilities.find(fac => fac.id === targetFacilityId);

            if (f && isMounted) {
              setFacility(f);
              setFloor(flr);
              setLoading(false);
              return;
            }
          } catch {
            continue;
          }
        }

        if (isMounted) { setError('Facility not found'); setLoading(false); }
      } catch (err: any) {
        if (isMounted) { setError(err.message || 'Error fetching facility'); setLoading(false); }
      }
    };

    fetchFacility();

    return () => {
      isMounted = false;
    };
  }, [facilityParam]);

  return { facility, floor, loading, error };
}
