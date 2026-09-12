import { useEffect, useRef } from "react";
import { useRoomHighlight } from "../hooks/useRoomHighlight";

interface InteractiveSvgMapProps {
  svgContent: string;
  onRoomClick?: (roomId: string) => void;
  roomNumber?: string;
}

export function InteractiveSvgMap({ svgContent, roomNumber }: InteractiveSvgMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { highlightedRoomId } = useRoomHighlight();

  const targetRoom = roomNumber || highlightedRoomId;

  // รันการไฮไลต์ทุกครั้งที่ svgContent โหลดเสร็จ หรือเมื่อ roomNumber เปลี่ยนแปลง
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svgContent) return;

    // หน่วงเวลาเล็กน้อย (10 มิลลิวินาที) เพื่อรอให้ DOM ของ SVG โหลดลงหน้าจอสมบูรณ์แบบ
    const timer = setTimeout(() => {
      // 1. ล้างสีเก่าทั้งหมดก่อน
      const elements = container.querySelectorAll("svg g[id], svg path[id], svg rect[id], svg polygon[id]");
      elements.forEach((el) => {
        (el as HTMLElement).style.removeProperty("fill");
        (el as HTMLElement).style.removeProperty("stroke");
      });

      const allText = container.querySelectorAll("text");
      allText.forEach((t) => {
        t.style.fill = "";
      });

      if (!targetRoom) return;

      const cleanTarget = targetRoom.toLowerCase().trim();

      // 2. ไฮไลต์ตัวหนังสือเฉพาะห้องที่ตรงกันเป๊ะๆ
      allText.forEach((t) => {
        const textVal = t.textContent?.toLowerCase().trim() || "";
        if (textVal === cleanTarget) {
          t.style.fill = "#ffffff";
        }
      });

      // 3. ไฮไลต์ Shape แบบแม่นยำ (ไม่ให้ 101 ไปโดน 101/1)
      elements.forEach((el) => {
        const rawId = el.getAttribute("id") || "";
        const cleanId = rawId.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const targetClean = cleanTarget.replace(/[^a-z0-9]/g, '');

        const regex = new RegExp(`^(room|rm)?(${targetClean})$`, 'i');

        if (regex.test(cleanId) || rawId.toLowerCase().trim() === cleanTarget) {
          (el as HTMLElement).style.setProperty("fill", "#2563EB", "important");
          (el as HTMLElement).style.setProperty("stroke", "#1D4ED8", "important");
        }
      });
    }, 10);

    return () => clearTimeout(timer);
  }, [targetRoom, svgContent]);

  const dynamicStyles = `
    .svg-map-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
    
    .svg-map-container svg {
      width: 100%;
      height: auto;
      max-height: 100%;
      display: block;
    }
    
    .svg-map-container svg path,
    .svg-map-container svg rect,
    .svg-map-container svg polygon {
      transition: fill 0.2s ease, stroke 0.2s ease;
      cursor: default;
    }
    
    .svg-map-container svg g[id] > *,
    .svg-map-container svg path[id],
    .svg-map-container svg rect[id],
    .svg-map-container svg polygon[id] {
      fill: #F1F5F9; 
      stroke: #CBD5E1; 
      stroke-width: 1px;
      vector-effect: non-scaling-stroke;
    }

    .svg-map-container svg g[id]:hover > *,
    .svg-map-container svg path[id]:hover,
    .svg-map-container svg rect[id]:hover,
    .svg-map-container svg polygon[id]:hover {
      fill: #DBEAFE; 
    }
  `;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <style>{dynamicStyles}</style>
      <div
        ref={containerRef}
        className="svg-map-container w-full h-full"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}