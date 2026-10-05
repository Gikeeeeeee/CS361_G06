import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'react-datepicker/dist/react-datepicker.css';
import './react-datepicker-custom.css';

// นำเข้าเฉพาะ CSS ของตัวแผนที่
import './features/campus-explorer/components/homepage/styles/map.css';

// เรียกใช้ App ของเพื่อนที่เป็นตัวคุม Routing ทั้งหมด
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);