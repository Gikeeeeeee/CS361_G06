import React, { createContext, useContext, useState, useCallback } from 'react';
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
    async (destinationId: string, destinationName: string, wheelchairAccessible: boolean) => {
      if (!activeCheckpoint) return;

      setIsLoadingRoute(true);
      setIsDestinationModalOpen(false);
      setIsNavigating(true);

      try {
        const result = await navigationApi.searchRoute({
          start_id: activeCheckpoint.node_id,
          start_type: 'NODE',
          destination_id: destinationId,
          destination_type: 'ROOM',
          preferences: {
            wheelchair_accessible: wheelchairAccessible,
          },
          destination_metadata:
            prefilledMeta && (!prefilledMeta.roomId || prefilledMeta.roomId === destinationId)
              ? prefilledMeta
              : { roomName: destinationName },
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
      } catch (err) {
        console.error('Failed to calculate route:', err);
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
