import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RootLayout from './pages/RootLayout';
import HomePage from './pages/HomePage';
import SavedPage from './pages/SavedPage';
import ProfilePage from './pages/ProfilePage';
import BuildingInfoPage from './pages/BuildingDetailPage';
import RoomDetailPage from './pages/RoomDetailPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="buildings/:buildingId" element={<BuildingInfoPage />} />
        <Route path="rooms/:roomId" element={<RoomDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
