import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RootLayout from './app/layout';
import HomePage from './app/page';
import SavedPage from './app/saved/page';
import ProfilePage from './app/profile/page';
import BuildingInfoPage from './app/buildings/[buildingId]/page';

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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
