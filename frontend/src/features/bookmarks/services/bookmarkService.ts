import { apiClient } from '../../../services/api/apiClient';
import type { BookmarkItem, BookmarkEntityType } from '../types/bookmark.types';

export interface BackendBookmarkRecord {
  id: string;
  user_id: string;
  entity_id: string;
  entity_type: BookmarkEntityType;
  saved_at: string;
}

export interface BackendBookmarkListResponse {
  success: boolean;
  data: BackendBookmarkRecord[];
}

const META_STORAGE_KEY_PREFIX = 'ku_long_bookmark_meta_';

function getMetaKey(entityId: string): string {
  return `${META_STORAGE_KEY_PREFIX}${entityId}`;
}

export const bookmarkService = {
  /**
   * Get all bookmarked items for the authenticated user from Backend API
   */
  async getBookmarks(userId?: string): Promise<BookmarkItem[]> {
    // Guest (unauthenticated) users do not have saved bookmarks in the database
    if (!userId) {
      return [];
    }

    try {
      const res = await apiClient.get<BackendBookmarkListResponse>('/bookmarks');
      const records = res?.data || [];
      if (!Array.isArray(records) || records.length === 0) {
        return [];
      }

      // Check which records need metadata enrichment
      const missingIds: string[] = [];
      const items: BookmarkItem[] = records.map((record) => {
        const cached = localStorage.getItem(getMetaKey(record.entity_id));
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            return {
              ...parsed,
              id: record.id,
              entityId: record.entity_id,
              entityType: record.entity_type,
              savedAt: record.saved_at,
            };
          } catch {
            // ignore cache parse error
          }
        }
        missingIds.push(record.entity_id);
        return {
          id: record.id,
          entityId: record.entity_id,
          entityType: record.entity_type,
          title: `Schedule ${record.entity_id.slice(0, 8)}`,
          savedAt: record.saved_at,
        };
      });

      // If any records were missing metadata, fetch schedules from backend to hydrate them
      if (missingIds.length > 0) {
        try {
          const schedRes = await apiClient.get<any>('/schedules?pageSize=100');
          const scheduleList = schedRes?.data || [];
          if (Array.isArray(scheduleList)) {
            const schedMap = new Map<string, any>(scheduleList.map((s: any) => [s.id, s]));
            for (const item of items) {
              const matched = schedMap.get(item.entityId);
              if (matched) {
                const sDate = matched.start_at ? new Date(matched.start_at) : null;
                const eDate = matched.end_at ? new Date(matched.end_at) : null;
                const dayStr = sDate ? sDate.toLocaleDateString('en-US', { weekday: 'short' }) : '';
                const timeStr =
                  sDate && eDate
                    ? `${sDate.toTimeString().slice(0, 5)} - ${eDate.toTimeString().slice(0, 5)}`
                    : '';

                item.title = matched.title || item.title;
                item.courseCode = matched.course_code || undefined;
                item.startAt = matched.start_at;
                item.endAt = matched.end_at;
                item.roomId = matched.room_id;
                item.type = matched.type;
                item.organizer = matched.organizer;
                item.subtitle = dayStr && timeStr ? `${dayStr} ${timeStr}` : undefined;

                localStorage.setItem(getMetaKey(item.entityId), JSON.stringify(item));
              }
            }
          }
        } catch (e) {
          console.warn('Failed to hydrate schedules metadata:', e);
        }
      }

      return items;
    } catch (e) {
      console.warn('Failed to load bookmarks from backend API:', e);
      return [];
    }
  },

  /**
   * Add a new bookmark via POST /api/v1/bookmarks
   */
  async addBookmark(
    item: Omit<BookmarkItem, 'id' | 'savedAt'>,
    userId?: string
  ): Promise<BookmarkItem> {
    if (!userId) {
      throw new Error('Please sign in to save bookmarks');
    }

    // Save full item metadata to local cache
    try {
      localStorage.setItem(getMetaKey(item.entityId), JSON.stringify(item));
    } catch {
      // ignore storage error
    }

    try {
      const res = await apiClient.post<{ success: boolean; data: BackendBookmarkRecord }>('/bookmarks', {
        entity_id: item.entityId,
        entity_type: item.entityType || 'SCHEDULE',
      });

      return {
        ...item,
        id: res?.data?.id || `bm-${item.entityId}`,
        savedAt: res?.data?.saved_at || new Date().toISOString(),
      };
    } catch (err: any) {
      // 409 Conflict means already saved in DB
      if (err?.status === 409 || err?.body?.error?.code === 'ALREADY_BOOKMARKED') {
        return {
          ...item,
          id: `bm-${item.entityId}`,
          savedAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  },

  /**
   * Remove a bookmark via DELETE /api/v1/bookmarks/:entity_id
   */
  async removeBookmark(
    entityId: string,
    _entityType: BookmarkEntityType,
    userId?: string
  ): Promise<void> {
    if (!userId) {
      return;
    }

    try {
      await apiClient.delete(`/bookmarks/${encodeURIComponent(entityId)}`);
    } catch (err: any) {
      // If 404, it was already removed, so treat as success
      if (err?.status !== 404) {
        throw err;
      }
    } finally {
      try {
        localStorage.removeItem(getMetaKey(entityId));
      } catch {
        // ignore storage error
      }
    }
  },

  /**
   * Check if an entity is currently bookmarked
   */
  isBookmarked(
    bookmarks: BookmarkItem[],
    entityId: string,
    _entityType: BookmarkEntityType
  ): boolean {
    return bookmarks.some((b) => b.entityId === entityId);
  },
};
