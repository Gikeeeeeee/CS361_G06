import { useEffect, useRef } from "react";
import { useRoomHighlight } from "../hooks/useRoomHighlight";

interface InteractiveSvgMapProps {
  svgContent: string;
  onRoomClick?: (roomId: string) => void;
  roomNumber?: any;
}

export function InteractiveSvgMap({ svgContent, roomNumber }: InteractiveSvgMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { highlightedRoomId } = useRoomHighlight();

  const getTargetRoomString = (raw: any): string => {
    if (!raw) return "";
    if (typeof raw === "string") return raw;
    if (typeof raw === "object") {
      const extracted = raw.room_number || raw.name || raw.number || raw.title || raw.id;
      if (typeof extracted === "string") return extracted;
      const foundVal = Object.values(raw).find(v => typeof v === "string" && v.trim().length > 0);
      return foundVal ? String(foundVal) : "";
    }
    return String(raw);
  };

  const rawTarget = roomNumber || highlightedRoomId;
  const targetRoom = getTargetRoomString(rawTarget);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svgContent) return;

    const timer = setTimeout(() => {
      // 1. ล้างสีเก่าทั้งหมดก่อน
      const allShapes = container.querySelectorAll("svg g, svg path, svg rect, svg polygon, svg circle");
      allShapes.forEach((el) => {
        (el as HTMLElement).style.removeProperty("fill");
        (el as HTMLElement).style.removeProperty("stroke");
      });

      const allText = container.querySelectorAll("text");
      allText.forEach((t) => {
        t.style.fill = "";
      });

      if (!targetRoom) return;

      const targetLower = targetRoom.toLowerCase().trim();
      const roomPart = targetLower.includes('-') ? targetLower.split('-').pop()?.trim() || targetLower : targetLower;
      const roomPartClean = roomPart.replace(/[^a-z0-9]/g, ''); 

      let matchFound = false;

      const paintShape = (el: Element) => {
        if (["rect", "path", "polygon", "circle"].includes(el.tagName.toLowerCase())) {
          (el as HTMLElement).style.setProperty("fill", "#2563EB", "important");
          (el as HTMLElement).style.setProperty("stroke", "#1D4ED8", "important");
        }
        el.querySelectorAll("rect, path, polygon, circle").forEach(child => {
          (child as HTMLElement).style.setProperty("fill", "#2563EB", "important");
          (child as HTMLElement).style.setProperty("stroke", "#1D4ED8", "important");
        });
      };

      // 2. ไฮไลต์ด้วยระบบสแกนพิกัด + แยกคำอัจฉริยะ (Smart Spatial & Word Matching)
      allText.forEach((t) => {
        const textVal = t.textContent?.toLowerCase().trim() || "";
        const textClean = textVal.replace(/[^a-z0-9]/g, '');
        // แตกคำใน SVG ออกมาเพื่อเช็คแบบแยกคำ (เช่น "Lab Chem 302" แตกเป็น ["lab", "chem", "302"])
        const textWords = textVal.split(/[\s\-_]+/);

        // เช็คว่าตรงกันเป๊ะๆ หรือมีเลขห้องซ่อนอยู่ในประโยค
        if (
          textVal === targetLower || 
          textVal === roomPart || 
          textClean === roomPartClean ||
          textWords.includes(roomPart) || 
          textWords.includes(roomPartClean) ||
          textVal.endsWith(roomPartClean)
        ) {
          t.style.fill = "#ffffff"; 
          matchFound = true;

          const textRect = t.getBoundingClientRect();
          const textCenterX = textRect.left + textRect.width / 2;
          const textCenterY = textRect.top + textRect.height / 2;

          let bestShape: Element | null = null;
          let minArea = Infinity;

          const potentialShapes = container.querySelectorAll("rect, path, polygon");
          potentialShapes.forEach((shape) => {
            const shapeRect = shape.getBoundingClientRect();
            
            if (
              textCenterX >= shapeRect.left &&
              textCenterX <= shapeRect.right &&
              textCenterY >= shapeRect.top &&
              textCenterY <= shapeRect.bottom
            ) {
              const area = shapeRect.width * shapeRect.height;
              if (area < minArea && area > 100) { 
                minArea = area;
                bestShape = shape;
              }
            }
          });

          if (bestShape) {
            paintShape(bestShape);
          }
        }
      });

      // 3. ไฮไลต์จาก ID 
      const elementsWithId = container.querySelectorAll("svg g[id], svg path[id], svg rect[id], svg polygon[id]");
      elementsWithId.forEach((el) => {
        const rawId = el.getAttribute("id") || "";
        const cleanId = rawId.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

        // ป้องกันไม่ให้ ID ไปตรงกับเลขห้องแบบมั่วๆ ถ้าหาจากตัวหนังสือเจอแล้วจะไม่ให้ความสำคัญกับ ID
        if (!matchFound && (cleanId === roomPartClean || cleanId === targetLower.replace(/[^a-z0-9]/g, ''))) {
           paintShape(el);
           matchFound = true;
        }
      });

    }, 100); 

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
    .svg-map-container svg polygon,
    .svg-map-container svg circle {
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