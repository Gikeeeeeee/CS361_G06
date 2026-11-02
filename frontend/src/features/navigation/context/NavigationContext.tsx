import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { navigationApi } from '../services/navigationApi';
import type { QRCheckpoint, RouteResult } from '../types/navigation.types';
import { QrScannerModal } from '../components/QrScannerModal';
import { DestinationModal } from '../components/DestinationModal';
import { NavigationView } from '../components/NavigationView';

interface NavigationContextType {
  isScannerOpen: boolean;
  isDestinationModalOpen: boolean;
  isNavigating: boolean;
  activeCheckpoint: QRCheckpoint | null;
  activeRoute: RouteResult | null;
  openQrScanner: () => void;
  closeQrScanner: () => void;
  navigateToRoom: (
    roomIdOrCode: string,
    roomName?: string,
    options?: {
      roomId?: string;
      floorId?: string;
      floorSvgUrl?: string;
      buildingCode?: string;
      floorNumber?: number;
      roomNumber?: string;
      roomName?: string;
    }
  ) => void;
  endNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const routeGeneration = useRef(0);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] = useState<QRCheckpoint | null>(null);
  const [prefilledDestination, setPrefilledDestination] = useState<string>('');
  const [prefilledMeta, setPrefilledMeta] = useState<{
    roomId?: string;
    floorId?: string;
    floorSvgUrl?: string;
    buildingCode?: string;
    floorNumber?: number;
    roomNumber?: string;
    roomName?: string;
  } | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Discard displayed and in-flight routes when corridor availability changes.
  useEffect(() => {
    const invalidate = () => {
      ++routeGeneration.current;
      setActiveRoute(null);
      setIsLoadingRoute(false);
      setIsNavigating(false);
      if (isNavigating) {
        setNavigationError('Corridor availability changed. Calculate your route again.');
        setIsDestinationModalOpen(true);
      }
    };
    const onStatus = (event: Event) => {
      if ((event as CustomEvent).detail?.edgeId) invalidate();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ku_long_corridor_revision') invalidate();
    };
    window.addEventListener('floor-status-updated', onStatus);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('floor-status-updated', onStatus);
      window.removeEventListener('storage', onStorage);
    };
  }, [isNavigating]);

  // Preload dynamic QR checkpoints from Backend on mount
  useEffect(() => {
    navigationApi.getCheckpointsAsync().catch(() => {});
  }, []);

  // Detect QR code scan or deep-link via query parameter (e.g. /navigation?start=LC3-F1-QR1)
  useEffect(() => {
    const startParam =
      searchParams.get('start') ||
      searchParams.get('start_node') ||
      searchParams.get('start_id') ||
      searchParams.get('checkpoint');
    const destParam =
      searchParams.get('dest') ||
      searchParams.get('destination') ||
      searchParams.get('destination_id') ||
      searchParams.get('room');

    if (startParam) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('start');
      newParams.delete('start_node');
      newParams.delete('start_id');
      newParams.delete('checkpoint');
      newParams.delete('dest');
      newParams.delete('destination');
      newParams.delete('destination_id');
      newParams.delete('room');
      setSearchParams(newParams, { replace: true });

      navigationApi
        .resolveCheckpointAsync(startParam)
        .then((checkpoint) => {
          if (checkpoint) {
            setActiveCheckpoint(checkpoint);
            setIsScannerOpen(false);
            if (destParam) {
              setPrefilledDestination(destParam);
            }
            setIsDestinationModalOpen(true);
          } else {
            setNavigationError(`Unrecognized checkpoint "${startParam}". Please select or scan a valid campus checkpoint.`);
            setIsScannerOpen(true);
          }
        })
        .catch(() => {
          setNavigationError('Unable to connect to server to verify checkpoint.');
          setIsScannerOpen(true);
        });
    }
  }, [searchParams, setSearchParams]);

  // Auto-dismiss error after 6 seconds
  useEffect(() => {
    if (!navigationError) return;
    const t = setTimeout(() => setNavigationError(null), 6000);
    return () => clearTimeout(t);
  }, [navigationError]);

  const openQrScanner = useCallback(() => {
    setIsScannerOpen(true);
  }, []);

  const closeQrScanner = useCallback(() => {
    setIsScannerOpen(false);
  }, []);

  const handleScanSuccess = useCallback((checkpoint: QRCheckpoint) => {
    setActiveCheckpoint(checkpoint);
    setIsScannerOpen(false);
    setIsDestinationModalOpen(true);
  }, []);

  const startNavigation = useCallback(
    async (destinationId: string, _destinationName: string, wheelchairAccessible: boolean = false) => {
      if (!activeCheckpoint) return;
      const generation = ++routeGeneration.current;
      setActiveRoute(null);

      setIsLoadingRoute(true);
      setIsDestinationModalOpen(false);
      setIsNavigating(true);
      setNavigationError(null);

      try {
        const result = await navigationApi.searchRoute({
          start_id: activeCheckpoint.node_id,
          start_type: 'NODE',
          destination_id: destinationId,
          destination_type: 'ROOM',
          preferences: {
            wheelchair_accessible: wheelchairAccessible,
          },
        });

        if (generation !== routeGeneration.current) return;
        // Ensure floorSvgUrl is preserved if route didn't populate it and it belongs to this room
        if (
          !result.svg_path.url &&
          prefilledMeta?.floorSvgUrl &&
          (!prefilledMeta.roomId || prefilledMeta.roomId === destinationId)
        ) {
          result.svg_path.url = prefilledMeta.floorSvgUrl;
        }

        setActiveRoute(result);
      } catch (err: any) {
        if (generation !== routeGeneration.current) return;
        console.error('Failed to calculate route:', err);
        const msg = err?.message || 'Route not found or destination outside service area.';
        setNavigationError(msg);
        setIsNavigating(false);
        setIsDestinationModalOpen(true);
      } finally {
        if (generation === routeGeneration.current) setIsLoadingRoute(false);
      }
    },
    [activeCheckpoint, prefilledMeta]
  );

  const navigateToRoom = useCallback(
    (
      roomIdOrCode: string,
      roomName?: string,
      options?: {
        floorId?: string;
        floorSvgUrl?: string;
        buildingCode?: string;
        floorNumber?: number;
        roomNumber?: string;
        roomName?: string;
      }
    ) => {
      setPrefilledDestination(roomName || roomIdOrCode);
      setPrefilledMeta(options || null);
      if (activeCheckpoint) {
        setIsDestinationModalOpen(true);
      } else {
        const available = navigationApi.getCheckpoints();
        if (available.length > 0) {
          setActiveCheckpoint(available[0]);
          setIsDestinationModalOpen(true);
        } else {
          navigationApi
            .getCheckpointsAsync()
            .then((cps) => {
              if (cps.length > 0) {
                setActiveCheckpoint(cps[0]);
                setIsDestinationModalOpen(true);
              } else {
                setNavigationError('No checkpoints available on campus.');
                setIsScannerOpen(true);
              }
            })
            .catch(() => {
              setIsScannerOpen(true);
            });
        }
      }
    },
    []
  );

  const endNavigation = useCallback(() => {
    ++routeGeneration.current;
    setIsNavigating(false);
    setActiveRoute(null);
    setPrefilledMeta(null);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        isScannerOpen,
        isDestinationModalOpen,
        isNavigating,
        activeCheckpoint,
        activeRoute,
        openQrScanner,
        closeQrScanner,
        navigateToRoom,
        endNavigation,
      }}
    >
      {children}

      {/* QR Scanner Viewfinder Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={closeQrScanner}
        onScanSuccess={handleScanSuccess}
      />

      {/* Destination Picker Modal */}
      <DestinationModal
        isOpen={isDestinationModalOpen}
        checkpoint={activeCheckpoint}
        initialDestination={prefilledDestination}
        onClose={() => setIsDestinationModalOpen(false)}
        onStartNavigation={startNavigation}
        onChangeCheckpoint={() => {
          setIsDestinationModalOpen(false);
          setIsScannerOpen(true);
        }}
      />

      {/* Active Navigation Fullscreen View */}
      {isNavigating && (
        <NavigationView
          key={activeRoute ? `${activeRoute.summary.start_name}-${activeRoute.summary.destination_name}-${activeRoute.svg_path.floor_id}` : 'active-nav'}
          isOpen={isNavigating}
          route={activeRoute}
          isLoading={isLoadingRoute}
          onClose={endNavigation}
        />
      )}

      {/* Route Error Notification Toast */}
      {navigationError && (
        <div className="fixed top-4 left-4 right-4 z-[120] max-w-md mx-auto p-3.5 bg-rose-600 text-white rounded-2xl shadow-2xl border border-rose-500/80 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <span className="font-bold">Route Error:</span>
            <span>{navigationError}</span>
          </div>
          <button
            onClick={() => setNavigationError(null)}
            className="p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer text-white flex items-center justify-center"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </NavigationContext.Provider>
  );
};

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
