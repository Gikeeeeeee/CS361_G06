import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, QrCode, Camera, Flashlight, MapPin, CheckCircle2, Download, Map, List, ArrowRight, Loader2 } from 'lucide-react';
import { DEFAULT_CHECKPOINTS, navigationApi } from '../services/navigationApi';
import type { QRCheckpoint } from '../types/navigation.types';
import { campusService } from '../../campus-explorer/services';
import { useSvgFloorPlan } from '../../campus-explorer/components/floor-viewer/hooks/useSvgFloorPlan';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (checkpoint: QRCheckpoint) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [detectedValue, setDetectedValue] = useState<string | null>(null);
  const [previewQr, setPreviewQr] = useState<QRCheckpoint | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Visual Floor Map Checkpoint Guide State
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedBuilding, setSelectedBuilding] = useState<'LC4' | 'LC3'>('LC4');
  const [activeFloorSvgUrl, setActiveFloorSvgUrl] = useState<string | undefined>(undefined);
  const [selectedPinCp, setSelectedPinCp] = useState<QRCheckpoint | null>(DEFAULT_CHECKPOINTS[0]);

  // Load building floor plan dynamically
  useEffect(() => {
    let isMounted = true;
    const targetFloorId =
      selectedBuilding === 'LC4'
        ? 'a6ab42cb-0abd-57ee-acd2-993d64b20a82'
        : 'deaef033-ba6c-5c0e-bb50-956202b57947';

    campusService
      .getFloorById(targetFloorId)
      .then((floor) => {
        if (!isMounted) return;
        const url = (floor as any)?.floor_plan?.url || (floor as any)?.map?.url;
        if (url) setActiveFloorSvgUrl(url);
      })
      .catch(() => {});

    const firstInBldg = DEFAULT_CHECKPOINTS.find((c) => c.building_code === selectedBuilding);
    if (firstInBldg) setSelectedPinCp(firstInBldg);

    return () => {
      isMounted = false;
    };
  }, [selectedBuilding]);

  const { svgContent, loading: mapLoading } = useSvgFloorPlan(activeFloorSvgUrl);

  const buildingCheckpoints = useMemo(() => {
    return DEFAULT_CHECKPOINTS.filter((cp) => cp.building_code === selectedBuilding);
  }, [selectedBuilding]);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setDetectedValue(null);
      return;
    }

    let activeStream: MediaStream | null = null;
    let animId: number | null = null;
    let isDetecting = true;

    async function startCamera() {
      try {
        setCameraError(null);
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Camera not available on this browser');
          return;
        }

        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });

        activeStream = media;
        streamRef.current = media;
        setStream(media);

        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play();
        }

        // Check torch support
        const track = media.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
        if (capabilities.torch) {
          setHasTorch(true);
        }

        // Live BarcodeDetector real-time frame scanning loop
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const checkFrame = async () => {
              if (!isDetecting || !videoRef.current) return;
              try {
                if (videoRef.current.readyState >= 2) {
                  const codes = await detector.detect(videoRef.current);
                  if (codes && codes.length > 0 && codes[0].rawValue) {
                    const raw = codes[0].rawValue;
                    isDetecting = false;
                    setDetectedValue(raw);

                    // Haptic feedback if supported
                    if (navigator.vibrate) {
                      try {
                        navigator.vibrate(80);
                      } catch {
                        // ignore vibration errors
                      }
                    }

                    setTimeout(() => {
                      const resolved = navigationApi.resolveCheckpoint(raw);
                      onScanSuccess(resolved);
                    }, 400);
                    return;
                  }
                }
              } catch {
                // Frame skip / decoding noise
              }
              animId = requestAnimationFrame(checkFrame);
            };
            animId = requestAnimationFrame(checkFrame);
          } catch {
            // BarcodeDetector setup fallback
          }
        }
      } catch {
        setCameraError('Cannot access camera. You can select a checkpoint manually below.');
      }
    }

    startCamera();

    return () => {
      isDetecting = false;
      if (animId) cancelAnimationFrame(animId);
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, onScanSuccess]);

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch {
      // Torch failed
    }
  };

  const handleSelectCheckpoint = (checkpoint: QRCheckpoint) => {
    onScanSuccess(checkpoint);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex flex-col justify-between animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="p-4 pt-6 flex items-center justify-between text-white z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <QrCode className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Scan Checkpoint QR</h2>
            <p className="text-[11px] text-slate-300">Scan QR code at elevators, stairs, or hallway signs</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Center Viewfinder */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6">
        <div
          className={`relative w-64 h-64 rounded-3xl overflow-hidden border-2 transition-colors duration-300 shadow-[0_0_40px_rgba(37,99,235,0.3)] bg-slate-900 flex items-center justify-center ${
            detectedValue ? 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.5)]' : 'border-blue-500'
          }`}
        >
          {stream ? (
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
              <Camera className="w-10 h-10 stroke-[1.5] text-slate-500 mb-2" />
              <p className="text-xs text-slate-400">
                {cameraError || 'Align QR code inside this frame'}
              </p>
            </div>
          )}

          {/* Success Overlay when detected */}
          {detectedValue && (
            <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20 animate-in fade-in duration-150">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
              <div className="text-xs font-bold text-emerald-300">QR Code Detected!</div>
              <div className="text-[11px] text-emerald-100 font-mono mt-0.5">{detectedValue}</div>
            </div>
          )}

          {/* Target Corners */}
          <div
            className={`absolute top-3 left-3 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : 'border-blue-500'
            }`}
          />
          <div
            className={`absolute top-3 right-3 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : 'border-blue-500'
            }`}
          />
          <div
            className={`absolute bottom-3 left-3 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : 'border-blue-500'
            }`}
          />
          <div
            className={`absolute bottom-3 right-3 w-6 h-6 border-b-4 border-r-4 rounded-br-lg pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : 'border-blue-500'
            }`}
          />

          {/* Scanning Animation Bar */}
          {!detectedValue && (
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_#3b82f6] animate-pulse pointer-events-none" />
          )}
        </div>

        {/* Torch Button if supported */}
        {hasTorch && (
          <button
            onClick={toggleTorch}
            className={`mt-4 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
              torchOn
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Flashlight className="w-4 h-4" />
            <span>{torchOn ? 'Flashlight On' : 'Turn on Flashlight'}</span>
          </button>
        )}
      </div>

      {/* Manual Checkpoint Selector & Floor Map Guide */}
      <div className="bg-white rounded-t-3xl p-5 pb-6 text-slate-900 shadow-2xl z-10 max-h-[62vh] flex flex-col overflow-hidden">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3 shrink-0" />

        {/* Tab & Mode Switcher */}
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {viewMode === 'map' ? 'Floor Map Checkpoint Guide' : 'Select Checkpoint'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {viewMode === 'map'
                ? 'Tap any checkpoint on the floor map to start'
                : 'Choose a checkpoint or view test QR sticker'}
            </p>
          </div>

          {/* Segmented Mode Button */}
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
              <span>Map Guide</span>
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
              <span>List</span>
            </button>
          </div>
        </div>

        {viewMode === 'map' ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Building Selector Pills */}
            <div className="flex items-center gap-2 mb-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedBuilding('LC4')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedBuilding === 'LC4'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/70 text-slate-700'
                }`}
              >
                <span>LC4 Building (Floor 1)</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedBuilding === 'LC4' ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  3 Points
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedBuilding('LC3')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedBuilding === 'LC3'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/70 text-slate-700'
                }`}
              >
                <span>LC3 Building (Floor 1)</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedBuilding === 'LC3' ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  2 Points
                </span>
              </button>
            </div>

            {/* Interactive SVG Floor Map with Checkpoint Pins */}
            <div className="relative w-full h-52 sm:h-60 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              {mapLoading || !svgContent ? (
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs font-medium text-slate-500">
                    Loading {selectedBuilding} floor map...
                  </span>
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Base Floor Plan SVG */}
                  <div
                    className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-full"
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                  />

                  {/* Checkpoint Coordinates Marker Layer */}
                  <svg
                    viewBox={selectedBuilding === 'LC4' ? '0 0 800 500' : '0 0 1000 650'}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  >
                    {buildingCheckpoints.map((cp, idx) => {
                      const isSelected = selectedPinCp?.id === cp.id;
                      const posX = cp.x ?? 200;
                      const posY = cp.y ?? 200;
                      const shortLabel = cp.name
                        .split('(')[0]
                        .replace(/^(LC3|LC4)\s*/, '')
                        .trim();

                      return (
                        <g
                          key={cp.id}
                          onClick={() => setSelectedPinCp(cp)}
                          onDoubleClick={() => handleSelectCheckpoint(cp)}
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
              )}
            </div>

            {/* Selected Checkpoint Detail & Confirmation Card */}
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
                        {selectedPinCp.node_id}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {selectedPinCp.description}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectCheckpoint(selectedPinCp)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer"
                >
                  <span>Select Point</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* List Mode */
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {DEFAULT_CHECKPOINTS.map((cp) => (
              <div
                key={cp.id}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-between text-left transition-all group"
              >
                <button
                  type="button"
                  onClick={() => handleSelectCheckpoint(cp)}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 truncate">{cp.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{cp.description}</div>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewQr(cp)}
                    title="View printable QR code for testing"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>View QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectCheckpoint(cp)}
                    className="p-1.5 rounded-lg text-slate-400 group-hover:text-blue-600 transition-colors"
                    aria-label="Select"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Preview & Generator Modal */}
      {previewQr && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative">
            <button
              onClick={() => setPreviewQr(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 mb-3">
              <QrCode className="w-5 h-5" />
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-1">{previewQr.name}</h3>
            <p className="text-xs text-slate-500 mb-4">{previewQr.description}</p>

            {/* Generated QR Code Image */}
            <div className="mx-auto w-48 h-48 p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shadow-inner mb-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                  previewQr.node_id
                )}`}
                alt={`QR Code for ${previewQr.name}`}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            <div className="text-[11px] font-mono text-slate-500 bg-slate-100 py-1 px-2.5 rounded-lg inline-block mb-4">
              Payload: <span className="font-bold text-slate-800">{previewQr.node_id}</span>
            </div>

            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
              Scan with another phone to test camera detection, or print this QR sticker for physical building checkpoints.
            </p>

            <div className="flex gap-2">
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
                  previewQr.node_id
                )}`}
                target="_blank"
                rel="noreferrer"
                download={`qr-${previewQr.node_id}.png`}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
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
                <span>Select Checkpoint</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

