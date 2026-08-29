import { useState, useEffect } from 'react';
import MapView from '../features/homepage/components/MapView';
import SkeletonMap from '../features/homepage/components/SkeletonMap';
import SearchBarSection from '../features/homepage/components/SearchBarSection';
import DirectorySheet from '../features/homepage/components/DirectorySheet';
import type { BuildingItem } from '../features/homepage/components/DirectorySheet';

const MOCK_BUILDINGS: BuildingItem[] = [
  { id: 'b1', code: 'LC.4', name: 'Lecture Center 4', openHours: '08:00 - 16:00 น.' },
  { id: 'b2', code: 'LC.3', name: 'Lecture Center 3', openHours: '08:00 - 16:00 น.' },
  { id: 'b3', code: 'SC', name: 'Science Center', openHours: '08:00 - 16:00 น.' },
];

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [buildings] = useState<BuildingItem[]>(MOCK_BUILDINGS);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const filteredBuildings = buildings.filter(
    (b) =>
      b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden select-none">
      <SearchBarSection
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory="All"
        setSelectedCategory={() => {}}
      />

      <div className="absolute inset-0 w-full h-full z-0">
        {loading ? (
          <SkeletonMap />
        ) : (
          <MapView config={{ lat: 14.0722, lng: 100.6055, zoom: 16 }} />
        )}
      </div>

      <DirectorySheet
        buildings={filteredBuildings}
        onSelectBuilding={(building) => {
          console.log('Selected Building:', building);
        }}
      />
    </div>
  );
}