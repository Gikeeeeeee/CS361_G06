import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchResultItem } from '../types';
import { fetchSearchResults } from '../services/searchApi';

const searchCache = new Map<string, SearchResultItem[]>();

export function useSearchQuery() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-debounce as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const executeSearch = useCallback(async (searchTerm: string) => {
    const q = searchTerm.trim();
    
    if (q.length < 2) {
      setResults([]);
      return;
    }

    if (searchCache.has(q)) {
      setResults(searchCache.get(q)!);
      return;
    }

    setIsLoading(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const fetchedResults = await fetchSearchResults(q, abortControllerRef.current.signal);
      
      searchCache.set(q, fetchedResults);
      if (searchCache.size > 50) {
        const firstKey = searchCache.keys().next().value;
        if (firstKey) searchCache.delete(firstKey);
      }

      setResults(fetchedResults);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('An error occurred while searching.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger search when debounced query changes
  useEffect(() => {
    executeSearch(debouncedQuery);
  }, [debouncedQuery, executeSearch]);

  const forceSearch = (forceQuery: string) => {
    setDebouncedQuery(forceQuery.trim());
  };

  const clearSearch = () => {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearSearch,
    forceSearch,
    debouncedQuery,
  };
}
