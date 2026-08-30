import { useState, useEffect } from 'react';
import type { RoomDetail } from '../types/roomDetail.types';
import { roomDetailService } from '../services/roomDetailService';

export function useRoomDetail(roomId: string | undefined) {
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setError('Room ID is required');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    roomDetailService.getRoomById(roomId)
      .then((data) => {
        if (isMounted) {
          if (data) {
            setRoom(data);
          } else {
            setError('Room not found');
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Failed to load room details');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  return { room, loading, error };
}
