import type { ICampusService } from './campus.interface';
import { CampusApiService } from './campus.api';

export const campusService: ICampusService = new CampusApiService();