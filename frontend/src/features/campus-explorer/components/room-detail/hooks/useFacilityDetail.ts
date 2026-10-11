import { useState, useEffect } from 'react';
import type { Facility, Floor } from '../../../../../shared/types/domain.types';
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

    const fetchFacility = async () => {
      setLoading(true);
      setError(null);

      try {
        const f = await campusService.getFacilityById(facilityParam);
        
        if (isMounted) {
          if (f) {
            setFacility(f);
            // Floor context is unknown from standard facility endpoint
            setFloor(null);
          } else {
            setError('Facility not found');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error(`Failed to fetch facility ${facilityParam}:`, err);
          setError(err.message || 'Error fetching facility');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFacility();

    return () => {
      isMounted = false;
    };
  }, [facilityParam]);

  return { facility, floor, loading, error };
}
