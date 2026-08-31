import { useEffect } from 'react';
export interface MapLocation {
  lat: number;
  lng: number;
  zoom?: number;
  label?: string;
}
import '../styles/map.css';

declare const L: any;

interface MapViewProps {
  config: MapLocation;
}

export default function MapView({ config }: MapViewProps) {
  useEffect(() => {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const map = L.map('map', {
      zoomControl: false,
      bounceAtZoomLimits: false,
    }).setView([config.lat, config.lng], config.zoom || 16);

    // 🎨 OpenStreetMap แบบดั้งเดิม
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
      className: 'grayscale-map-tiles', // Class กำหนดโทนสีเทา
    }).addTo(map);

    // 📌 Pin Marker สีน้ำเงินเข้มขอบขาว
    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="
        background-color: #1e3a8a;
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 10px;
          height: 10px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    L.marker([config.lat, config.lng], { icon: customIcon }).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
    };
  }, [config.lat, config.lng, config.zoom]);

  return <div id="map" className="map-view w-full h-full touch-pan-x touch-pan-y"></div>;
}