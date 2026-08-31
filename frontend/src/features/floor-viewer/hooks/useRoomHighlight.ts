import { useSearchParams, useParams } from "react-router-dom";
import { useCallback } from "react";

export function useRoomHighlight() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { roomId } = useParams<{ roomId?: string }>();
  
  // Normalize the highlight room ID. The URL param might include building prefixes like 'lc4-room-lab102'.
  // We want to extract 'room-lab102' or whatever the SVG uses.
  const rawId = searchParams.get("highlight") || roomId;
  
  // Extract just the base room name (e.g., 'lab105' from 'lc4-lab105' or 'lc4-room-lab105')
  // so that id*="lab105" will successfully match 'room-lab105' in the SVG.
  const highlightedRoomId = rawId ? rawId.split('-').pop() : null;

  const setHighlightedRoom = useCallback(
    (roomId: string | null) => {
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev);
          if (roomId) {
            newParams.set("highlight", roomId);
          } else {
            newParams.delete("highlight");
          }
          return newParams;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { highlightedRoomId, setHighlightedRoom };
}
