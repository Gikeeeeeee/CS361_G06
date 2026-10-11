import type { SearchResultItem } from '../types';

export const fetchSearchResults = async (
  query: string,
  signal?: AbortSignal
): Promise<SearchResultItem[]> => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const response = await fetch(`${baseUrl}/api/v1/search?q=${encodeURIComponent(query)}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch search results');
  }

  const data = await response.json();
  return data.results || data.data || [];
};
