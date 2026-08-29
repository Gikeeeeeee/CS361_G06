import { renderMapSkeleton } from './components/Skeleton.js';
import { renderMapContainer, initLeafletMap } from './components/MapContainer.js';

const app = document.getElementById('app');

// 1. Render Skeleton Loader ขึ้นมาก่อนทันทีที่เข้าเว็บ
app.innerHTML = renderMapSkeleton();

// 2. จำลองการดึงข้อมูลจาก API (ใช้เวลา 2 วินาที)
setTimeout(() => {
  // 3. เมื่อดึงข้อมูลเสร็จ เปลี่ยน UI จาก Skeleton เป็น Map Container
  app.innerHTML = renderMapContainer();

  // 4. สั่งให้ Leaflet เริ่มทำงานกับ <div id="map">
  initLeafletMap();
}, 2000);