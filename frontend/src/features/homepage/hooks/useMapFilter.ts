import { useState, useEffect, useMemo } from 'react';
import { campusService } from '../../../services';
import type { Building } from '../../../shared/types/domain.types';
import type { CategoryFilter } from '../types/mapDirectory.types';

export function useMapFilter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    campusService.getBuildings().then(data => {
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
        building.name.th.toLowerCase().includes(searchQuery.toLowerCase()) ||
        building.name.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
