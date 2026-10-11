import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMapFilter } from '../components/homepage/hooks/useMapFilter';
import { CampusMapContainer } from '../components/homepage/components/CampusMapContainer';
import { SkeletonMap } from '../components/homepage/components/SkeletonMap';
import { SearchContainer } from '../../search/components/SearchContainer';
import { PeekBottomSheet } from '../components/homepage/components/PeekBottomSheet';
import type { PeekBottomSheetRef } from '../components/homepage/components/PeekBottomSheet';

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const {
    filteredBuildings,
  } = useMapFilter();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const sheetRef = useRef<PeekBottomSheetRef>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden select-none">
      {/* Top Floating Search & Filter Chips Overlays */}
      <SearchContainer onFocusChange={setIsSearchActive} />

      {/* Full screen Map Viewport */}
      <div className="absolute inset-0 w-full h-full z-0">
        {loading ? (
          <SkeletonMap />
        ) : (
          <CampusMapContainer buildings={filteredBuildings} />
        )}
      </div>

      {/* Modern Google/Apple Maps Peek Bottom Sheet */}
      {!isSearchActive && (
        <PeekBottomSheet
          ref={sheetRef}
          buildings={filteredBuildings}
          onSelectBuilding={(building) => {
            navigate(`/buildings/${building.id}`);
          }}
        />
      )}
    </div>
  );
}