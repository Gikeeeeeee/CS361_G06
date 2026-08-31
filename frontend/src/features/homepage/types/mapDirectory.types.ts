import type { Building } from '../../../shared/types/domain.types';

export interface CampusBuilding extends Building {
  lat: number;
  lng: number;
}

export type BottomSheetState = 'peek' | 'half' | 'expanded';

export type CategoryFilter = 'All' | 'Lecture' | 'Science' | 'Labs' | 'Offices';
