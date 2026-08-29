import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMapFilter } from '../features/homepage/hooks/useMapFilter';
import { CampusMapContainer } from '../features/homepage/components/CampusMapContainer';
import { SkeletonMap } from '../features/homepage/components/SkeletonMap';
import { MapSearchOverlay } from '../features/homepage/components/MapSearchOverlay';
import { PeekBottomSheet } from '../features/homepage/components/PeekBottomSheet';
import type { PeekBottomSheetRef } from '../features/homepage/components/PeekBottomSheet';

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    filteredBuildings,
  } = useMapFilter();

  const sheetRef = useRef<PeekBottomSheetRef>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Smoothly expand when search query is typed, shrink back to peek when cleared
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query) {
      sheetRef.current?.snapTo('expanded');
    } else {
      sheetRef.current?.snapTo('peek');
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden select-none">
      {/* Top Floating Search & Filter Chips Overlays */}
      <MapSearchOverlay
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {/* Full screen Map Viewport */}
      <div className="absolute inset-0 w-full h-full z-0">
        {loading ? (
          <SkeletonMap />
        ) : (
          <CampusMapContainer buildings={filteredBuildings} />
        )}
      </div>

      {/* Modern Google/Apple Maps Peek Bottom Sheet */}
      <PeekBottomSheet
        ref={sheetRef}
        buildings={filteredBuildings}
        onSelectBuilding={(building) => {
          navigate(`/buildings/${building.id}`);
        }}
      />
    </div>
  );
}