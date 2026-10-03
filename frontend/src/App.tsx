import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import RootLayout from './features/campus-explorer/pages/RootLayout';
import HomePage from './features/campus-explorer/pages/HomePage';
import SavedPage from './features/campus-explorer/pages/SavedPage';
import ProfilePage from './features/campus-explorer/pages/ProfilePage';
import BuildingInfoPage from './features/campus-explorer/pages/BuildingDetailPage';
import RoomDetailPage from './features/campus-explorer/pages/RoomDetailPage';
import FacilityDetailPage from './features/campus-explorer/pages/FacilityDetailPage';
import { AdminPlaceholder } from './features/admin/AdminPlaceholder';
import { AdminLayout } from './features/admin/components/AdminLayout';
import { AdminSchedulePage } from './features/admin-schedule/pages/AdminSchedulePage';
import { ScheduleManagePage } from './features/admin-schedule/pages/ScheduleManagePage';
import { BuildingsPage } from './features/admin-buildings/pages/BuildingsPage';
import { SettingsPage } from './features/admin-settings/pages/SettingsPage';

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
    } else if (pathname.startsWith('/admin')) {
      document.title = 'Admin | KU Long';
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
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminPlaceholder />} />
          <Route path="schedules" element={<ScheduleManagePage />} />
          <Route path="schedules/manage" element={<AdminSchedulePage />} />
          <Route path="buildings" element={<BuildingsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
