import { useState, useEffect, useCallback } from 'react';

/**
 * Storage key for exported schedules in localStorage
 */
export const EXPORTED_SCHEDULES_STORAGE_KEY = 'exported_schedules';

/**
 * Custom event name for syncing exported schedules across components in the same tab
 */
export const EXPORTED_SCHEDULES_EVENT = 'exported_schedules_updated';

/**
 * Safely read exported schedule IDs from localStorage
 */
export function getExportedScheduleIds(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(EXPORTED_SCHEDULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id).trim()).filter(Boolean);
  } catch (err) {
    console.warn('[useExportedSchedules] Failed to parse exported_schedules from localStorage:', err);
    return [];
  }
}

/**
 * Add a schedule ID (or list of IDs) to localStorage and notify listeners
 */
export function saveExportedScheduleId(idOrIds: string | number | (string | number)[]): string[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  const rawIds = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  const newIds = rawIds.map((id) => String(id).trim()).filter(Boolean);
  if (newIds.length === 0) return getExportedScheduleIds();

  const current = getExportedScheduleIds();
  const currentSet = new Set(current);
  let changed = false;

  for (const id of newIds) {
    if (!currentSet.has(id)) {
      currentSet.add(id);
      changed = true;
    }
  }

  if (!changed) {
    return current;
  }

  const updated = Array.from(currentSet);
  try {
    localStorage.setItem(EXPORTED_SCHEDULES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent(EXPORTED_SCHEDULES_EVENT, {
        detail: { newIds, exported: updated },
      })
    );
  } catch (err) {
    console.error('[useExportedSchedules] Failed to write to localStorage:', err);
  }
  return updated;
}

/**
 * Remove a schedule ID from localStorage (e.g. if bookmark removed or reset)
 */
export function removeExportedScheduleId(idOrIds: string | number | (string | number)[]): string[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  const rawIds = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  const targetIds = new Set(rawIds.map((id) => String(id).trim()).filter(Boolean));
  if (targetIds.size === 0) return getExportedScheduleIds();

  const current = getExportedScheduleIds();
  const updated = current.filter((id) => !targetIds.has(id));

  try {
    localStorage.setItem(EXPORTED_SCHEDULES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent(EXPORTED_SCHEDULES_EVENT, {
        detail: { removed: Array.from(targetIds), exported: updated },
      })
    );
  } catch (err) {
    console.error('[useExportedSchedules] Failed to remove from localStorage:', err);
  }
  return updated;
}

/**
 * Helper to check if a schedule is already marked as exported
 */
export function isScheduleExported(
  scheduleOrId: string | number | null | undefined | { id?: string | number; entityId?: string | number; scheduleId?: string | number }
): boolean {
  if (!scheduleOrId) return false;
  const current = getExportedScheduleIds();
  const currentSet = new Set(current);

  if (typeof scheduleOrId === 'object') {
    const candidates = [
      scheduleOrId.entityId,
      scheduleOrId.id,
      scheduleOrId.scheduleId,
    ]
      .filter((v): v is string | number => v !== undefined && v !== null)
      .map((v) => String(v).trim());
    return candidates.some((cid) => currentSet.has(cid));
  }

  return currentSet.has(String(scheduleOrId).trim());
}

/**
 * React hook to observe and update exported schedule IDs across the app
 */
export function useExportedSchedules() {
  const [exportedIds, setExportedIds] = useState<string[]>(() => getExportedScheduleIds());

  useEffect(() => {
    const handleUpdate = () => {
      setExportedIds(getExportedScheduleIds());
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === EXPORTED_SCHEDULES_STORAGE_KEY) {
        setExportedIds(getExportedScheduleIds());
      }
    };

    window.addEventListener(EXPORTED_SCHEDULES_EVENT, handleUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(EXPORTED_SCHEDULES_EVENT, handleUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const isExported = useCallback(
    (
      scheduleOrId:
        | string
        | number
        | null
        | undefined
        | { id?: string | number; entityId?: string | number; scheduleId?: string | number }
    ): boolean => {
      if (!scheduleOrId) return false;
      const currentSet = new Set(exportedIds);

      if (typeof scheduleOrId === 'object') {
        const candidates = [
          scheduleOrId.entityId,
          scheduleOrId.id,
          scheduleOrId.scheduleId,
        ]
          .filter((v): v is string | number => v !== undefined && v !== null)
          .map((v) => String(v).trim());
        return candidates.some((cid) => currentSet.has(cid));
      }

      return currentSet.has(String(scheduleOrId).trim());
    },
    [exportedIds]
  );

  const markAsExported = useCallback(
    (
      scheduleOrId:
        | string
        | number
        | { id?: string | number; entityId?: string | number; scheduleId?: string | number }
    ): void => {
      if (!scheduleOrId) return;

      if (typeof scheduleOrId === 'object') {
        const candidates = [
          scheduleOrId.entityId,
          scheduleOrId.id,
          scheduleOrId.scheduleId,
        ]
          .filter((v): v is string | number => v !== undefined && v !== null)
          .map((v) => String(v).trim());
        saveExportedScheduleId(candidates);
      } else {
        saveExportedScheduleId(scheduleOrId);
      }
    },
    []
  );

  return {
    exportedIds,
    isExported,
    markAsExported,
  };
}
