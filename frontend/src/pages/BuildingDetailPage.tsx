import { useParams, useNavigate } from 'react-router-dom';
import { useBuildingDetails } from '../features/building-info/hooks/useBuildingDetails';
import { BuildingHero } from '../features/building-info/components/BuildingHero';
import { FloorTabBar } from '../features/building-info/components/FloorTabBar';
import { BuildingRoomList } from '../features/building-info/components/BuildingRoomList';
import { BackButton } from '../shared/components/BackButton';
import { Bookmark, AlertTriangle } from 'lucide-react';
import { Button } from '../shared/components/Button';

export default function BuildingInfoPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  
  const { 
    building, 
    selectedFloor, 
    isLoading, 
    error, 
    selectFloor 
  } = useBuildingDetails(buildingId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Loading building details...</p>
      </div>
    );
  }

  if (error || !building) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Building Not Found</h2>
        <p className="text-slate-500 mb-6">{error || "The building you're looking for doesn't exist or is currently unavailable."}</p>
        <Button onClick={() => navigate('/')}>Return to Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 relative">
      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
        <BackButton />
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md">
          <Bookmark className="w-5 h-5" />
        </Button>
      </div>

      <BuildingHero building={building} />

      {building.floors.length > 0 && selectedFloor && (
        <>
          <div className="sticky top-0 z-30">
            <FloorTabBar 
              floors={building.floors} 
              selectedFloorId={selectedFloor.id} 
              onSelectFloor={selectFloor} 
            />
          </div>
          
          <BuildingRoomList 
            floor={selectedFloor} 
          />
        </>
      )}
    </div>
  );
}
