import { useState, useEffect } from 'react';
import MapView from '../features/homepage/components/MapView';
import SkeletonMap from '../features/homepage/components/SkeletonMap';
import SearchBarSection from '../features/homepage/components/SearchBarSection';
import DirectorySheet from '../features/homepage/components/DirectorySheet';
import { MOCK_ROOMS } from '../features/homepage/data/rooms.mock';
import type { RoomCategory, RoomItem } from '../features/homepage/types/directory.types';

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<RoomCategory>('All');
  const [rooms] = useState<RoomItem[]>(MOCK_ROOMS);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      room.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || room.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-120px)] flex flex-col justify-between overflow-hidden">
      {/* 1. Search Bar (วางชั้นบนสุด z-30) */}
      <SearchBarSection
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />

      {/* 2. Map View (อยู่ด้านหลัง z-0) */}
      <div className="absolute inset-0 w-full h-full z-0">
        {loading ? (
          <SkeletonMap />
        ) : (
          <MapView config={{ lat: 14.0722, lng: 100.6055, zoom: 16 }} />
        )}
      </div>

      {/* 3. Directory Sheet (วางซ้อนเหนือแผนที่ z-20) */}
      <DirectorySheet
        rooms={filteredRooms}
        onSelectRoom={(room) => console.log('Selected room:', room)}
      />
    </div>
  );
}