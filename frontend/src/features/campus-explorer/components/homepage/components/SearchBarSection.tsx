import { Search } from 'lucide-react';
import type { RoomCategory } from '../types/directory.types';

interface SearchBarSectionProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: RoomCategory;
  setSelectedCategory: (cat: RoomCategory) => void;
}

const CATEGORIES: RoomCategory[] = ['All', 'Classrooms', 'Labs', 'Offices'];

export default function SearchBarSection({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
}: SearchBarSectionProps) {
  return (
    <div className="absolute top-4 left-0 right-0 z-10 px-4 space-y-3 pointer-events-auto">
      {/* Search Input */}
      <div className="relative flex items-center bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm px-3.5 py-2.5">
        <Search className="w-5 h-5 text-slate-400 mr-2.5 flex-shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search rooms..."
          className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>

      {/* Category Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'bg-white/90 backdrop-blur-md text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}