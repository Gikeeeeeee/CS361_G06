import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  QrCode,
  Camera,
  Flashlight,
  MapPin,
  CheckCircle2,
  Download,
  Map,
  List,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  RotateCcw,
  Maximize2,
  Search,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { motion, useDragControls, type PanInfo } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import jsQR from 'jsqr';
import { navigationApi } from '../services/navigationApi';
import type { QRCheckpoint } from '../types/navigation.types';
import { campusService } from '../../campus-explorer/services';
import { useSvgFloorPlan } from '../../campus-explorer/components/floor-viewer/hooks/useSvgFloorPlan';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (checkpoint: QRCheckpoint) => void;
}

const FLOOR_IDS: Record<string, Record<number, string>> = {
  LC3: {
    1: 'deaef033-ba6c-5c0e-bb50-956202b57947',
    2: '2144ef87-969d-5b9a-abd1-0485f5742893',
  },
  LC4: {
    1: 'a6ab42cb-0abd-57ee-acd2-993d64b20a82',
    2: 'd9c020ee-1f1f-5035-a7ec-2f9063569335',
    3: '57040add-f04e-5fab-9b78-814250d708b1',
  },
};

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [detectedValue, setDetectedValue] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);
  const [previewQr, setPreviewQr] = useState<QRCheckpoint | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const onScanSuccessRef = useRef(onScanSuccess);
  onScanSuccessRef.current = onScanSuccess;

  // Dynamic Checkpoints state loaded strictly from Backend API
  const [checkpoints, setCheckpoints] = useState<QRCheckpoint[]>([]);
  const [isLoadingCheckpoints, setIsLoadingCheckpoints] = useState<boolean>(true);
  const [checkpointsError, setCheckpointsError] = useState<string | null>(null);

  const loadCheckpoints = useCallback(() => {
    setIsLoadingCheckpoints(true);
    setCheckpointsError(null);
    navigationApi
      .getCheckpointsAsync()
      .then((cps) => {
        setCheckpoints(cps || []);
        setIsLoadingCheckpoints(false);
      })
      .catch((err: any) => {
        setCheckpointsError(err?.message || 'Unable to connect to server to load checkpoints.');
        setIsLoadingCheckpoints(false);
      });
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadCheckpoints();
    }
  }, [isOpen, loadCheckpoints]);

  // Derived available buildings and floors strictly from Backend API data
  const availableBuildings = useMemo(() => {
    return Array.from(new Set(checkpoints.map((c) => c.building_code))).sort();
  }, [checkpoints]);

  // Visual Floor Map Checkpoint Guide State
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('LC4');
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [activeFloorSvgUrl, setActiveFloorSvgUrl] = useState<string | undefined>(undefined);
  const [selectedPinCp, setSelectedPinCp] = useState<QRCheckpoint | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState<boolean>(false);

  // Synchronize building and floor when availableBuildings update
  const effectiveBuilding = useMemo(() => {
    if (availableBuildings.length === 0) return '';
    return availableBuildings.includes(selectedBuilding) ? selectedBuilding : availableBuildings[0];
  }, [availableBuildings, selectedBuilding]);

  const availableFloors = useMemo(() => {
    if (!effectiveBuilding) return [];
    return Array.from(
      new Set(
        checkpoints
          .filter((c) => c.building_code === effectiveBuilding)
          .map((c) => c.floor_number)
      )
    ).sort((a, b) => a - b);
  }, [checkpoints, effectiveBuilding]);

  const effectiveFloor = useMemo(() => {
    if (availableFloors.length === 0) return 1;
    return availableFloors.includes(selectedFloor) ? selectedFloor : availableFloors[0];
  }, [availableFloors, selectedFloor]);

  // List Search & Filters
  const [listSearch, setListSearch] = useState<string>('');
  const [listBuildingFilter, setListBuildingFilter] = useState<string>('ALL');
  const [listFloorFilter, setListFloorFilter] = useState<number | 'ALL'>('ALL');

  // Window dimensions for fluid drag constraints (matches homepage PeekBottomSheet)
  const getWindowHeight = () => (typeof window !== 'undefined' ? window.innerHeight : 800);
  const [windowHeight, setWindowHeight] = useState(getWindowHeight);

  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const SHEET_HEIGHT = Math.min(560, Math.round(windowHeight * 0.72));
  const PEEK_HEADER_HEIGHT = 64;
  const COLLAPSED_Y = Math.max(120, SHEET_HEIGHT - PEEK_HEADER_HEIGHT);

  // Draggable Bottom Sheet Animation Controls
  type BottomSheetSnap = 'peek' | 'expanded';
  const [snap, setSnap] = useState<BottomSheetSnap>('peek');
  const dragControls = useDragControls();
  const headerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleSheet = () => {
    setSnap((prev) => (prev === 'expanded' ? 'peek' : 'expanded'));
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const velocityThreshold = 180;
    const distanceThreshold = 50;

    if (snap === 'expanded') {
      if (offset.y > distanceThreshold || velocity.y > velocityThreshold) {
        setSnap('peek');
      } else {
        setSnap('expanded');
      }
    } else {
      if (offset.y < -distanceThreshold || velocity.y < -velocityThreshold) {
        setSnap('expanded');
      } else {
        setSnap('peek');
      }
    }
  };

  // Fetch Floor SVG whenever effectiveBuilding or effectiveFloor changes
  useEffect(() => {
    if (!effectiveBuilding) return;
    let isMounted = true;
    const targetFloorId =
      FLOOR_IDS[effectiveBuilding]?.[effectiveFloor] ||
      checkpoints.find((c) => c.building_code === effectiveBuilding && c.floor_number === effectiveFloor)?.floor_id ||
      '';

    if (targetFloorId) {
      campusService
        .getFloorById(targetFloorId)
        .then((floor) => {
          if (!isMounted) return;
          const url = (floor as any)?.floor_plan?.url || (floor as any)?.map?.url;
          if (url) setActiveFloorSvgUrl(url);
        })
        .catch(() => {});
    }

    const firstInFloor =
      checkpoints.find(
        (c) => c.building_code === effectiveBuilding && c.floor_number === effectiveFloor
      ) ||
      checkpoints.find((c) => c.building_code === effectiveBuilding) ||
      checkpoints[0] ||
      null;

    setSelectedPinCp(firstInFloor);

    return () => {
      isMounted = false;
    };
  }, [effectiveBuilding, effectiveFloor, checkpoints]);

  const { svgContent, loading: mapLoading } = useSvgFloorPlan(activeFloorSvgUrl);

  // Filter checkpoints for current map view
  const currentFloorCheckpoints = useMemo(() => {
    if (!effectiveBuilding) return [];
    return checkpoints.filter(
      (cp) => cp.building_code === effectiveBuilding && cp.floor_number === effectiveFloor
    );
  }, [checkpoints, effectiveBuilding, effectiveFloor]);

  // Filter checkpoints for list view
  const filteredListCheckpoints = useMemo(() => {
    return checkpoints.filter((cp) => {
      if (listBuildingFilter !== 'ALL' && cp.building_code !== listBuildingFilter) {
        return false;
      }
      if (listFloorFilter !== 'ALL' && cp.floor_number !== listFloorFilter) {
        return false;
      }
      if (listSearch.trim()) {
        const q = listSearch.toLowerCase();
        const matchName = cp.name.toLowerCase().includes(q);
        const matchId = cp.id.toLowerCase().includes(q);
        const matchNode = cp.node_id.toLowerCase().includes(q);
        const matchDesc = (cp.description || '').toLowerCase().includes(q);
        return matchName || matchId || matchNode || matchDesc;
      }
      return true;
    });
  }, [checkpoints, listBuildingFilter, listFloorFilter, listSearch]);

  // Camera & QR Scanning Lifecycle
  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
      setCameraError(null);
      setIsLoadingCamera(false);
      setDetectedValue(null);
      setTorchOn(false);
      setHasTorch(false);
      return;
    }

    let isCancelled = false;
    let animId: number;
    let localStream: MediaStream | null = null;
    let isScanning = true;

    async function startCamera() {
      setIsLoadingCamera(true);
      setCameraError(null);
      setDetectedValue(null);

      if (!navigator?.mediaDevices?.getUserMedia) {
        if (!isCancelled) {
          setCameraError('Camera access is not supported by your browser.');
          setIsLoadingCamera(false);
        }
        return;
      }

      try {
        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback to basic video constraint
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (isCancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStream = mediaStream;
        streamRef.current = mediaStream;
        setStream(mediaStream);

        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (videoTrack as any).getCapabilities?.() || {};
          setHasTorch(Boolean(capabilities.torch));
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.setAttribute('playsinline', 'true');
          try {
            await videoRef.current.play();
          } catch {
            // Autoplay catch
          }
        }

        setIsLoadingCamera(false);

        // QR frame analyzer using jsQR
        const scanFrame = () => {
          if (!isScanning || isCancelled) return;

          const video = videoRef.current;
          const canvas = canvasRef.current;

          if (video && canvas && video.readyState >= video.HAVE_CURRENT_DATA) {
            const width = video.videoWidth;
            const height = video.videoHeight;

            if (width > 0 && height > 0) {
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'dontInvert',
                });

                if (code && code.data) {
                  const qrCodeText = code.data.trim();
                  if (qrCodeText) {
                    // Validate against actual Backend-derived checkpoint data
                    const resolved = navigationApi.resolveCheckpoint(qrCodeText);
                    if (!resolved) {
                      // Unknown QR ID: Reject strictly without guessing
                      setCameraError(`Unrecognized QR code (${qrCodeText}). This checkpoint is not registered in the system.`);
                      setDetectedValue(null);
                      setTimeout(() => {
                        if (!isCancelled) {
                          setCameraError(null);
                        }
                      }, 2500);
                      return;
                    }

                    // Known valid checkpoint
                    isScanning = false;
                    setDetectedValue(resolved.name || resolved.id);

                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                      try {
                        navigator.vibrate(100);
                      } catch {
                        // Ignore vibrate failure
                      }
                    }

                    setTimeout(() => {
                      if (!isCancelled) {
                        onScanSuccessRef.current(resolved);
                      }
                    }, 400);
                    return;
                  }
                }
              }
            }
          }

          animId = requestAnimationFrame(scanFrame);
        };

        animId = requestAnimationFrame(scanFrame);
      } catch (err: any) {
        if (isCancelled) return;
        setIsLoadingCamera(false);
        const errName = err?.name || '';
        let userMessage = 'Unable to access camera. Please check camera permissions.';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          userMessage = 'Camera permission was denied. Please allow camera access in your browser settings.';
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          userMessage = 'No camera found on this device.';
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          userMessage = 'Camera is already in use by another app or browser tab.';
        } else if (errName === 'OverconstrainedError') {
          userMessage = 'Requested camera resolution is not supported.';
        }
        setCameraError(userMessage);
      }
    }

    startCamera();

    return () => {
      isCancelled = true;
      isScanning = false;
      if (animId) cancelAnimationFrame(animId);
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
      setTorchOn(false);
      setHasTorch(false);
    };
  }, [isOpen, retryTrigger]);

  const toggleTorch = async () => {
    const activeMedia = streamRef.current || stream;
    if (!activeMedia) return;
    const track = activeMedia.getVideoTracks()[0];
    if (!track) return;
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch {
      // Torch toggle failed
    }
  };

  const handleRetryCamera = () => {
    setCameraError(null);
    setRetryTrigger((prev) => prev + 1);
  };

  const handleSelectCheckpoint = (checkpoint: QRCheckpoint) => {
    onScanSuccess(checkpoint);
  };

  const handleCopyDeepLink = (cp: QRCheckpoint) => {
    const deepLinkUrl = `https://d2k1h3uc8pux1o.cloudfront.net/navigation?start=${cp.id}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(deepLinkUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }).catch(() => {});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200 select-none">
      {/* Top Header Bar */}
      <div className="p-4 pt-6 flex items-center justify-between text-white z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white shadow-xs">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Scan Checkpoint QR</h2>
            <p className="text-[11px] text-slate-300">Point your camera at a campus QR checkpoint</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 flex items-center justify-center text-white transition-all cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Center Viewfinder */}
      <div
        className={`relative flex-1 flex flex-col items-center justify-center px-4 transition-all duration-300 ease-out ${
          snap === 'peek' ? 'py-8 pb-20' : 'py-2 pb-6'
        }`}
      >
        <div
          className={`relative rounded-3xl overflow-hidden transition-all duration-300 shadow-2xl bg-black flex items-center justify-center ${
            snap === 'peek' ? 'w-64 h-64 sm:w-72 sm:h-72' : 'w-48 h-48 sm:w-56 sm:h-56'
          } ${
            detectedValue
              ? 'border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.35)]'
              : cameraError
              ? 'border-2 border-rose-500/80 shadow-[0_0_30px_rgba(244,63,94,0.25)]'
              : 'border border-white/20 shadow-[0_0_25px_rgba(0,0,0,0.6)]'
          }`}
        >
          {/* Video Stream Element */}
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={`w-full h-full object-cover ${stream && !cameraError ? 'block' : 'hidden'}`}
          />
          {/* Hidden Canvas for jsQR Sampling */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Loading / Error Placeholder */}
          {(!stream || cameraError) && (
            <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center z-10">
              {isLoadingCamera ? (
                <>
                  <Loader2 className="w-8 h-8 stroke-[2] text-blue-500 animate-spin mb-2" />
                  <p className="text-xs font-semibold text-slate-200">Starting camera...</p>
                  <p className="text-[10px] text-slate-400 mt-1">Please allow camera access when prompted</p>
                </>
              ) : cameraError ? (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2 border border-rose-500/20">
                    <Camera className="w-5 h-5 stroke-[2]" />
                  </div>
                  <p className="text-xs font-bold text-rose-300 mb-1">Camera Notice</p>
                  <p className="text-[11px] text-slate-300 max-w-[210px] leading-relaxed mb-3">
                    {cameraError}
                  </p>
                  <button
                    type="button"
                    onClick={handleRetryCamera}
                    className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Try Again</span>
                  </button>
                </>
              ) : (
                <>
                  <Camera className="w-10 h-10 stroke-[1.5] text-slate-500 mb-2" />
                  <p className="text-xs text-slate-400">Align QR code inside this frame</p>
                </>
              )}
            </div>
          )}

          {/* Success Overlay when detected */}
          {detectedValue && (
            <div className="absolute inset-0 bg-emerald-950/50 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20 animate-in fade-in duration-150">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
              <div className="text-xs font-bold text-emerald-300">Checkpoint Detected!</div>
              <div className="text-[11px] text-emerald-100 font-mono mt-0.5 max-w-[180px] truncate">{detectedValue}</div>
            </div>
          )}

          {/* Viewfinder Reticle Corners */}
          <div
            className={`absolute top-3 left-3 w-6 h-6 border-t-3 border-l-3 rounded-tl-xl pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : 'border-blue-500'
            }`}
          />
          <div
            className={`absolute top-3 right-3 w-6 h-6 border-t-3 border-r-3 rounded-tr-xl pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : 'border-blue-500'
            }`}
          />
          <div
            className={`absolute bottom-3 left-3 w-6 h-6 border-b-3 border-l-3 rounded-bl-xl pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : 'border-blue-500'
            }`}
          />
          <div
            className={`absolute bottom-3 right-3 w-6 h-6 border-b-3 border-r-3 rounded-br-xl pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : 'border-blue-500'
            }`}
          />

          {/* Subtle Laser Sweep Indicator */}
          {!detectedValue && stream && !cameraError && (
            <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse pointer-events-none" />
          )}
        </div>

        {/* Viewfinder Status / Torch Control */}
        <div className="flex items-center gap-2 mt-3">
          <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 backdrop-blur-md text-[11px] font-medium text-slate-300 flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Align QR code within the frame</span>
          </div>

          {hasTorch && stream && !cameraError && (
            <button
              onClick={toggleTorch}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                torchOn
                  ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
              }`}
            >
              <Flashlight className="w-3.5 h-3.5" />
              <span>{torchOn ? 'Flashlight On' : 'Flashlight'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Draggable Bottom Sheet */}
      <motion.div
        className="fixed inset-x-0 bottom-0 z-30 flex flex-col bg-white rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.3)] border-t border-slate-200/80 max-w-lg mx-auto overflow-hidden"
        style={{ height: SHEET_HEIGHT }}
        initial={{ y: COLLAPSED_Y }}
        animate={{ y: snap === 'expanded' ? 0 : COLLAPSED_Y }}
        transition={{ type: 'spring', damping: 26, stiffness: 280, mass: 0.8 }}
        drag="y"
        dragDirectionLock
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: COLLAPSED_Y }}
        dragElastic={0.04}
        onDragEnd={handleDragEnd}
      >
        {/* Interactive Handle Header */}
        <div
          ref={headerRef}
          onPointerDown={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, a, input, select')) return;
            dragControls.start(e);
          }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, a, input, select')) return;
            toggleSheet();
          }}
          className="w-full flex flex-col items-center pt-3 pb-2.5 px-4 rounded-t-3xl bg-white select-none cursor-grab active:cursor-grabbing border-b border-slate-100 shrink-0 touch-none"
        >
          <div className="w-10 h-1 bg-slate-300 rounded-full mb-2 pointer-events-none" />
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Map className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 truncate">
                Campus Checkpoints {isLoadingCheckpoints ? '(Loading...)' : `(${checkpoints.length})`}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline truncate">
                • {snap === 'peek' ? 'Drag up or tap to explore' : 'Drag down or tap to collapse'}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleSheet();
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 cursor-pointer shrink-0 ml-2"
              title={snap === 'peek' ? 'Expand' : 'Collapse'}
            >
              {snap === 'peek' ? (
                <ChevronUp className="w-4 h-4 text-slate-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Sheet Content */}
        <div
          ref={scrollRef}
          className={`flex-1 w-full px-4 sm:px-6 pt-3 pb-6 overscroll-contain flex flex-col min-h-0 ${
            snap !== 'expanded' ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Checkpoints Loading State */}
          {isLoadingCheckpoints && checkpoints.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
              <p className="text-xs font-medium text-slate-600">Loading checkpoints from server...</p>
            </div>
          ) : checkpointsError && checkpoints.length === 0 ? (
            /* Checkpoints Error State */
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-2">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-800 mb-1">Failed to Load Checkpoints</p>
              <p className="text-[11px] text-slate-500 max-w-[240px] mb-3 leading-relaxed">{checkpointsError}</p>
              <button
                type="button"
                onClick={loadCheckpoints}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : checkpoints.length === 0 ? (
            /* Checkpoints Empty State */
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
              <MapPin className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-800 mb-0.5">No Checkpoints Available</p>
              <p className="text-[11px] text-slate-400 max-w-[220px]">
                There are currently no active checkpoints configured on the server.
              </p>
            </div>
          ) : (
            /* Checkpoints Content */
            <>
              {/* Mode Switcher Tabs */}
              <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {viewMode === 'map' ? 'Interactive Map Guide' : 'Checkpoint Directory'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {viewMode === 'map'
                      ? 'Select building & floor, tap any checkpoint pin'
                      : `Browse all ${checkpoints.length} registered campus checkpoints`}
                  </p>
                </div>

                {/* Segmented Control */}
                <div className="bg-slate-100 p-0.5 rounded-xl flex items-center shrink-0 border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'map'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span>Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>List ({checkpoints.length})</span>
                  </button>
                </div>
              </div>

              {viewMode === 'map' ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Dynamic Building & Floor Selector Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 shrink-0">
                    {/* Building Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
                      {availableBuildings.map((bldg) => {
                        const count = checkpoints.filter((c) => c.building_code === bldg).length;
                        return (
                          <button
                            key={bldg}
                            type="button"
                            onClick={() => setSelectedBuilding(bldg)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              effectiveBuilding === bldg
                                ? 'bg-white text-blue-600 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <span>{bldg} Building</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                effectiveBuilding === bldg
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {count} Pts
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Floor Selector Pills */}
                    <div className="flex items-center gap-1">
                      {availableFloors.map((fl) => (
                        <button
                          key={fl}
                          type="button"
                          onClick={() => setSelectedFloor(fl)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            effectiveFloor === fl
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          Floor {fl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive SVG Floor Map */}
                  <div className="relative w-full h-52 sm:h-56 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shrink-0">
                    {mapLoading || !svgContent ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-xs font-medium text-slate-500">
                          Loading {effectiveBuilding} Floor {effectiveFloor} map...
                        </span>
                      </div>
                    ) : (
                      <TransformWrapper
                        initialScale={1}
                        minScale={0.8}
                        maxScale={4}
                        centerOnInit={true}
                        limitToBounds={false}
                      >
                        {({ zoomIn, zoomOut, resetTransform }) => (
                          <div className="relative w-full h-full">
                            <TransformComponent
                              wrapperClass="!w-full !h-full flex items-center justify-center"
                              contentClass="!w-full !h-full flex items-center justify-center relative select-none"
                            >
                              <div className="relative w-full h-full flex items-center justify-center">
                                {/* Base SVG Floor Plan */}
                                <div
                                  className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-full"
                                  dangerouslySetInnerHTML={{ __html: svgContent }}
                                />

                                {/* Checkpoint Coordinates Marker Layer */}
                                <svg
                                  viewBox={effectiveBuilding === 'LC4' ? '0 0 800 500' : '0 0 1000 650'}
                                  preserveAspectRatio="xMidYMid meet"
                                  className="absolute inset-0 w-full h-full pointer-events-none"
                                >
                                  {currentFloorCheckpoints.map((cp, idx) => {
                                    const isSelected = selectedPinCp?.id === cp.id;
                                    const posX = cp.x ?? 200;
                                    const posY = cp.y ?? 200;
                                    const shortLabel = (cp.name || cp.id)
                                      .split('-')[1] || cp.id;

                                    return (
                                      <g
                                        key={cp.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedPinCp(cp);
                                        }}
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          handleSelectCheckpoint(cp);
                                        }}
                                        className="pointer-events-auto cursor-pointer group"
                                        transform={`translate(${posX}, ${posY})`}
                                      >
                                        {/* Pulsing Aura */}
                                        <circle
                                          r={isSelected ? '22' : '15'}
                                          fill={isSelected ? '#3B82F6' : '#64748B'}
                                          opacity={isSelected ? '0.35' : '0.2'}
                                          className={isSelected ? 'animate-ping' : ''}
                                        />

                                        {/* Pin Body */}
                                        <circle
                                          r={isSelected ? '12' : '9.5'}
                                          fill={isSelected ? '#2563EB' : '#3B82F6'}
                                          stroke="#FFFFFF"
                                          strokeWidth={isSelected ? '2.8' : '2'}
                                          className="transition-all drop-shadow-sm"
                                        />

                                        {/* Number inside Pin */}
                                        <text
                                          y="3.5"
                                          textAnchor="middle"
                                          fill="#FFFFFF"
                                          fontSize={isSelected ? '10' : '8.5'}
                                          fontWeight="bold"
                                          pointerEvents="none"
                                        >
                                          {idx + 1}
                                        </text>

                                        {/* Floating Name Badge */}
                                        <g transform="translate(0, -17)" className="pointer-events-none">
                                          <rect
                                            x={-Math.max(34, shortLabel.length * 3.8)}
                                            y="-15"
                                            width={Math.max(68, shortLabel.length * 7.6)}
                                            height="17"
                                            rx="8.5"
                                            fill={isSelected ? '#1E293B' : '#FFFFFF'}
                                            stroke={isSelected ? '#2563EB' : '#CBD5E1'}
                                            strokeWidth="1.2"
                                            className="drop-shadow-xs"
                                          />
                                          <text
                                            y="-3.5"
                                            textAnchor="middle"
                                            fill={isSelected ? '#FFFFFF' : '#334155'}
                                            fontSize="8.5"
                                            fontWeight="bold"
                                          >
                                            {shortLabel}
                                          </text>
                                        </g>
                                      </g>
                                    );
                                  })}
                                </svg>
                              </div>
                            </TransformComponent>

                            {/* Floating Zoom & Fullscreen Controls */}
                            <div
                              className="absolute top-2 right-2 z-20 flex flex-col items-center bg-white/95 backdrop-blur-xs rounded-xl shadow-xs border border-slate-200/80 p-0.5 gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => zoomIn(0.25)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Zoom In"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => zoomOut(0.25)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Zoom Out"
                              >
                                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <div className="w-4 h-[1px] bg-slate-200" />
                              <button
                                type="button"
                                onClick={() => resetTransform()}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Reset Zoom"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsMapFullscreen(true)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Expand Fullscreen"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </TransformWrapper>
                    )}
                  </div>

                  {/* Selected Checkpoint Detail Card */}
                  {selectedPinCp && (
                    <div className="mt-2.5 p-3 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-between gap-3 shrink-0 animate-in fade-in duration-150">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                            <span className="truncate">{selectedPinCp.name}</span>
                            <span className="text-[10px] font-semibold text-blue-600 bg-blue-100/60 px-1.5 py-0.2 rounded-md shrink-0">
                              {selectedPinCp.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {selectedPinCp.description}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewQr(selectedPinCp)}
                          className="p-2 rounded-xl bg-white hover:bg-blue-100/60 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors cursor-pointer"
                          title="View QR Code sticker"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectCheckpoint(selectedPinCp)}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <span>Start Route</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Checkpoint Directory (List Mode) */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Search & Filter Bar */}
                  <div className="space-y-2 mb-3 shrink-0">
                    <div className="relative flex items-center">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={listSearch}
                        onChange={(e) => setListSearch(e.target.value)}
                        placeholder="Search checkpoint by name, ID (e.g. QR1, LC4)..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                      {listSearch && (
                        <button
                          type="button"
                          onClick={() => setListSearch('')}
                          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setListBuildingFilter('ALL')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            listBuildingFilter === 'ALL'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          All Buildings
                        </button>
                        {availableBuildings.map((bldg) => (
                          <button
                            key={bldg}
                            type="button"
                            onClick={() => setListBuildingFilter(bldg)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              listBuildingFilter === bldg
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            {bldg}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setListFloorFilter('ALL')}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                            listFloorFilter === 'ALL'
                              ? 'bg-slate-800 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          All Fl
                        </button>
                        {availableFloors.map((fl) => (
                          <button
                            key={fl}
                            type="button"
                            onClick={() => setListFloorFilter(fl)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                              listFloorFilter === fl
                                ? 'bg-slate-800 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            F{fl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Checkpoint Cards List */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {filteredListCheckpoints.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No checkpoints match your filter.
                      </div>
                    ) : (
                      filteredListCheckpoints.map((cp) => (
                        <div
                          key={cp.id}
                          className="w-full p-3 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 flex items-center justify-between text-left transition-all group bg-white shadow-2xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectCheckpoint(cp)}
                            className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer text-left"
                          >
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                                  {cp.id}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {cp.building_code} • Floor {cp.floor_number}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-slate-900 truncate">{cp.name}</div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">{cp.description}</div>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewQr(cp)}
                              title="View QR Code sticker"
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[11px] font-semibold flex items-center gap-1 border border-slate-200/80 transition-colors cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>QR</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectCheckpoint(cp)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                            >
                              <span>Start</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Fullscreen Floor Map Modal */}
      {isMapFullscreen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
          {/* Header */}
          <div className="p-4 flex items-center justify-between text-white shrink-0 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <Map className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {effectiveBuilding} Floor {effectiveFloor} Checkpoint Map
                </h3>
                <p className="text-[11px] text-slate-300">Pinch or scroll to zoom, tap any marker to select</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {availableBuildings.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextBldg = availableBuildings.find((b) => b !== effectiveBuilding) || availableBuildings[0];
                    setSelectedBuilding(nextBldg);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Switch Building
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMapFullscreen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                aria-label="Close Fullscreen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fullscreen Map Viewer */}
          <div className="flex-1 relative overflow-hidden bg-slate-900 flex items-center justify-center">
            {mapLoading || !svgContent ? (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-xs font-medium text-slate-400">Loading floor plan...</span>
              </div>
            ) : (
              <TransformWrapper
                initialScale={1.1}
                minScale={0.8}
                maxScale={5}
                centerOnInit={true}
                limitToBounds={false}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <div className="relative w-full h-full">
                    <TransformComponent
                      wrapperClass="!w-full !h-full flex items-center justify-center"
                      contentClass="!w-full !h-full flex items-center justify-center relative select-none"
                    >
                      <div className="relative w-full h-full flex items-center justify-center p-4">
                        <div
                          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-full"
                          dangerouslySetInnerHTML={{ __html: svgContent }}
                        />

                        <svg
                          viewBox={effectiveBuilding === 'LC4' ? '0 0 800 500' : '0 0 1000 650'}
                          preserveAspectRatio="xMidYMid meet"
                          className="absolute inset-0 w-full h-full pointer-events-none"
                        >
                          {currentFloorCheckpoints.map((cp, idx) => {
                            const isSelected = selectedPinCp?.id === cp.id;
                            const posX = cp.x ?? 200;
                            const posY = cp.y ?? 200;
                            const shortLabel = (cp.name || cp.id)
                              .split('-')[1] || cp.id;

                            return (
                              <g
                                key={cp.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPinCp(cp);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setIsMapFullscreen(false);
                                  handleSelectCheckpoint(cp);
                                }}
                                className="pointer-events-auto cursor-pointer group"
                                transform={`translate(${posX}, ${posY})`}
                              >
                                <circle
                                  r={isSelected ? '24' : '16'}
                                  fill={isSelected ? '#3B82F6' : '#64748B'}
                                  opacity={isSelected ? '0.35' : '0.2'}
                                  className={isSelected ? 'animate-ping' : ''}
                                />
                                <circle
                                  r={isSelected ? '13' : '10'}
                                  fill={isSelected ? '#2563EB' : '#3B82F6'}
                                  stroke="#FFFFFF"
                                  strokeWidth={isSelected ? '3' : '2'}
                                  className="transition-all drop-shadow-sm"
                                />
                                <text
                                  y="4"
                                  textAnchor="middle"
                                  fill="#FFFFFF"
                                  fontSize={isSelected ? '11' : '9'}
                                  fontWeight="bold"
                                  pointerEvents="none"
                                >
                                  {idx + 1}
                                </text>
                                <g transform="translate(0, -18)" className="pointer-events-none">
                                  <rect
                                    x={-Math.max(36, shortLabel.length * 4)}
                                    y="-16"
                                    width={Math.max(72, shortLabel.length * 8)}
                                    height="18"
                                    rx="9"
                                    fill={isSelected ? '#1E293B' : '#FFFFFF'}
                                    stroke={isSelected ? '#2563EB' : '#CBD5E1'}
                                    strokeWidth="1.2"
                                    className="drop-shadow-xs"
                                  />
                                  <text
                                    y="-4"
                                    textAnchor="middle"
                                    fill={isSelected ? '#FFFFFF' : '#334155'}
                                    fontSize="9"
                                    fontWeight="bold"
                                  >
                                    {shortLabel}
                                  </text>
                                </g>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </TransformComponent>

                    {/* Zoom Controls */}
                    <div className="absolute top-4 right-4 z-20 flex flex-col items-center bg-slate-800/90 backdrop-blur-md rounded-xl border border-white/10 p-1 gap-1">
                      <button
                        type="button"
                        onClick={() => zoomIn(0.3)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Zoom In"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => zoomOut(0.3)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Zoom Out"
                      >
                        <Minus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <div className="w-5 h-[1px] bg-white/20" />
                      <button
                        type="button"
                        onClick={() => resetTransform()}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Reset Zoom"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </TransformWrapper>
            )}
          </div>

          {/* Fullscreen Bottom Confirmation Bar */}
          {selectedPinCp && (
            <div className="p-4 bg-slate-900 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0 text-white">
                  <div className="text-xs font-bold truncate flex items-center gap-1.5">
                    <span className="truncate">{selectedPinCp.name}</span>
                    <span className="text-[10px] font-semibold text-blue-300 bg-blue-900/60 px-1.5 py-0.2 rounded-md shrink-0">
                      {selectedPinCp.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {selectedPinCp.description}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMapFullscreen(false)}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Back to Scanner
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMapFullscreen(false);
                    handleSelectCheckpoint(selectedPinCp);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <span>Select Point</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QR Code Preview & Sticker Modal */}
      {previewQr && (
        <div className="fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setPreviewQr(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 mb-2">
              <QrCode className="w-5 h-5" />
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-0.5">{previewQr.name}</h3>
            <p className="text-xs text-slate-500 mb-3">{previewQr.description}</p>

            {/* Generated QR Code Image with CloudFront Deep Link */}
            <div className="mx-auto w-48 h-48 p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shadow-inner mb-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                  `https://d2k1h3uc8pux1o.cloudfront.net/navigation?start=${previewQr.id}`
                )}`}
                alt={`QR Code for ${previewQr.name}`}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            {/* Canonical Info Badges */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
              <div className="text-[11px] font-mono text-blue-700 bg-blue-50 border border-blue-200/60 py-0.5 px-2 rounded-lg">
                ID: <span className="font-bold">{previewQr.id}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-600 bg-slate-100 py-0.5 px-2 rounded-lg">
                Node: <span className="font-bold">{previewQr.node_id}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-600 bg-slate-100 py-0.5 px-2 rounded-lg">
                {previewQr.building_code} • Floor {previewQr.floor_number}
              </div>
            </div>

            {/* Deep Link URL Copy Box */}
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200 mb-4 text-left">
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Deep Link URL</div>
                <div className="text-[11px] font-mono text-slate-700 truncate">
                  {`https://d2k1h3uc8pux1o.cloudfront.net/navigation?start=${previewQr.id}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyDeepLink(previewQr)}
                className="px-2 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
                  `https://d2k1h3uc8pux1o.cloudfront.net/navigation?start=${previewQr.id}`
                )}`}
                target="_blank"
                rel="noreferrer"
                download={`qr-${previewQr.id}.png`}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save PNG</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  const target = previewQr;
                  setPreviewQr(null);
                  handleSelectCheckpoint(target);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Use Point</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
