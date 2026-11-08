import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  QrCode,
  Camera,
  Flashlight,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import jsQR from 'jsqr';
import { navigationApi } from '../services/navigationApi';
import type { QRCheckpoint } from '../types/navigation.types';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onScanSuccessRef = useRef(onScanSuccess);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [detectedValue, setDetectedValue] = useState<string | null>(null);
  const [invalidCodeError, setInvalidCodeError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  // Preload dynamic checkpoints strictly from Backend API on open
  const loadCheckpoints = useCallback(() => {
    navigationApi.getCheckpointsAsync().catch((err: any) => {
      console.warn('Checkpoints preload warning:', err?.message || err);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadCheckpoints();
    }
  }, [isOpen, loadCheckpoints]);

  // Camera & QR Scanning Lifecycle
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoEl) {
        videoEl.srcObject = null;
      }
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
      setInvalidCodeError(null);

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

        if (videoEl) {
          videoEl.srcObject = mediaStream;
          videoEl.setAttribute('playsinline', 'true');
          try {
            await videoEl.play();
          } catch {
            // Autoplay catch
          }
        }

        setIsLoadingCamera(false);

        // Continuous QR frame analyzer using jsQR
        const scanFrame = () => {
          if (!isScanning || isCancelled) return;

          const video = videoEl;
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
                    // Validate against actual Backend-provided canonical checkpoint data
                    const resolved = navigationApi.resolveCheckpoint(qrCodeText);
                    if (!resolved) {
                      // Unknown QR code: reject strictly without guessing
                      setInvalidCodeError(`Unrecognized QR code: "${qrCodeText.length > 28 ? qrCodeText.slice(0, 28) + '...' : qrCodeText}". Checkpoint not found.`);
                      setTimeout(() => {
                        if (!isCancelled) {
                          setInvalidCodeError(null);
                        }
                      }, 3000);
                    } else {
                      // Recognized valid checkpoint
                      isScanning = false;
                      setDetectedValue(resolved.name || resolved.id);
                      setInvalidCodeError(null);

                      if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        try {
                          navigator.vibrate(100);
                        } catch {
                          // Ignore vibration failure
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
      if (videoEl) {
        videoEl.srcObject = null;
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
      // Torch toggle not supported
    }
  };

  const handleRetryCamera = () => {
    setCameraError(null);
    setInvalidCodeError(null);
    setRetryTrigger((prev) => prev + 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200 select-none">
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
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div
          className={`relative rounded-3xl overflow-hidden transition-all duration-300 shadow-2xl bg-black flex items-center justify-center w-72 h-72 sm:w-80 sm:h-80 ${
            detectedValue
              ? 'border-2 border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.4)]'
              : cameraError || invalidCodeError
              ? 'border-2 border-rose-500/80 shadow-[0_0_35px_rgba(244,63,94,0.3)]'
              : 'border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.7)]'
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
                  <p className="text-[11px] text-slate-300 max-w-[220px] leading-relaxed mb-3">
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

          {/* Real-time Invalid QR Notice Overlay */}
          {invalidCodeError && !detectedValue && (
            <div className="absolute inset-x-3 bottom-3 bg-rose-950/85 border border-rose-500/60 rounded-2xl p-2.5 flex items-center gap-2 text-rose-200 z-20 backdrop-blur-md animate-in slide-in-from-bottom duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <p className="text-[11px] font-medium leading-tight">{invalidCodeError}</p>
            </div>
          )}

          {/* Success Overlay when detected */}
          {detectedValue && (
            <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20 animate-in fade-in duration-150">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
              <div className="text-xs font-bold text-emerald-300">Checkpoint Detected!</div>
              <div className="text-[11px] text-emerald-100 font-mono mt-0.5 max-w-[200px] truncate">{detectedValue}</div>
            </div>
          )}

          {/* Viewfinder Reticle Corners */}
          <div
            className={`absolute top-3 left-3 w-7 h-7 border-t-3 border-l-3 rounded-tl-xl pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : invalidCodeError ? 'border-rose-400' : 'border-blue-500'
            }`}
          />
          <div
            className={`absolute top-3 right-3 w-7 h-7 border-t-3 border-r-3 rounded-tr-xl pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : invalidCodeError ? 'border-rose-400' : 'border-blue-500'
            }`}
          />
          <div
            className={`absolute bottom-3 left-3 w-7 h-7 border-b-3 border-l-3 rounded-bl-xl pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : invalidCodeError ? 'border-rose-400' : 'border-blue-500'
            }`}
          />
          <div
            className={`absolute bottom-3 right-3 w-7 h-7 border-b-3 border-r-3 rounded-br-xl pointer-events-none transition-colors ${
              detectedValue ? 'border-emerald-400' : invalidCodeError ? 'border-rose-400' : 'border-blue-500'
            }`}
          />

          {/* Subtle Laser Sweep Indicator */}
          {!detectedValue && stream && !cameraError && (
            <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse pointer-events-none" />
          )}
        </div>

        {/* Viewfinder Status / Torch Control */}
        <div className="flex items-center gap-2 mt-4">
          <div className="px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 backdrop-blur-md text-[11px] font-medium text-slate-300 flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Align QR code within the frame</span>
          </div>

          {hasTorch && stream && !cameraError && (
            <button
              onClick={toggleTorch}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
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

      {/* Bottom Padding for visual symmetry */}
      <div className="p-4 shrink-0" />
    </div>
  );
};
