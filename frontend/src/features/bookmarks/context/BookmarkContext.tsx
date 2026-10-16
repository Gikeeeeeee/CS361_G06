import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { bookmarkService } from '../services/bookmarkService';
import type { BookmarkItem, BookmarkEntityType } from '../types/bookmark.types';
import { AuthPromptModal } from '../components/AuthPromptModal';
import { ScheduleConflictModal } from '../components/ScheduleConflictModal';
import { detectScheduleConflict, type ParsedTimeSlot } from '../utils/scheduleConflictUtils';
import { CheckCircle2, BookmarkX, AlertTriangle } from 'lucide-react';

interface BookmarkContextType {
  bookmarks: BookmarkItem[];
  isLoading: boolean;
  isBookmarked: (entityId: string, entityType: BookmarkEntityType) => boolean;
  toggleBookmark: (item: Omit<BookmarkItem, 'id' | 'savedAt'>) => Promise<boolean>;
  openAuthModal: () => void;
}

const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined);

export const BookmarkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'add' | 'remove' | 'warning' } | null>(null);

  // State for Schedule Conflict Modal
  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean;
    candidateItem: Omit<BookmarkItem, 'id' | 'savedAt'> | BookmarkItem | null;
    conflictingItem: BookmarkItem | null;
    candidateSlot: ParsedTimeSlot | null;
    conflictingSlot: ParsedTimeSlot | null;
  }>({
    isOpen: false,
    candidateItem: null,
    conflictingItem: null,
    candidateSlot: null,
    conflictingSlot: null,
  });

  // Helper to check if user is logged in (reads auth session or storage)
  const isUserLoggedIn = useCallback((): boolean => {
    try {
      const stored = localStorage.getItem('ku_long_auth_user');
      return Boolean(stored);
    } catch {
      return false;
    }
  }, []);

  const getActiveUserId = useCallback((): string | undefined => {
    try {
      const raw = localStorage.getItem('ku_long_auth_user');
      if (raw) {
        const u = JSON.parse(raw);
        return u.id;
      }
    } catch {
      // ignore
    }
    return undefined;
  }, []);

  // Load initial bookmarks on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const userId = getActiveUserId();
        const data = await bookmarkService.getBookmarks(userId);
        if (mounted) {
          setBookmarks(data);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [getActiveUserId]);

  const showToast = (message: string, type: 'add' | 'remove' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  const isBookmarked = useCallback(
    (entityId: string, entityType: BookmarkEntityType): boolean => {
      return bookmarkService.isBookmarked(bookmarks, entityId, entityType);
    },
    [bookmarks]
  );

  /**
   * Toggle Bookmark with Optimistic UI Update and Rollback on error
   */
  const toggleBookmark = async (
    item: Omit<BookmarkItem, 'id' | 'savedAt'>
  ): Promise<boolean> => {
    // 1. Auth Guard: If guest (not logged in), prompt login modal & block save
    if (!isUserLoggedIn()) {
      setIsAuthModalOpen(true);
      return false;
    }

    const userId = getActiveUserId();
    const currentlySaved = isBookmarked(item.entityId, item.entityType);
    const previousBookmarks = [...bookmarks];

    if (currentlySaved) {
      // Optimistic Unsave: Remove from state immediately
      const nextBookmarks = bookmarks.filter(
        (b) => !(b.entityId === item.entityId && b.entityType === item.entityType)
      );
      setBookmarks(nextBookmarks);
      showToast('ยกเลิกการบันทึกแล้ว', 'remove');

      try {
        await bookmarkService.removeBookmark(item.entityId, item.entityType, userId);
        return false;
      } catch (err) {
        // Rollback state on error
        console.error('Failed to remove bookmark, rolling back:', err);
        setBookmarks(previousBookmarks);
        showToast('เกิดข้อผิดพลาดในการยกเลิกบันทึก', 'remove');
        return true;
      }
    } else {
      // 2. Schedule Conflict Check: prevent booking if times overlap on the same day
      if (item.entityType === 'SCHEDULE') {
        const conflict = detectScheduleConflict(item, bookmarks);
        if (conflict.hasConflict && conflict.conflictingItem) {
          setConflictModal({
            isOpen: true,
            candidateItem: item,
            conflictingItem: conflict.conflictingItem,
            candidateSlot: conflict.candidateSlot || null,
            conflictingSlot: conflict.conflictingSlot || null,
          });
          showToast(
            `เวลาชนกับ [${conflict.conflictingItem.courseCode || conflict.conflictingItem.title}]`,
            'warning'
          );
          return false;
        }
      }

      // Optimistic Save: Add to state immediately
      const optimisticItem: BookmarkItem = {
        ...item,
        id: `bm-${item.entityType.toLowerCase()}-${item.entityId}`,
        savedAt: new Date().toISOString(),
      };
      setBookmarks([optimisticItem, ...bookmarks]);
      showToast('บันทึกสำเร็จ (Saved to bookmarks)', 'add');

      try {
        const saved = await bookmarkService.addBookmark(item, userId);
        setBookmarks((current) =>
          current.map((b) => (b.id === optimisticItem.id ? saved : b))
        );
        return true;
      } catch (err) {
        // Rollback state on error
        console.error('Failed to save bookmark, rolling back:', err);
        setBookmarks(previousBookmarks);
        showToast('เกิดข้อผิดพลาดในการบันทึก', 'remove');
        return false;
      }
    }
  };

  return (
    <BookmarkContext.Provider
      value={{
        bookmarks,
        isLoading,
        isBookmarked,
        toggleBookmark,
        openAuthModal: () => setIsAuthModalOpen(true),
      }}
    >
      {children}

      {/* Auth Guard Modal for Guests */}
      <AuthPromptModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Schedule Conflict Modal */}
      <ScheduleConflictModal
        isOpen={conflictModal.isOpen}
        onClose={() =>
          setConflictModal((prev) => ({ ...prev, isOpen: false }))
        }
        candidateItem={conflictModal.candidateItem}
        conflictingItem={conflictModal.conflictingItem}
        candidateSlot={conflictModal.candidateSlot}
        conflictingSlot={conflictModal.conflictingSlot}
      />

      {/* Snappy Toast Feedback */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-900/95 text-white text-xs font-semibold rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-150 pointer-events-none">
          {toast.type === 'add' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <BookmarkX className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </BookmarkContext.Provider>
  );
};

export function useBookmarks(): BookmarkContextType {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarkProvider');
  }
  return context;
}
