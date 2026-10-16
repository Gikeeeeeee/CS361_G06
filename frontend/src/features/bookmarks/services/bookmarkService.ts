import type { BookmarkItem, BookmarkEntityType } from '../types/bookmark.types';

const BOOKMARK_STORAGE_KEY_PREFIX = 'ku_long_bookmarks_';

// Initial pre-seeded mock bookmarks matching Figma Timetable design
const INITIAL_DEMO_BOOKMARKS: BookmarkItem[] = [
  {
    id: 'bm-sched-CS361',
    entityId: 'sched-CS361',
    entityType: 'SCHEDULE',
    title: 'Software Architecture',
    subtitle: 'Mon 09:00 - 12:00',
    courseCode: 'CS361',
    building: 'LC4',
    roomName: 'LC4-210',
    startAt: '2026-09-14T09:00:00+07:00',
    endAt: '2026-09-14T12:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS366',
    entityId: 'sched-CS366',
    entityType: 'SCHEDULE',
    title: 'Software Testing & QA',
    subtitle: 'Mon 13:00 - 15:00',
    courseCode: 'CS366',
    building: 'LC4',
    roomName: 'LC4-210',
    startAt: '2026-09-14T13:00:00+07:00',
    endAt: '2026-09-14T15:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS371',
    entityId: 'sched-CS371',
    entityType: 'SCHEDULE',
    title: 'Mobile Application Development',
    subtitle: 'Mon 15:00 - 17:00',
    courseCode: 'CS371',
    building: 'LC4',
    roomName: 'LC4-215',
    startAt: '2026-09-14T15:00:00+07:00',
    endAt: '2026-09-14T17:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS367',
    entityId: 'sched-CS367',
    entityType: 'SCHEDULE',
    title: 'Artificial Intelligence',
    subtitle: 'Tue 09:00 - 11:00',
    courseCode: 'CS367',
    building: 'LC4',
    roomName: 'LC4-205',
    startAt: '2026-09-15T09:00:00+07:00',
    endAt: '2026-09-15T11:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS362',
    entityId: 'sched-CS362',
    entityType: 'SCHEDULE',
    title: 'Human-Computer Interaction',
    subtitle: 'Tue 13:00 - 15:00',
    courseCode: 'CS362',
    building: 'LC4',
    roomName: 'LC4-205',
    startAt: '2026-09-15T13:00:00+07:00',
    endAt: '2026-09-15T15:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS372',
    entityId: 'sched-CS372',
    entityType: 'SCHEDULE',
    title: 'Cloud Computing Architecture',
    subtitle: 'Tue 16:00 - 18:00',
    courseCode: 'CS372',
    building: 'LC4',
    roomName: 'LC4-210',
    startAt: '2026-09-15T16:00:00+07:00',
    endAt: '2026-09-15T18:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS363',
    entityId: 'sched-CS363',
    entityType: 'SCHEDULE',
    title: 'Data Structures & Algorithms',
    subtitle: 'Wed 10:00 - 12:00',
    courseCode: 'CS363',
    building: 'LC4',
    roomName: 'LC4-210',
    startAt: '2026-09-16T10:00:00+07:00',
    endAt: '2026-09-16T12:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS368',
    entityId: 'sched-CS368',
    entityType: 'SCHEDULE',
    title: 'Information Security',
    subtitle: 'Wed 14:00 - 17:00',
    courseCode: 'CS368',
    building: 'LC4',
    roomName: 'LC4-215',
    startAt: '2026-09-16T14:00:00+07:00',
    endAt: '2026-09-16T17:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS369',
    entityId: 'sched-CS369',
    entityType: 'SCHEDULE',
    title: 'Web Services Development',
    subtitle: 'Thu 10:00 - 12:00',
    courseCode: 'CS369',
    building: 'LC4',
    roomName: 'LC4-210',
    startAt: '2026-09-17T10:00:00+07:00',
    endAt: '2026-09-17T12:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS364',
    entityId: 'sched-CS364',
    entityType: 'SCHEDULE',
    title: 'Computer Networks',
    subtitle: 'Thu 14:00 - 17:00',
    courseCode: 'CS364',
    building: 'LC4',
    roomName: 'LC4-215',
    startAt: '2026-09-17T14:00:00+07:00',
    endAt: '2026-09-17T17:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS365',
    entityId: 'sched-CS365',
    entityType: 'SCHEDULE',
    title: 'Database Systems',
    subtitle: 'Fri 09:00 - 11:00',
    courseCode: 'CS365',
    building: 'LC4',
    roomName: 'LC4-205',
    startAt: '2026-09-18T09:00:00+07:00',
    endAt: '2026-09-18T11:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bm-sched-CS370',
    entityId: 'sched-CS370',
    entityType: 'SCHEDULE',
    title: 'Distributed Systems',
    subtitle: 'Fri 13:00 - 15:00',
    courseCode: 'CS370',
    building: 'LC4',
    roomName: 'LC4-205',
    startAt: '2026-09-18T13:00:00+07:00',
    endAt: '2026-09-18T15:00:00+07:00',
    savedAt: new Date().toISOString(),
  },
];

function getStorageKey(userId?: string): string {
  return `${BOOKMARK_STORAGE_KEY_PREFIX}${userId || 'local'}`;
}

export const bookmarkService = {
  /**
   * Get all bookmarked items for the user
   */
  async getBookmarks(userId?: string): Promise<BookmarkItem[]> {
    // Guest (unauthenticated) users do not have saved bookmarks
    if (!userId) {
      return [];
    }

    try {
      const key = getStorageKey(userId);
      const raw = localStorage.getItem(key);
      if (!raw) {
        // Initialize with realistic demo bookmarks for authenticated student
        localStorage.setItem(key, JSON.stringify(INITIAL_DEMO_BOOKMARKS));
        return INITIAL_DEMO_BOOKMARKS;
      }
      const parsed: BookmarkItem[] = JSON.parse(raw);
      // Auto-upgrade if student has old short mock items
      if (parsed.length <= 4 && parsed.some((p) => p.entityId === 'sched-CS361')) {
        localStorage.setItem(key, JSON.stringify(INITIAL_DEMO_BOOKMARKS));
        return INITIAL_DEMO_BOOKMARKS;
      }
      return parsed;
    } catch (e) {
      console.warn('Failed to load bookmarks from storage:', e);
      return [];
    }
  },

  /**
   * Add a new bookmark
   */
  async addBookmark(
    item: Omit<BookmarkItem, 'id' | 'savedAt'>,
    userId?: string
  ): Promise<BookmarkItem> {
    const bookmarks = await this.getBookmarks(userId);
    const existing = bookmarks.find(
      (b) => b.entityId === item.entityId && b.entityType === item.entityType
    );
    if (existing) {
      return existing;
    }

    const newBookmark: BookmarkItem = {
      ...item,
      id: `bm-${item.entityType.toLowerCase()}-${item.entityId}`,
      savedAt: new Date().toISOString(),
    };

    bookmarks.unshift(newBookmark);
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(bookmarks));
    return newBookmark;
  },

  /**
   * Remove a bookmark by entity ID and type
   */
  async removeBookmark(
    entityId: string,
    entityType: BookmarkEntityType,
    userId?: string
  ): Promise<void> {
    const bookmarks = await this.getBookmarks(userId);
    const updated = bookmarks.filter(
      (b) => !(b.entityId === entityId && b.entityType === entityType)
    );
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(updated));
  },

  /**
   * Check if an entity is currently bookmarked
   */
  isBookmarked(
    bookmarks: BookmarkItem[],
    entityId: string,
    entityType: BookmarkEntityType
  ): boolean {
    return bookmarks.some(
      (b) => b.entityId === entityId && b.entityType === entityType
    );
  },
};
