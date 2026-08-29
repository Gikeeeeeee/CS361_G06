import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// นำเข้าเฉพาะ CSS ของตัวแผนที่
import './features/homepage/styles/map.css';

// เรียกใช้ App ของเพื่อนที่เป็นตัวคุม Routing ทั้งหมด
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);