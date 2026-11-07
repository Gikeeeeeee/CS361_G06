import React from 'react';
import { QrCode } from 'lucide-react';

interface FloatingQrScanButtonProps {
  onClick: () => void;
  className?: string;
}

export const FloatingQrScanButton: React.FC<FloatingQrScanButtonProps> = ({
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`fixed top-3.5 right-14 z-50 w-9 h-9 rounded-full bg-white/90 hover:bg-white active:scale-95 text-slate-700 hover:text-blue-600 border border-slate-200/80 shadow-md backdrop-blur-md flex items-center justify-center transition-all cursor-pointer ${className}`}
      title="Scan QR Code Checkpoint to Navigate"
      aria-label="Scan QR Code to navigate"
    >
      <QrCode className="w-4 h-4 stroke-[2.2]" />
    </button>
  );
};
