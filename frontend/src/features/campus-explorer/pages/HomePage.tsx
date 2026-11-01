import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMapFilter } from '../components/homepage/hooks/useMapFilter';
import { CampusMapContainer } from '../components/homepage/components/CampusMapContainer';
import { SkeletonMap } from '../components/homepage/components/SkeletonMap';
import { SearchContainer } from '../../search/components/SearchContainer';
import { PeekBottomSheet } from '../components/homepage/components/PeekBottomSheet';
import type { PeekBottomSheetRef } from '../components/homepage/components/PeekBottomSheet';
import { useNavigation } from '../../navigation/context/NavigationContext';
import { QrCode } from 'lucide-react';

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const {
    filteredBuildings,
  } = useMapFilter();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const sheetRef = useRef<PeekBottomSheetRef>(null);
  const navigate = useNavigate();
  const { openQrScanner } = useNavigation();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden select-none">
      {/* Top Floating Search & Filter Chips Overlays */}
      <SearchContainer onFocusChange={setIsSearchActive} />

      {/* Floating Circular QR Code Scanner Button below Search Bar */}
      {!isSearchActive && (
        <button
          type="button"
          onClick={openQrScanner}
          className="absolute top-[68px] right-4 z-40 w-11 h-11 rounded-full bg-white/95 hover:bg-white active:scale-95 text-slate-800 hover:text-blue-600 shadow-md hover:shadow-lg border border-slate-200/90 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer group pointer-events-auto"
          title="Scan Checkpoint QR Code to Navigate"
          aria-label="Scan QR Code to navigate"
        >
          <QrCode className="w-5 h-5 stroke-[2.2] group-hover:scale-110 transition-transform" />
        </button>
      )}

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