import { useState, useEffect } from 'react';
import { scheduleApi } from '../services/scheduleApi';
import type { Building, Floor, Room } from '../services/scheduleApi';

export const useFacilitySelector = () => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch buildings on mount
  useEffect(() => {
    const fetchBuildings = async () => {
      setLoadingBuildings(true);
      setError(null);
      try {
        const { buildings } = await scheduleApi.getBuildings();
        setBuildings(buildings);
        if (buildings.length > 0) {
          setSelectedBuildingId(buildings[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch buildings');
      } finally {
        setLoadingBuildings(false);
      }
    };
    fetchBuildings();
  }, []);

  // Fetch floors when selectedBuildingId changes
  useEffect(() => {
    if (!selectedBuildingId) {
      setFloors([]);
      setSelectedFloorId('');
      return;
    }

    const fetchFloors = async () => {
      setLoadingFloors(true);
      setError(null);
      try {
        const { floors } = await scheduleApi.getBuildingFloors(selectedBuildingId);
        setFloors(floors);
        if (floors.length > 0) {
          setSelectedFloorId(floors[0].id);
        } else {
          setSelectedFloorId('');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch floors');
        setFloors([]);
        setSelectedFloorId('');
      } finally {
        setLoadingFloors(false);
      }
    };

    fetchFloors();
  }, [selectedBuildingId]);

  // Fetch rooms when selectedFloorId changes
  useEffect(() => {
    if (!selectedFloorId) {
      setRooms([]);
      setSelectedRoomId('');
      return;
    }

    const fetchRooms = async () => {
      setLoadingRooms(true);
      setError(null);
      try {
        const { rooms } = await scheduleApi.getFloorRooms(selectedFloorId);
        setRooms(rooms);
        if (rooms.length > 0) {
          setSelectedRoomId(rooms[0].id);
        } else {
          setSelectedRoomId('');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch rooms');
        setRooms([]);
        setSelectedRoomId('');
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
  }, [selectedFloorId]);

  return {
    buildings,
    floors,
    rooms,
    selectedBuildingId,
    selectedFloorId,
    selectedRoomId,
    setSelectedBuildingId,
    setSelectedFloorId,
    setSelectedRoomId,
    loadingBuildings,
    loadingFloors,
    loadingRooms,
    error,
  };
};
