import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// 📌 เพิ่ม 2 บรรทัดนี้เพื่อดึงไฟล์ CSS เข้ามาใช้งาน
import './features/homepage/styles/homepage.css'
import './features/homepage/styles/map.css'

import Homepage from './features/homepage/Homepage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Homepage />
  </StrictMode>,
)