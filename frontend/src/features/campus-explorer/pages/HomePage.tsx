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
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Top Fixed / Sticky Search Bar & QR Code Scanner Overlay */}
      <div className="sticky top-0 left-0 right-0 z-40 w-full pointer-events-none">
        <div className="pt-3 px-4 max-w-md mx-auto relative flex flex-col">
          <SearchContainer onFocusChange={setIsSearchActive} />

          {/* Floating Circular QR Code Scanner Button below Search Bar */}
          {!isSearchActive && (
            <div className="flex justify-end mt-2.5 pr-0 pointer-events-none">
              <button
                type="button"
                onClick={openQrScanner}
                className="w-11 h-11 rounded-full bg-white/95 hover:bg-white active:scale-95 text-slate-800 hover:text-blue-600 shadow-md hover:shadow-lg border border-slate-200/90 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer group pointer-events-auto"
                title="Scan Checkpoint QR Code to Navigate"
                aria-label="Scan QR Code to navigate"
              >
                <QrCode className="w-5 h-5 stroke-[2.2] group-hover:scale-110 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>

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