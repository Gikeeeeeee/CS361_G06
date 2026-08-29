import { useState, useMemo } from 'react';
import { campusBuildingsMock } from '../../../data';
import type { CategoryFilter } from '../types/mapDirectory.types';

export function useMapFilter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');

  const filteredBuildings = useMemo(() => {
    return campusBuildingsMock.filter((building) => {
      // 1. Search Query Match
      const matchesSearch = 
        building.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        building.code.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // 2. Category Match
      if (selectedCategory === 'All') return true;
      if (selectedCategory === 'Lecture') return building.code.startsWith('LC');
      if (selectedCategory === 'Science') return building.code.startsWith('SC');
      if (selectedCategory === 'Labs') return building.stats.availableFacilities.includes('LAB');
      if (selectedCategory === 'Offices') return building.stats.availableFacilities.includes('OFFICE');

      return true;
    });
  }, [searchQuery, selectedCategory]);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    filteredBuildings
  };
}
