import { Search, X, Loader2 } from 'lucide-react';
import type { FormEvent, KeyboardEvent, RefObject } from 'react';

interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClear: () => void;
  onFocus: () => void;
  onBlur: () => void;
  isLoading: boolean;
  isOpen: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function SearchBar({
  query,
  onChange,
  onSubmit,
  onClear,
  onFocus,
  onBlur,
  isLoading,
  isOpen,
  inputRef,
  onKeyDown
}: SearchBarProps) {
  return (
    <form 
      onSubmit={onSubmit}
      className="relative flex items-center bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm px-3.5 py-2.5 z-10 transition-shadow focus-within:shadow-md focus-within:border-blue-300 pointer-events-auto"
    >
      <Search className="w-5 h-5 text-slate-400 mr-2.5 flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls="search-results-listbox"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder="Search buildings, rooms, courses..."
        className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
      />
      {isLoading && (
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-10" />
      )}
      {query && (
        <button
          type="button"
          onClick={onClear}
          className="p-1 rounded-full hover:bg-slate-100 text-slate-400 ml-1 transition-colors flex-shrink-0 focus:outline-none"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </form>
  );
}
