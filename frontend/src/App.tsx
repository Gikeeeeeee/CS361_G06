import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import RootLayout from './pages/RootLayout';
import HomePage from './pages/HomePage';
import SavedPage from './pages/SavedPage';
import ProfilePage from './pages/ProfilePage';
import BuildingInfoPage from './pages/BuildingDetailPage';
import RoomDetailPage from './pages/RoomDetailPage';
import FacilityDetailPage from './pages/FacilityDetailPage';

function DynamicPageTitle() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    if (pathname === '/') {
      document.title = 'KU Long';
    } else if (pathname === '/saved') {
      document.title = 'Saved | KU Long';
    } else if (pathname === '/profile') {
      document.title = 'Profile | KU Long';
    } else if (pathname.startsWith('/buildings/')) {
      document.title = 'Building Details | KU Long';
    } else if (pathname.startsWith('/rooms/')) {
      document.title = 'Room Details | KU Long';
    } else if (pathname.startsWith('/facilities/')) {
      document.title = 'Facility Details | KU Long';
    } else {
      document.title = 'KU Long';
    }
  }, [location]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <DynamicPageTitle />
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="buildings/:buildingId" element={<BuildingInfoPage />} />
        <Route path="rooms/:roomId" element={<RoomDetailPage />} />
        <Route path="facilities/:facilityId" element={<FacilityDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
