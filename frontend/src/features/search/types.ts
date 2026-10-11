export interface SearchResultItem {
  id: string;
  type: 'BUILDING' | 'ROOM' | 'COURSE' | 'EXAM' | 'ACTIVITY';
  
  // Building & Room specific
  code?: string;
  room_number?: string;
  name?: { th: string; en: string } | string;

  // Course, Exam, Activity specific
  title?: string;
  subtitle?: string | null;
  course_code?: string | null;
  room_id?: string;
  building_id?: string;

  // API response fields
  name_th?: string | null;
  name_en?: string | null;
  description?: string | null;
  building_code?: string | null;
  room_code?: string | null;
}
