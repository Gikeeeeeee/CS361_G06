/**
 * Centralized Room Resolver Service (Single Source of Truth)
 * Resolves divergent room identifiers (SVG IDs with hyphens, DB room numbers with slashes, UUIDs, and localized names)
 * Prevents hardcoded matching logic across different screens.
 */

import { facilityCache, resolveRoomNumber } from '../../admin-schedule/services/facilityCache';

/**
 * Standardize any room string into a normalized lookup key.
 * Strips 'room-', 'facility-', 'rm_', building prefixes ('LC3-', 'LC4-'), and removes slashes/hyphens.
 * Examples:
 *   'room-101-1' -> '1011'
 *   '101/1'      -> '1011'
 *   'LC3-101/1'  -> '1011'
 *   'RM_ROOM_101_1' -> '1011'
 */
export function normalizeRoomKey(val: string | null | undefined): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .trim()
    .replace(/^(room-|facility-|rm_|rm-)/, '')
    .replace(/^(lc[0-9]+|sc[0-9]+)-/i, '')
    .replace(/[\/\-_]/g, '');
}

/**
 * Check if an identifier string matches a room object or metadata entry.
 */
export function matchesRoomIdentifier(target: string | null | undefined, room: any): boolean {
  if (!target || !room) return false;
  const normTarget = normalizeRoomKey(target);
  if (!normTarget) return false;

  // Direct ID / UUID match
  if (room.id && room.id.toLowerCase() === target.toLowerCase()) return true;
  if (room.room_id && room.room_id.toLowerCase() === target.toLowerCase()) return true;

  // Normalized key comparisons
  if (room.id && normalizeRoomKey(room.id) === normTarget) return true;
  if (room.room_id && normalizeRoomKey(room.room_id) === normTarget) return true;
  if (room.room_number && normalizeRoomKey(room.room_number) === normTarget) return true;
  if (room.room_code && normalizeRoomKey(room.room_code) === normTarget) return true;

  // Localized names
  if (room.name?.en && normalizeRoomKey(room.name.en) === normTarget) return true;
  if (room.name?.th && normalizeRoomKey(room.name.th) === normTarget) return true;
  if (typeof room.name === 'string' && normalizeRoomKey(room.name) === normTarget) return true;

  // facilityCache roomMeta lookup
  const roomId = room.id || room.room_id;
  if (roomId) {
    const meta = facilityCache.roomMeta.get(roomId);
    if (meta) {
      if (meta.roomNumber && normalizeRoomKey(meta.roomNumber) === normTarget) return true;
      if (meta.nameEn && normalizeRoomKey(meta.nameEn) === normTarget) return true;
      if ((meta as any).nameTh && normalizeRoomKey((meta as any).nameTh) === normTarget) return true;
    }
  }

  return false;
}

/**
 * Resolve a room object from a collection using any identifier format.
 * Returns the exact room object containing the database UUID.
 */
export function resolveRoomEntity<T = any>(
  identifier: string | null | undefined,
  candidateRooms: T[] | undefined | null
): T | null {
  if (!identifier || !candidateRooms || candidateRooms.length === 0) return null;
  return candidateRooms.find((r) => matchesRoomIdentifier(identifier, r)) || null;
}

/**
 * Generate all possible lookup keys for a room to populate status and highlight lookup maps.
 */
export function getRoomLookupKeys(room: any): string[] {
  if (!room) return [];
  const keys = new Set<string>();

  const rawId = room.id || room.room_id;
  if (rawId) {
    keys.add(rawId);
    keys.add(rawId.toLowerCase());
  }

  const rawNum = room.room_number;
  if (rawNum) {
    keys.add(rawNum);
    keys.add(rawNum.toLowerCase());
    keys.add(`room-${rawNum}`);
    keys.add(`room-${rawNum}`.toLowerCase());

    const dashed = rawNum.replace(/\//g, '-');
    keys.add(dashed);
    keys.add(dashed.toLowerCase());
    keys.add(`room-${dashed}`);
    keys.add(`room-${dashed}`.toLowerCase());
  }

  const code = room.room_code;
  if (code) {
    keys.add(code);
    keys.add(code.toLowerCase());
    keys.add(`room-${code}`);
    keys.add(`room-${code}`.toLowerCase());

    const dashedCode = code.replace(/\//g, '-');
    keys.add(dashedCode);
    keys.add(dashedCode.toLowerCase());
    keys.add(`room-${dashedCode}`);
    keys.add(`room-${dashedCode}`.toLowerCase());
  }

  if (room.name?.en) {
    keys.add(room.name.en);
    keys.add(room.name.en.toLowerCase());
  }
  if (room.name?.th) {
    keys.add(room.name.th);
    keys.add(room.name.th.toLowerCase());
  }

  return Array.from(keys);
}

/**
 * Standardize room display codes and names for UI presentation.
 */
export function formatRoomDisplay(
  room: any,
  buildingCode?: string
): { displayCode: string; displayName: string } {
  const bCode = buildingCode || room.buildingCode || room.building_code || '';
  const rawNum = room.room_number || room.roomNumber;
  const resolvedNum = resolveRoomNumber(rawNum, room.name?.en, room.name?.th);

  let displayCode = '';
  let displayName = '';

  if (resolvedNum) {
    displayCode = bCode && !resolvedNum.toLowerCase().startsWith(bCode.toLowerCase())
      ? `${bCode}-${resolvedNum}`
      : resolvedNum;
  } else if (room.room_code && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(room.room_code)) {
    displayCode = bCode && !room.room_code.startsWith(bCode)
      ? `${bCode}-${room.room_code}`
      : room.room_code;
  } else {
    const typeName = room.type === 'LANDMARK' ? 'Landmark' : room.type ? room.type.replace(/_/g, ' ') : 'Area';
    displayCode = bCode ? `${bCode}-${typeName}` : typeName;
  }

  displayName =
    room.name?.en ||
    room.name?.th ||
    (typeof room.name === 'string' ? room.name : '') ||
    (room.type === 'LANDMARK' ? `${bCode} Landmark` : displayCode);

  return { displayCode, displayName };
}
