import React from 'react';

interface PaginationBarProps {
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  isLoading = false,
}) => {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
      <div className="text-sm font-medium text-slate-600">
        Page {currentPage}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onPrev}
          disabled={!hasPrev || isLoading}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext || isLoading}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
        >
          Next
        </button>
      </div>
    </div>
  );
};
