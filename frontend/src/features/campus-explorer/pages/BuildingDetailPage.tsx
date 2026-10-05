import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBuildingDetails } from '../components/building-info/hooks/useBuildingDetails';
import { BuildingHero } from '../components/building-info/components/BuildingHero';
import { BuildingViewToggle } from '../components/building-info/components/BuildingViewToggle';
import { FloorTabBar } from '../components/building-info/components/FloorTabBar';
import { BuildingRoomList } from '../components/building-info/components/BuildingRoomList';
import { BuildingFloorMapView } from '../components/building-info/components/BuildingFloorMapView';
import { RoomConfirmDestinationModal } from '../components/floor-viewer/components/RoomConfirmDestinationModal';
import { BottomNavbar } from '../components/layout/BottomNavbar';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import type { Room } from '../../../shared/types/domain.types';

export default function BuildingInfoPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedRoomForModal, setSelectedRoomForModal] = useState<
    (Room & { isFacility?: boolean }) | { id: string; room_number: string; name?: any } | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    building,
    selectedFloor,
    isLoading,
    error,
    selectFloor,
  } = useBuildingDetails(buildingId);

  useEffect(() => {
    if (building) {
      document.title = `${building.name.th} | KU Long`;
    }
  }, [building]);

  const handleRoomSelectFromMap = (
    room: Room | { id: string; room_number: string; name?: any }
  ) => {
    setSelectedRoomForModal(room);
    setIsModalOpen(true);
  };

  const handleConfirmNavigation = () => {
    if (!selectedRoomForModal || !building) return;
    setIsModalOpen(false);

    // Look for real room UUID if available
    const matchedRoom = selectedFloor?.rooms?.find(
      (r) =>
        r.id === selectedRoomForModal.id ||
        r.room_number?.toLowerCase() ===
          ('room_number' in selectedRoomForModal
            ? selectedRoomForModal.room_number?.toLowerCase()
            : '')
    );

    const targetRoomId = matchedRoom ? matchedRoom.id : selectedRoomForModal.id;

    // Navigate to room page
    navigate(`/rooms/${building.id}_${targetRoomId}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium text-sm">กำลังโหลดข้อมูลอาคาร...</p>
      </div>
    );
  }

  if (error || !building) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่พบข้อมูลอาคาร</h2>
        <p className="text-slate-500 mb-6 text-sm">
          {error || "The building you're looking for doesn't exist or is currently unavailable."}
        </p>
        <Button onClick={() => navigate('/')}>กลับสู่หน้าหลัก</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative pb-20 max-w-md mx-auto shadow-2xl">
      {/* Hero Header with Building Details */}
      <BuildingHero building={building} />

      {(building.floors?.length || 0) > 0 && selectedFloor && (
        <>
          {/* Segmented Control: List View vs Map View (Matching Figma) */}
          <BuildingViewToggle
            viewMode={viewMode}
            onChange={(mode) => setViewMode(mode)}
          />

          {/* Floor Selection Pills (Defaults to Floor 1) */}
          <div className="bg-slate-50 pt-1">
            <FloorTabBar
              floors={building.floors || []}
              selectedFloorId={selectedFloor.id}
              onSelectFloor={selectFloor}
            />
          </div>

          {/* Conditional View: List View vs Interactive SVG Map View */}
          {viewMode === 'list' ? (
            <BuildingRoomList floor={selectedFloor} />
          ) : (
            <BuildingFloorMapView
              building={building}
              floor={selectedFloor}
              onRoomSelect={handleRoomSelectFromMap}
            />
          )}
        </>
      )}

      {/* Confirmation Modal when room is clicked in Map View */}
      <RoomConfirmDestinationModal
        isOpen={isModalOpen}
        building={building}
        room={selectedRoomForModal}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmNavigation}
      />

      {/* Bottom Navigation Bar */}
      <BottomNavbar />
    </div>
  );
}
