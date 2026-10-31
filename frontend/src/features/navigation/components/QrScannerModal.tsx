import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, Camera, Flashlight, MapPin, CheckCircle2 } from 'lucide-react';
import { DEFAULT_CHECKPOINTS } from '../services/navigationApi';
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    let activeStream: MediaStream | null = null;

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
      } catch (_err) {
        setCameraError('Cannot access camera. You can select a checkpoint manually below.');
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

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
        <div className="relative w-64 h-64 rounded-3xl overflow-hidden border-2 border-blue-500 shadow-[0_0_40px_rgba(37,99,235,0.3)] bg-slate-900 flex items-center justify-center">
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

          {/* Target Corners */}
          <div className="absolute top-3 left-3 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg pointer-events-none" />
          <div className="absolute top-3 right-3 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg pointer-events-none" />

          {/* Scanning Animation Bar */}
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_#3b82f6] animate-pulse pointer-events-none" />
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

      {/* Manual Checkpoint Selector (Desktop & Simulation Friendly) */}
      <div className="bg-white rounded-t-3xl p-5 pb-6 text-slate-900 shadow-2xl z-10 max-h-[45vh] overflow-y-auto">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select Checkpoint or Simulated QR
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Quick Anchor</span>
        </div>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          Select a physical location where you are currently standing:
        </p>

        <div className="space-y-2">
          {DEFAULT_CHECKPOINTS.map((cp) => (
            <button
              key={cp.id}
              onClick={() => handleSelectCheckpoint(cp)}
              className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-between text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{cp.name}</div>
                  <div className="text-[11px] text-slate-500">{cp.description}</div>
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
