import React from 'react';

interface BuildingViewToggleProps {
  viewMode: 'list' | 'map';
  onChange: (mode: 'list' | 'map') => void;
}

export const BuildingViewToggle: React.FC<BuildingViewToggleProps> = ({
  viewMode,
  onChange,
}) => {
  return (
    <div className="px-4 mt-4">
      <div className="bg-slate-100/90 p-1 rounded-full flex gap-1 border border-slate-200/50 shadow-inner">
        <button
          type="button"
          onClick={() => onChange('list')}
          className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
            viewMode === 'list'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-transparent'
          }`}
        >
          List View
        </button>
        <button
          type="button"
          onClick={() => onChange('map')}
          className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
            viewMode === 'map'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-transparent'
          }`}
        >
          Map View
        </button>
      </div>
    </div>
  );
};
