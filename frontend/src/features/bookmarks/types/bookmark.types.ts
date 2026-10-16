export type BookmarkEntityType = 'ROOM' | 'SCHEDULE';

export interface BookmarkItem {
  id: string;
  entityId: string;
  entityType: BookmarkEntityType;
  title: string;
  subtitle?: string;
  building?: string;
  floor?: number | string;
  courseCode?: string;
  startAt?: string;
  endAt?: string;
  roomName?: string;
  savedAt: string;
}

export interface BookmarkState {
  bookmarks: BookmarkItem[];
  isLoading: boolean;
}
