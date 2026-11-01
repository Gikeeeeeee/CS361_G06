import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Ban, 
  Search, 
  Edit3, 
  RefreshCw, 
  Loader2,
  Check
} from 'lucide-react';
import { facilityCache } from '../../admin-schedule/services/facilityCache';
import type { Building, Floor } from '../../admin-schedule/services/scheduleApi';
import { useSvgFloorPlan } from '../../campus-explorer/components/floor-viewer/hooks/useSvgFloorPlan';
import { InteractiveSvgMap } from '../../campus-explorer/components/floor-viewer/components/InteractiveSvgMap';
import { statusApi } from '../../admin-status/services/statusApi';
import type { FloorStatusOverlayData, RoomStatus } from '../../admin-status/types/status.types';
import { StatusEditDrawer } from '../../admin-status/components/StatusEditDrawer';

export const BuildingsPage: React.FC = () => {
  // 1. Dynamic Facility Selectors State (Zero Hardcoding)
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [isLoadingBuildings, setIsLoadingBuildings] = useState<boolean>(true);
  const [isLoadingFloors, setIsLoadingFloors] = useState<boolean>(false);

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

  // Determine SVG URL dynamically from database/backend
  const svgUrl = useMemo(() => {
    if (!currentFloor) return undefined;
    const floorAny = currentFloor as any;
    return floorAny.floor_plan?.url || floorAny.map?.url || undefined;
  }, [currentFloor]);

  const { svgContent, loading: isSvgLoading } = useSvgFloorPlan(svgUrl);

  // Fetch status overlay for selected floor
  const fetchStatusOverlay = useCallback(async () => {
    if (!selectedFloorId) return;
    setIsLoadingStatus(true);
    try {
      const data = await statusApi.getFloorStatusOverlay(selectedFloorId);
      setStatusOverlayData(data);
    } catch (err) {
      console.error('Failed to load status overlay:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [selectedFloorId]);

  useEffect(() => {
    fetchStatusOverlay();
  }, [fetchStatusOverlay]);

  // Format status overlay for InteractiveSvgMap prop
  const statusOverlayMap = useMemo(() => {
    const map: Record<string, { status: string; note?: string | null }> = {};
    if (!statusOverlayData) return map;

    // Room status entries
    statusOverlayData.rooms.forEach((r) => {
      const entry = { status: r.status, note: r.status_note };
      map[r.room_id] = entry;
      map[r.room_code] = entry;
      map[r.room_code.toLowerCase()] = entry;

      const meta = facilityCache.roomMeta.get(r.room_id);
      if (meta) {
        if (meta.nameEn) {
          map[meta.nameEn] = entry;
          map[meta.nameEn.toLowerCase()] = entry;
        }
        if (meta.roomNumber) {
          map[meta.roomNumber] = entry;
          map[meta.roomNumber.toLowerCase()] = entry;
        }
      }
    });

    if (currentFloor) {
      const fRooms = (currentFloor as any).rooms || [];
      fRooms.forEach((fr: any) => {
        const statusItem = statusOverlayData.rooms.find((r) => r.room_id === fr.id);
        if (statusItem) {
          const entry = { status: statusItem.status, note: statusItem.status_note };
          if (fr.name?.en) {
            map[fr.name.en] = entry;
            map[fr.name.en.toLowerCase()] = entry;
          }
          if (fr.name?.th) {
            map[fr.name.th] = entry;
            map[fr.name.th.toLowerCase()] = entry;
          }
          if (fr.room_number) {
            map[fr.room_number] = entry;
            map[fr.room_number.toLowerCase()] = entry;
          }
        }
      });
    }

    // Corridor edges
    statusOverlayData.corridor_edges.forEach((e) => {
      map[e.edge_id] = { status: e.status, note: e.status_note };
    });

    // Navigation nodes
    statusOverlayData.navigation_nodes.forEach((n) => {
      map[n.node_id] = { status: n.status, note: n.status_note };
    });

    return map;
  }, [statusOverlayData, currentFloor]);

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

  // Handle clicking a room on SVG
  const handleRoomClick = (roomId: string, rawElementId: string) => {
    setHighlightedRoomId(roomId);

    // Look up existing status
    const bCode = currentBuilding?.code || '';
    const cleanCode = roomId.toUpperCase().includes(bCode) ? roomId.toUpperCase() : `${bCode}-${roomId.toUpperCase()}`;
    const existing = statusOverlayData?.rooms.find((r) => {
      if (r.room_id.toLowerCase() === roomId.toLowerCase()) return true;
      if (r.room_code.toLowerCase() === roomId.toLowerCase()) return true;
      if (r.room_code.toLowerCase().endsWith(roomId.toLowerCase())) return true;
      const meta = facilityCache.roomMeta.get(r.room_id);
      if (meta) {
        if (meta.nameEn?.toLowerCase() === roomId.toLowerCase()) return true;
        if ((meta as any).nameTh?.toLowerCase() === roomId.toLowerCase()) return true;
        if (meta.roomNumber?.toLowerCase() === roomId.toLowerCase()) return true;
      }
      return false;
    });

    let resolvedId = existing?.room_id;
    let resolvedCode = existing?.room_code;
    let resolvedName = existing?.room_code || roomId;

    if (!resolvedId && currentFloor) {
      const fRooms = (currentFloor as any).rooms || [];
      const match = fRooms.find((fr: any) => {
        const idMatch = fr.id?.toLowerCase() === roomId.toLowerCase();
        const enMatch = fr.name?.en?.toLowerCase() === roomId.toLowerCase();
        const thMatch = fr.name?.th?.toLowerCase() === roomId.toLowerCase();
        const numMatch = fr.room_number?.toLowerCase() === roomId.toLowerCase();
        return idMatch || enMatch || thMatch || numMatch;
      });
      if (match) {
        resolvedId = match.id;
        resolvedCode = match.name?.en || match.room_number || cleanCode;
        resolvedName = match.name?.en || match.name?.th || cleanCode;
      }
    }

    setEditingTarget({
      type: 'ROOM',
      id: resolvedId || (rawElementId ? `RM_${rawElementId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}` : `RM_${roomId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`),
      code: resolvedCode || cleanCode,
      name: resolvedName ? `Room ${resolvedName}` : `Room ${roomId}`,
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
        await statusApi.updateCorridorStatus(selectedFloorId, id, newStatus as any, note);
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
    }
  };

  // Filtered rooms list for table
  const filteredRooms = useMemo(() => {
    const list = statusOverlayData?.rooms || [];
    return list.filter((r) => {
      const matchSearch =
        !searchFilter.trim() ||
        r.room_code.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (r.status_note && r.status_note.toLowerCase().includes(searchFilter.toLowerCase()));

      const matchStatus =
        statusFilter === 'ALL' || r.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [statusOverlayData, searchFilter, statusFilter]);

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
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              disabled={isLoadingBuildings}
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
              onChange={(e) => setSelectedFloorId(e.target.value)}
              disabled={isLoadingFloors || floors.length === 0}
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
            disabled={isLoadingStatus}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition active:scale-95 shadow-xs"
            title="Reload Floor Status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Counters Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Rooms</div>
            <div className="text-xl font-bold text-slate-900">{stats.total}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-emerald-600">Active / Open</div>
            <div className="text-xl font-bold text-emerald-700">{stats.active}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-amber-600">Maintenance</div>
            <div className="text-xl font-bold text-amber-700">{stats.maintenance}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <Ban className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-red-600">Closed</div>
            <div className="text-xl font-bold text-red-700">{stats.closed}</div>
          </div>
        </div>
      </div>

      {/* Main Interactive Map Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Map Header / Legend */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="font-semibold text-slate-700 flex items-center gap-2">
            <span>Interactive Floor Overlay:</span>
            <span className="font-normal text-slate-500">
              Click any room on the plan to modify its operational status
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
          {isSvgLoading || isLoadingFloors ? (
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
                <th className="px-5 py-3">Current Status</th>
                <th className="px-5 py-3">Reason / Status Note</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                    No room matching the current filter.
                  </td>
                </tr>
              ) : (
                filteredRooms.map((r) => {
                  const isMaint = r.status === 'MAINTENANCE';
                  const isClosed = r.status === 'CLOSED';

                  return (
                    <tr
                      key={r.room_id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => {
                        setHighlightedRoomId(r.room_code);
                        setEditingTarget({
                          type: 'ROOM',
                          id: r.room_id,
                          code: r.room_code,
                          name: `Room ${r.room_code}`,
                          floorId: selectedFloorId,
                          buildingCode: currentBuilding?.code,
                          currentStatus: r.status,
                          currentNote: r.status_note,
                        });
                        setIsDrawerOpen(true);
                      }}
                    >
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        {r.room_code}
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
                            setHighlightedRoomId(r.room_code);
                            setEditingTarget({
                              type: 'ROOM',
                              id: r.room_id,
                              code: r.room_code,
                              name: `Room ${r.room_code}`,
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
        onClose={() => setIsDrawerOpen(false)}
        target={editingTarget}
        onSave={handleSaveStatus}
      />
    </div>
  );
};
