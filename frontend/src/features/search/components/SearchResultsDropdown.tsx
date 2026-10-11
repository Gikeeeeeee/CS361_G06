import { Loader2, AlertCircle, Search } from 'lucide-react';
import type { SearchResultItem as SearchResultItemType } from '../types';
import { SearchResultItem } from './SearchResultItem';

interface SearchResultsDropdownProps {
  debouncedQuery: string;
  results: SearchResultItemType[];
  isLoading: boolean;
  error: string | null;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onSelect: (item: SearchResultItemType) => void;
}

export function SearchResultsDropdown({
  debouncedQuery,
  results,
  isLoading,
  error,
  activeIndex,
  setActiveIndex,
  onSelect,
}: SearchResultsDropdownProps) {
  if (error) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden pointer-events-auto z-50">
        <div className="p-4 flex items-center gap-3 text-red-600 bg-red-50/50">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </div>
    );
  }

  if (isLoading && results.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden pointer-events-auto z-50">
        <div className="p-6 flex flex-col items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-sm">Searching campus...</span>
        </div>
      </div>
    );
  }

  if (results.length > 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden pointer-events-auto z-50">
        <div 
          id="search-results-listbox"
          role="listbox"
          className="max-h-[60vh] overflow-y-auto overscroll-contain py-2 divide-y divide-slate-50"
        >
          {results.map((item, index) => (
            <SearchResultItem
              key={item.id}
              item={item}
              isSelected={index === activeIndex}
              highlightQuery={debouncedQuery}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onSelect(item)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!isLoading && debouncedQuery.length >= 2) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden pointer-events-auto z-50">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No results found for "{debouncedQuery}"</p>
          <p className="text-xs text-slate-500 mt-1">Try checking the spelling or search by room code.</p>
        </div>
      </div>
    );
  }

  return null;
}
