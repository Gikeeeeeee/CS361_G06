import { useState, useRef, useEffect } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { SearchBar } from './SearchBar';
import { SearchResultsDropdown } from './SearchResultsDropdown';
import type { SearchResultItem } from '../types';

interface SearchContainerProps {
  onFocusChange?: (isFocused: boolean) => void;
}

export function SearchContainer({ onFocusChange }: SearchContainerProps) {
  const navigate = useNavigate();
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearSearch,
    forceSearch,
    debouncedQuery
  } = useSearchQuery();

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onFocusChange?.(isFocused || query.length > 0);
  }, [isFocused, query, onFocusChange]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false);
    inputRef.current?.blur();
    
    switch (item.type) {
      case 'BUILDING':
        navigate(`/buildings/${item.id}`);
        break;
      case 'ROOM':
        navigate(`/rooms/${item.id}`);
        break;
      case 'COURSE':
      case 'EXAM':
      case 'ACTIVITY':
        if (item.room_id) {
          navigate(`/rooms/${item.room_id}`);
        }
        break;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    forceSearch(query);
    if (!isOpen && query.trim().length >= 2) {
      setIsOpen(true);
    }
    inputRef.current?.blur();
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (query.length >= 2) {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <div 
      ref={wrapperRef} 
      className="absolute top-3 left-4 right-4 z-50 flex flex-col max-w-md mx-auto pointer-events-none"
    >
      <div className="relative">
        <SearchBar
          query={query}
          onChange={(q) => {
            setQuery(q);
            if (!isOpen) setIsOpen(true);
            setActiveIndex(-1);
          }}
          onSubmit={handleSubmit}
          onClear={() => {
            clearSearch();
            setIsOpen(false);
            setActiveIndex(-1);
            inputRef.current?.focus();
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          isLoading={isLoading}
          isOpen={isOpen}
          inputRef={inputRef}
          onKeyDown={handleKeyDown}
        />
        
        {isOpen && query.trim().length >= 2 && (
          <SearchResultsDropdown
            debouncedQuery={debouncedQuery}
            results={results}
            isLoading={isLoading}
            error={error}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            onSelect={handleSelect}
          />
        )}
      </div>
    </div>
  );
}
