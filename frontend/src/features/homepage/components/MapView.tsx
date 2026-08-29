import { useEffect } from 'react';
import type { MapLocation } from '../types/map';
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
    }).setView([config.lat, config.lng], config.zoom || 16);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    if (config.label) {
      L.marker([config.lat, config.lng])
        .addTo(map)
        .bindPopup(config.label);
    }

    // 📌 บังคับคำนวณ ขนาดแผนที่ใหม่เมื่อ Render เสร็จ
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
    };
  }, [config]);

  return <div id="map" className="map-view"></div>;
}