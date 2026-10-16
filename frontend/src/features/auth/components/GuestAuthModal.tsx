import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Lock, X } from 'lucide-react';

interface GuestAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export const GuestAuthModal: React.FC<GuestAuthModalProps> = ({
  isOpen,
  onClose,
  title = 'Sign in to save items',
  subtitle = 'Bookmark your favorite classrooms, lecture schedules, and export to personal calendar (.ics).',
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card / Bottom Sheet */}
      <div className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 border-4 border-blue-100/60 flex items-center justify-center text-blue-600 mb-4 relative">
          <Bookmark className="w-7 h-7 fill-blue-600/20" />
          <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">{subtitle}</p>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            onClick={() => {
              onClose();
              navigate('/login');
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/25 transition-all"
          >
            Sign In
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};
