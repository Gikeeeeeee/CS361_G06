import type { ICampusService } from './campus.interface';
import { CampusApiService } from './campus.api';
import { CampusMockService } from '../mocks/campus.mock';

const USE_MOCK = true; // Toggle this to switch between real API and mock data

export const campusService: ICampusService = USE_MOCK 
  ? new CampusMockService() 
  : new CampusApiService();
