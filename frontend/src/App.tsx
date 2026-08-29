import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RootLayout from './app/layout';
import HomePage from './app/page';
import SavedPage from './app/saved/page';
import ProfilePage from './app/profile/page';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
