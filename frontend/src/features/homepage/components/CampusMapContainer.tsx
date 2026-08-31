import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BuildingItem } from '../../../shared/types/api.contracts';
import '../styles/map.css';

declare const L: any;

interface CampusMapContainerProps {
  buildings: BuildingItem[];
}

export function CampusMapContainer({ buildings }: CampusMapContainerProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    // Center map around TU Rangsit coordinates
    const map = L.map('map', {
      zoomControl: false,
      bounceAtZoomLimits: false,
    }).setView([14.0722, 100.6055], 16);

    // 🎨 Grayscale Base Tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
      className: 'grayscale-map-tiles',
    }).addTo(map);

    const markerGroup = L.featureGroup().addTo(map);

    buildings.forEach((building) => {
      const displayName = building.name;
      const status = 'OPEN'; // Mocked since API doesn't provide status yet

      // 📌 Modern Bubble Pin (Matching requested design)
      const bubbleIcon = L.divIcon({
        className: 'custom-bubble-pin',
        html: `
          <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 100px;
            height: 55px;
          ">
            <!-- White Bubble -->
            <div style="
              position: absolute;
              top: 0;
              left: 50%;
              transform: translateX(-50%);
              background-color: white;
              padding: 5px 10px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border: 1px solid rgba(0,0,0,0.03);
              z-index: 10;
              min-width: 60px;
              max-width: 150px;
            ">
              <span style="
                color: #0f172a;
                font-weight: 800;
                font-size: 11px;
                line-height: 1.2;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 130px;
                display: block;
              " title="${displayName}">${displayName}</span>
              <span style="
                color: ${status === 'OPEN' ? '#10b981' : '#f43f5e'};
                font-weight: 700;
                font-size: 9px;
                line-height: 1.2;
                margin-top: 1px;
                white-space: nowrap;
              ">${status}</span>
              
              <!-- Triangle pointing down (child of bubble to scale correctly) -->
              <div style="
                position: absolute;
                bottom: -5px;
                left: 50%;
                transform: translateX(-50%);
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid white;
                z-index: 10;
              "></div>
            </div>
            
            <!-- Map Anchor Dot -->
            <div style="
              width: 8px;
              height: 8px;
              background-color: #2563eb;
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              position: absolute;
              bottom: 4px;
              left: 50%;
              transform: translateX(-50%);
              z-index: 5;
            "></div>
          </div>
        `,
        iconSize: [120, 55],
        iconAnchor: [60, 51],
      });

      const marker = L.marker([building.latitude, building.longitude], { icon: bubbleIcon });
      
      // Navigate to building details on click
      marker.on('click', () => {
        navigate(`/buildings/${building.id}`);
      });

      marker.addTo(markerGroup);
    });

    // Autofit map to show all matching pins if available
    if (buildings.length > 0) {
      const bounds = markerGroup.getBounds();
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
    };
  }, [buildings, navigate]);

  return <div id="map" className="map-view w-full h-full touch-pan-x touch-pan-y"></div>;
}
