import { useState, useEffect, useMemo } from 'react';
import { buildingService } from '../../../services/buildingService';
import type { BuildingItem } from '../../../shared/types/api.contracts';
import type { CategoryFilter } from '../types/mapDirectory.types';

export function useMapFilter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [buildings, setBuildings] = useState<BuildingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    buildingService.getBuildings().then(data => {
      if (isMounted) {
        setBuildings(data);
        setIsLoading(false);
      }
    }).catch(err => {
      console.error('Failed to fetch buildings:', err);
      if (isMounted) setIsLoading(false);
    });
    return () => { isMounted = false; };
  }, []);

  const filteredBuildings = useMemo(() => {
    return buildings.filter((building) => {
      // 1. Search Query Match
      const matchesSearch = 
        building.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        building.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // 2. Category Match
      if (selectedCategory === 'All') return true;
      if (selectedCategory === 'Lecture') return building.id.startsWith('lc');
      if (selectedCategory === 'Science') return building.id.startsWith('sc');
      // For Labs and Offices, since we don't have stats in BuildingItem, we bypass or mock for now
      if (selectedCategory === 'Labs') return building.id.startsWith('sc');
      if (selectedCategory === 'Offices') return true;

      return true;
    });
  }, [buildings, searchQuery, selectedCategory]);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    filteredBuildings,
    isLoading
  };
}
