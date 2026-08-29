// ฟังก์ชันส่งออก HTML ของส่วนแผนที่
export function renderMapContainer() {
  return `
    <div class="card">
      <h2 class="map-title">ตำแหน่งที่ตั้ง: กรุงเทพมหานคร</h2>
      <div id="map"></div>
    </div>
  `;
}

// ฟังก์ชันสั่งงาน Leaflet หลังจากที่ Element #map ถูกวาดลงหน้าจอแล้ว
export function initLeafletMap() {
  const lat = 13.7563;
  const lng = 100.5018;

  // สร้างแผนที่ Leaflet
  const map = L.map('map').setView([lat, lng], 13);

  // ดึง Tile จาก OpenStreetMap
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // ปักหมุด
  L.marker([lat, lng])
    .addTo(map)
    .bindPopup('<b>กรุงเทพมหานคร</b>')
    .openPopup();
}