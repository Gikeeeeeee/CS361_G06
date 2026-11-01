import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
    async (destinationId: string, _destinationName: string, wheelchairAccessible: boolean) => {
      if (!activeCheckpoint) return;

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
        console.error('Failed to calculate route:', err);
        const msg = err?.message || 'Route not found or destination outside service area.';
        setNavigationError(msg);
        setIsNavigating(false);
        setIsDestinationModalOpen(true);
      } finally {
        setIsLoadingRoute(false);
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
      // If we don't have an active checkpoint yet, default to the main lobby checkpoint
      const defaultCheckpoint = navigationApi.getCheckpoints()[0];
      setActiveCheckpoint(defaultCheckpoint);
      setIsDestinationModalOpen(true);
    },
    []
  );

  const endNavigation = useCallback(() => {
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
      <NavigationView
        isOpen={isNavigating}
        route={activeRoute}
        isLoading={isLoadingRoute}
        onClose={endNavigation}
      />

      {/* Route Error Notification Toast */}
      {navigationError && (
        <div className="fixed top-4 left-4 right-4 z-[120] max-w-md mx-auto p-3.5 bg-rose-600 text-white rounded-2xl shadow-2xl border border-rose-500/80 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <span className="font-bold">⚠️ Route Error:</span>
            <span>{navigationError}</span>
          </div>
          <button
            onClick={() => setNavigationError(null)}
            className="p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer text-white"
            aria-label="Dismiss"
          >
            ✕
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
