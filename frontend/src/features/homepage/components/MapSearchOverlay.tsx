import { Search, X } from 'lucide-react';
import type { CategoryFilter } from '../types/mapDirectory.types';

interface MapSearchOverlayProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
}

const CATEGORIES: CategoryFilter[] = ['All', 'Lecture', 'Science', 'Labs', 'Offices'];

export function MapSearchOverlay({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
}: MapSearchOverlayProps) {
  return (
    <div className="absolute top-3 left-4 right-4 z-20 flex flex-col gap-3 max-w-md mx-auto pointer-events-none">
      {/* Search Input Box */}
      <div className="relative w-full pointer-events-auto bg-white/90 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex items-center px-4 py-3">
        <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0 animate-pulse" />
        <input
          type="text"
          placeholder="Search campus buildings..."
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
          }}
          className="w-full bg-transparent border-none text-slate-800 text-sm font-semibold focus:outline-none placeholder-slate-400"
        />
        {searchQuery && (
          <button 
            onClick={() => onSearchChange('')}
            className="p-1 rounded-full hover:bg-slate-100 transition-colors text-slate-400 flex items-center justify-center flex-shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Horizontal Scroll Filter Chips */}
      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar snap-x pointer-events-auto">
        {CATEGORIES.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => {
                onCategoryChange(category);
              }}
              className={`snap-start flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-all duration-300 shadow-sm cursor-pointer ${
                isActive
                  ? 'bg-primary border-primary text-white shadow-primary-100'
                  : 'bg-white/80 backdrop-blur-md border-slate-100 text-slate-500 hover:bg-white'
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
}
