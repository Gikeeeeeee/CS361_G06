import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Building2, 
  Layers, 
  Search, 
  Edit3, 
  RefreshCw, 
  Loader2,
  AlertTriangle,
  Check
} from 'lucide-react';
import { facilityCache } from '../../admin-schedule/services/facilityCache';
import type { Building, Floor } from '../../admin-schedule/services/scheduleApi';
import { useSvgFloorPlan } from '../../campus-explorer/components/floor-viewer/hooks/useSvgFloorPlan';
import { InteractiveSvgMap } from '../../campus-explorer/components/floor-viewer/components/InteractiveSvgMap';
import { statusApi } from '../../admin-status/services/statusApi';
import type { FloorStatusOverlayData, RoomStatus, RoomStatusItem } from '../../admin-status/types/status.types';
import { StatusEditDrawer } from '../../admin-status/components/StatusEditDrawer';
import { getCorridorSegments } from '../../admin-status/components/corridorOverlay';
import { useAuth } from '../../auth/context/AuthContext';
import { campusService } from '../../campus-explorer/services';
import { 
  resolveRoomEntity, 
  getRoomLookupKeys, 
  formatRoomDisplay 
} from '../../campus-explorer/services/roomResolver';

export const BuildingsPage: React.FC = () => {
  const { role, isAuthenticated } = useAuth();
  const canManage = isAuthenticated && (role === 'STAFF' || role === 'ADMIN');
  const overlayRequest = useRef(0);
  const saving = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [selectedCorridorId, setSelectedCorridorId] = useState<string | null>(null);
  // 1. Dynamic Facility Selectors State (Zero Hardcoding)
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [floorDetail, setFloorDetail] = useState<any>(null);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState<boolean>(true);
  const [isLoadingFloors, setIsLoadingFloors] = useState<boolean>(false);
  const [isLoadingFloorDetail, setIsLoadingFloorDetail] = useState<boolean>(false);

  // 2. Status Overlay & Room Data State
  const [statusOverlayData, setStatusOverlayData] = useState<FloorStatusOverlayData | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [highlightedRoomId, setHighlightedRoomId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'CLOSED'>('ALL');

  // 3. Edit Drawer State
  const [editingTarget, setEditingTarget] = useState<{
    type: 'ROOM' | 'CORRIDOR' | 'NODE';
    id: string;
    code: string;
    name?: string;
    floorId: string;
    buildingCode?: string;
    currentStatus: any;
    currentNote?: string | null;
  } | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initial load: Fetch buildings dynamically
  useEffect(() => {
    let isMounted = true;
    setIsLoadingBuildings(true);

    facilityCache
      .getBuildings()
      .then((res) => {
        if (!isMounted) return;
        const bList = res.buildings || [];
        setBuildings(bList);
        if (bList.length > 0) {
          setSelectedBuildingId(bList[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load buildings:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingBuildings(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // When building changes: Fetch floors dynamically
  useEffect(() => {
    if (!selectedBuildingId) return;

    let isMounted = true;
    setIsLoadingFloors(true);

    facilityCache
      .getBuildingFloors(selectedBuildingId)
      .then((res) => {
        if (!isMounted) return;
        const fList = res.floors || [];
        setFloors(fList);
        if (fList.length > 0) {
          setSelectedFloorId(fList[0].id);
        } else {
          setSelectedFloorId('');
        }
      })
      .catch((err) => {
        console.error('Failed to load floors:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingFloors(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedBuildingId]);

  // Selected building and floor objects
  const currentBuilding = useMemo(() => {
    return buildings.find((b) => b.id === selectedBuildingId);
  }, [buildings, selectedBuildingId]);

  const currentFloor = useMemo(() => {
    return floors.find((f) => f.id === selectedFloorId);
  }, [floors, selectedFloorId]);

  // Fetch full floor details (including SVG floor plan URL and room metadata)
  useEffect(() => {
    if (!selectedFloorId) {
      setFloorDetail(null);
      return;
    }

    let isMounted = true;
    setIsLoadingFloorDetail(true);

    campusService
      .getFloorById(selectedFloorId)
      .then((detail) => {
        if (!isMounted) return;
        setFloorDetail(detail);

        // Populate facilityCache.roomMeta with fresh room numbers and names
        if (detail && Array.isArray((detail as any).rooms) && currentBuilding) {
          const bCode = currentBuilding.code || '';
          (detail as any).rooms.forEach((r: any) => {
            facilityCache.roomMeta.set(r.id, {
              roomId: r.id,
              roomNumber: r.room_number || '',
              nameEn: r.name?.en || '',
              buildingId: currentBuilding.id,
              buildingCode: bCode,
              floorId: selectedFloorId,
            });
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load floor detail:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingFloorDetail(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedFloorId, currentBuilding]);

  // Determine SVG URL dynamically from database/backend
  const svgUrl = useMemo(() => {
    if (floorDetail) {
      const url = floorDetail.floor_plan?.url || floorDetail.map?.url;
      if (url) return url;
    }
    if (currentFloor) {
      const floorAny = currentFloor as any;
      return floorAny.floor_plan?.url || floorAny.map?.url || undefined;
    }
    return undefined;
  }, [floorDetail, currentFloor]);

  const { svgContent, loading: isSvgLoading } = useSvgFloorPlan(svgUrl);

  // Fetch status overlay for selected floor
  const fetchStatusOverlay = useCallback(async () => {
    const request = ++overlayRequest.current;
    if (!selectedFloorId) {
      setStatusOverlayData(null);
      return;
    }
    setIsLoadingStatus(true);
    setStatusError(null);
    try {
      const data = await statusApi.getFloorStatusOverlay(selectedFloorId, true);
      if (request === overlayRequest.current) setStatusOverlayData(data);
    } catch (err) {
      if (request === overlayRequest.current) {
        setStatusError(err instanceof Error ? err.message : 'Failed to load status overlay.');
      }
    } finally {
      if (request === overlayRequest.current) setIsLoadingStatus(false);
    }
  }, [selectedFloorId]);

  useEffect(() => {
    fetchStatusOverlay();
    return () => { ++overlayRequest.current; };
  }, [fetchStatusOverlay]);

  const corridors = useMemo(() => getCorridorSegments(statusOverlayData?.floor_id === selectedFloorId ? statusOverlayData : null), [statusOverlayData, selectedFloorId]);

  const resetFloor = (floorId: string) => {
    ++overlayRequest.current;
    setSelectedFloorId(floorId);
    setFloorDetail(null);
    setStatusOverlayData(null);
    setSelectedCorridorId(null);
    setHighlightedRoomId(null);
    setIsDrawerOpen(false);
    setEditingTarget(null);
  };

  const handleCorridorClick = (edgeId: string) => {
    if (!canManage || isLoadingStatus || isSaving || statusError) return;
    const edge = corridors.find(item => item.edge_id === edgeId);
    if (!edge) return;
    setSelectedCorridorId(edgeId);
    setHighlightedRoomId(null);
    setEditingTarget({ type: 'CORRIDOR', id: edge.edge_id, code: edge.edge_id,
      name: `${edge.from_node_id} → ${edge.to_node_id}`,
      floorId: selectedFloorId, buildingCode: currentBuilding?.code,
      currentStatus: edge.status, currentNote: edge.status_note });
    setIsDrawerOpen(true);
  };

  // Format status overlay for InteractiveSvgMap prop
  const statusOverlayMap = useMemo(() => {
    const map: Record<string, { status: string; note?: string | null }> = {};
    if (!statusOverlayData) return map;

    // Room status entries using centralized room lookup keys
    statusOverlayData.rooms.forEach((r) => {
      const entry = { status: r.status, note: r.status_note };
      getRoomLookupKeys(r).forEach((k) => {
        map[k] = entry;
      });

      const meta = facilityCache.roomMeta.get(r.room_id);
      if (meta) {
        getRoomLookupKeys(meta).forEach((k) => {
          map[k] = entry;
        });
      }
    });

    const fRooms = floorDetail?.rooms || (currentFloor as any)?.rooms || [];
    fRooms.forEach((fr: any) => {
      const statusItem = statusOverlayData.rooms.find((r) => r.room_id === fr.id);
      if (statusItem) {
        const entry = { status: statusItem.status, note: statusItem.status_note };
        getRoomLookupKeys(fr).forEach((k) => {
          map[k] = entry;
        });
      }
    });

    // Corridor edges
    statusOverlayData.corridor_edges.forEach((e) => {
      map[e.edge_id] = { status: e.status, note: e.status_note };
    });

    // Navigation nodes
    statusOverlayData.navigation_nodes.forEach((n) => {
      map[n.node_id] = { status: n.status, note: n.status_note };
    });

    return map;
  }, [statusOverlayData, floorDetail, currentFloor]);

  // Status statistics counters
  const stats = useMemo(() => {
    const rooms = statusOverlayData?.rooms || [];
    let active = 0;
    let maintenance = 0;
    let closed = 0;

    rooms.forEach((r) => {
      if (r.status === 'MAINTENANCE') maintenance++;
      else if (r.status === 'CLOSED') closed++;
      else active++;
    });

    return { total: rooms.length, active, maintenance, closed };
  }, [statusOverlayData]);

  // Helper to format clean, human-understandable Room Code and Room Name for Admin Staff
  const getRoomDisplayInfo = useCallback(
    (r: RoomStatusItem) => {
      const bCode = currentBuilding?.code || '';
      const fRoom = floorDetail?.rooms?.find((fr: any) => fr.id === r.room_id);
      const candidate = fRoom || r;
      return formatRoomDisplay(candidate, bCode);
    },
    [currentBuilding, floorDetail]
  );

  // Handle clicking a room on SVG via Centralized Room Resolver
  const handleRoomClick = (roomId: string, rawElementId: string) => {
    if (!canManage || isLoadingStatus || isSaving) return;
    setHighlightedRoomId(roomId);

    const bCode = currentBuilding?.code || '';
    const fRooms = floorDetail?.rooms || (currentFloor as any)?.rooms || [];

    // Centralized Room Resolution (handles slashes, dashes, names, UUIDs)
    const existing = resolveRoomEntity(roomId, statusOverlayData?.rooms) || resolveRoomEntity(rawElementId, statusOverlayData?.rooms);
    const match = resolveRoomEntity(roomId, fRooms) || resolveRoomEntity(rawElementId, fRooms);

    // Prefer actual database UUID
    const targetId = existing?.room_id || match?.id || (rawElementId ? `RM_${rawElementId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}` : `RM_${roomId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`);

    const candidate = match || existing || { room_code: roomId, buildingCode: bCode };
    const { displayCode, displayName } = formatRoomDisplay(candidate, bCode);

    setEditingTarget({
      type: 'ROOM',
      id: targetId,
      code: displayCode,
      name: displayName,
      floorId: selectedFloorId,
      buildingCode: bCode,
      currentStatus: existing?.status || 'ACTIVE',
      currentNote: existing?.status_note || null,
    });
    setIsDrawerOpen(true);
  };


  // Handle saving status from Drawer
  const handleSaveStatus = async (
    type: 'ROOM' | 'CORRIDOR' | 'NODE',
    id: string,
    code: string,
    newStatus: string,
    note: string | null
  ) => {
    if (!canManage) throw new Error('Staff or Admin permission required.');
    if (saving.current) return;
    if (!editingTarget || editingTarget.floorId !== selectedFloorId) throw new Error('Reload and select the corridor again.');
    if (type === 'CORRIDOR' && editingTarget.currentStatus === newStatus) return;
    saving.current = true;
    setIsSaving(true);
    try {
      if (type === 'ROOM') {
        await statusApi.updateRoomStatus(
          selectedFloorId,
          id,
          code,
          newStatus as RoomStatus,
          note
        );
      } else if (type === 'CORRIDOR') {
        const updated = await statusApi.updateCorridorStatus(selectedFloorId, id, newStatus as 'ACTIVE' | 'BLOCKED', note);
        setStatusOverlayData(previous => previous && previous.floor_id === selectedFloorId ? {
          ...previous,
          corridor_edges: previous.corridor_edges.map(edge => edge.edge_id === id ? { ...edge, ...updated } : edge),
        } : previous);
      } else {
        await statusApi.updateNodeStatus(selectedFloorId, id, newStatus as any, note);
      }

      // Refresh overlay data
      await fetchStatusOverlay();

      // Show toast
      setToast({ type: 'success', message: `Updated ${code} status to ${newStatus}` });
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      const msg = err?.message || 'Failed to update status. Please try again.';
      setToast({ type: 'error', message: msg });
      setTimeout(() => setToast(null), 4500);
      throw err;
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  // Filtered rooms list for table
  const filteredRooms = useMemo(() => {
    const list = statusOverlayData?.rooms || [];
    return list.filter((r) => {
      const { displayCode, displayName } = getRoomDisplayInfo(r);
      const query = searchFilter.trim().toLowerCase();
      const matchSearch =
        !query ||
        displayCode.toLowerCase().includes(query) ||
        displayName.toLowerCase().includes(query) ||
        r.room_code.toLowerCase().includes(query) ||
        (r.status_note && r.status_note.toLowerCase().includes(query));

      const matchStatus =
        statusFilter === 'ALL' || r.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [statusOverlayData, searchFilter, statusFilter, getRoomDisplayInfo]);

  if (!canManage) return <div className="p-6" role="alert">Staff or Admin access required.</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 text-white text-xs font-semibold rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-900'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-white shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Facility & Floor Status Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage real-time availability, maintenance schedules, and corridor closures.
          </p>
        </div>

        {/* Dynamic Facility Dropdowns */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Building Selector */}
          <div className="relative min-w-[160px]">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={selectedBuildingId}
              onChange={(e) => { resetFloor(''); setFloors([]); setSelectedBuildingId(e.target.value); }}
              disabled={isLoadingBuildings || isSaving}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition appearance-none cursor-pointer"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code || b.name?.en || b.id} - {b.name?.th || b.name?.en || ''}
                </option>
              ))}
            </select>
          </div>

          {/* Floor Selector */}
          <div className="relative min-w-[130px]">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={selectedFloorId}
              onChange={(e) => resetFloor(e.target.value)}
              disabled={isLoadingFloors || floors.length === 0 || isSaving}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition appearance-none cursor-pointer"
            >
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  Floor {f.floor_number ?? f.id}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchStatusOverlay}
            disabled={isLoadingStatus || isSaving || !selectedFloorId}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition active:scale-95 shadow-xs"
            title="Reload Floor Status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Counters Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Rooms</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Active / Open</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Maintenance</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{stats.maintenance}</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Closed</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.closed}</div>
        </div>
      </div>

      {/* Main Interactive Map Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Map Header / Legend */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="font-semibold text-slate-700 flex items-center gap-2">
            <span>Interactive Floor Overlay:</span>
            <span className="font-normal text-slate-500">
              Select a room or corridor to change its status
            </span>
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600" />
              <span className="text-slate-600 font-medium">Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500" />
              <span className="text-slate-600 font-medium">Maintenance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 border border-red-600" />
              <span className="text-slate-600 font-medium">Closed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-300" />
              <span className="text-slate-600 font-medium">Selected</span>
            </div>
          </div>
        </div>

        {/* Map View Canvas */}
        <div className="relative w-full h-[460px] sm:h-[520px] bg-slate-100 flex items-center justify-center">
          {isSvgLoading || isLoadingFloors || isLoadingFloorDetail ? (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Loading floor plan SVG...</span>
            </div>
          ) : svgContent ? (
            <InteractiveSvgMap
              svgContent={svgContent}
              highlightedRoomId={highlightedRoomId}
              statusOverlay={statusOverlayMap}
              onRoomClick={handleRoomClick}
              corridors={corridors}
              selectedCorridorId={selectedCorridorId}
              onCorridorClick={handleCorridorClick}
              enableZoomPan={true}
              showControls={true}
            />
          ) : (
            <div className="text-xs text-slate-400 text-center px-4">
              No SVG floor plan found for this floor.
            </div>
          )}
        </div>
      </div>

      {statusError && <p role="alert" className="text-sm text-red-700">{statusError}</p>}

      {/* Room Status Directory & Quick Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter rooms on this floor..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>

          {/* Segmented Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            {(['ALL', 'ACTIVE', 'MAINTENANCE', 'CLOSED'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setStatusFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === mode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'ALL' ? 'All' : mode === 'MAINTENANCE' ? 'Maintenance' : mode === 'CLOSED' ? 'Closed' : 'Active'}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Room Code</th>
                <th className="px-5 py-3">Room Name</th>
                <th className="px-5 py-3">Current Status</th>
                <th className="px-5 py-3">Reason / Status Note</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No room matching the current filter.
                  </td>
                </tr>
              ) : (
                filteredRooms.map((r) => {
                  const { displayCode, displayName } = getRoomDisplayInfo(r);
                  const isMaint = r.status === 'MAINTENANCE';
                  const isClosed = r.status === 'CLOSED';

                  return (
                    <tr
                      key={r.room_id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => {
                        setHighlightedRoomId(displayCode);
                        setEditingTarget({
                          type: 'ROOM',
                          id: r.room_id,
                          code: displayCode,
                          name: displayName || `Room ${displayCode}`,
                          floorId: selectedFloorId,
                          buildingCode: currentBuilding?.code,
                          currentStatus: r.status,
                          currentNote: r.status_note,
                        });
                        setIsDrawerOpen(true);
                      }}
                    >
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-xs font-bold text-blue-800">
                          {displayCode}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800 max-w-xs truncate">
                        {displayName || <span className="text-slate-400 italic">-</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            isMaint
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : isClosed
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isMaint ? 'bg-amber-500' : isClosed ? 'bg-red-500' : 'bg-emerald-500'
                            }`}
                          />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                        {r.status_note || (
                          <span className="text-slate-400 italic">No notes</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHighlightedRoomId(displayCode);
                            setEditingTarget({
                              type: 'ROOM',
                              id: r.room_id,
                              code: displayCode,
                              name: displayName || `Room ${displayCode}`,
                              floorId: selectedFloorId,
                              buildingCode: currentBuilding?.code,
                              currentStatus: r.status,
                              currentNote: r.status_note,
                            });
                            setIsDrawerOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 transition active:scale-95"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Drawer Modal */}
      <StatusEditDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setHighlightedRoomId(null);
          setSelectedCorridorId(null);
        }}
        target={editingTarget}
        onSave={handleSaveStatus}
      />
    </div>
  );
};
