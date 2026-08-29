import { useState, useEffect } from 'react';
import MapView from '../features/homepage/components/MapView';
import SkeletonMap from '../features/homepage/components/SkeletonMap';

export default function HomePage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // จำลองการโหลด 1.5 วินาที
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    // ใช้ h-[calc(100vh-140px)] เพื่อให้แผนที่ขยายเต็มพื้นที่พอดี และ z-0 เพื่อไม่ให้บัง Header ของเพื่อน
    <div className="w-full h-[calc(100vh-140px)] relative z-0">
      {loading ? (
        <SkeletonMap />
      ) : (
        <MapView config={{ lat: 14.0722, lng: 100.6055, zoom: 16 }} />
      )}
    </div>
  );
}