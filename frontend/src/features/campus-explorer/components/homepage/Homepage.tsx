import { useEffect, useState } from 'react';
import MapView from './components/MapView';
import { SkeletonMap } from './components/SkeletonMap';
import './styles/homepage.css';

export default function Homepage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // จำลองการโหลด 1.5 วินาที
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mobile-shell">
      {/* Slot สำหรับ Header / Search Bar ของเพื่อน */}
      <header className="header-slot">
        <p>[ Header & Search Bar Slot ]</p>
      </header>

      {/* พื้นที่ Map ของคุณ */}
      <main className="map-slot">
        {loading ? (
          <SkeletonMap />
        ) : (
          <MapView
            config={{
              lat: 13.9889,
              lng: 100.6177,
              zoom: 16,
              label: 'Campus Map',
            }}
          />
        )}
      </main>

      {/* Slot สำหรับ Directory / Bottom Nav ของเพื่อน */}
      <footer className="bottom-nav-slot">
        <p>[ Directory & Bottom Nav Slot ]</p>
      </footer>
    </div>
  );
}