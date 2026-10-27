import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { bookmarkService } from '../services/bookmarkService';
import type { BookmarkItem, BookmarkEntityType } from '../types/bookmark.types';
import { AuthPromptModal } from '../components/AuthPromptModal';
import { CheckCircle2, BookmarkX, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';

interface BookmarkContextType {
  bookmarks: BookmarkItem[];
  isLoading: boolean;
  isLoggedIn: boolean;
  activeUser: { id: string; name?: string; role?: string; email?: string } | null;
  isBookmarked: (entityId: string, entityType?: BookmarkEntityType) => boolean;
  toggleBookmark: (item: Omit<BookmarkItem, 'id' | 'savedAt'>) => Promise<boolean>;
  openAuthModal: () => void;
  refreshBookmarks: () => Promise<void>;
}

const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined);

export const BookmarkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'add' | 'remove' | 'warning' } | null>(null);

  const authUserId = authUser?.id;
  const authUserRole = authUser?.role;
  const authUserFullName = authUser?.full_name;
  const authUserEmail = authUser?.email;

  // Active User State derived directly from AuthContext authUser
  const activeUser = useMemo(() => {
    if (authUserId) {
      return {
        id: authUserId,
        name: authUserFullName,
        role: authUserRole,
        email: authUserEmail,
      };
    }
    return null;
  }, [authUserId, authUserFullName, authUserRole, authUserEmail]);

  // Helper to check if user is logged in
  const isUserLoggedIn = useCallback((): boolean => {
    return Boolean(authUserId);
  }, [authUserId]);

  const getActiveUserId = useCallback((): string | undefined => {
    return authUserId;
  }, [authUserId]);

  // Load bookmarks function
  const loadBookmarks = useCallback(async () => {
    if (!authUserId) {
      setBookmarks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await bookmarkService.getBookmarks(authUserId);
      setBookmarks(data);
    } catch (e) {
      console.warn('Failed to load user bookmarks:', e);
      setBookmarks([]);
    } finally {
      setIsLoading(false);
    }
  }, [authUserId]);

  // Load bookmarks whenever active user changes
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (mounted) await loadBookmarks();
    };
    run();
    return () => {
      mounted = false;
    };
  }, [loadBookmarks]);

  const showToast = (message: string, type: 'add' | 'remove' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  const isBookmarked = useCallback(
    (entityId: string, entityType: BookmarkEntityType = 'SCHEDULE'): boolean => {
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
        (b) => b.entityId !== item.entityId
      );
      setBookmarks(nextBookmarks);
      showToast('Removed from bookmarks', 'remove');

      try {
        await bookmarkService.removeBookmark(item.entityId, item.entityType, userId);
        return false;
      } catch (err) {
        // Rollback state on error
        console.error('Failed to remove bookmark, rolling back:', err);
        setBookmarks(previousBookmarks);
        showToast('Failed to remove bookmark', 'remove');
        return true;
      }
    } else {
      // Optimistic Save: Add to state immediately
      const optimisticItem: BookmarkItem = {
        ...item,
        id: `bm-${item.entityId}`,
        savedAt: new Date().toISOString(),
      };
      setBookmarks([optimisticItem, ...bookmarks]);
      showToast('Saved to bookmarks', 'add');

      try {
        const saved = await bookmarkService.addBookmark(item, userId);
        setBookmarks((current) =>
          current.map((b) => (b.entityId === item.entityId ? saved : b))
        );
        return true;
      } catch (err) {
        // Rollback state on error
        console.error('Failed to save bookmark, rolling back:', err);
        setBookmarks(previousBookmarks);
        showToast('Failed to save bookmark', 'remove');
        return false;
      }
    }
  };

  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  const contextValue = useMemo<BookmarkContextType>(
    () => ({
      bookmarks,
      isLoading,
      isLoggedIn: Boolean(authUserId),
      activeUser,
      isBookmarked,
      toggleBookmark,
      openAuthModal,
      refreshBookmarks: loadBookmarks,
    }),
    [bookmarks, isLoading, authUserId, activeUser, isBookmarked, toggleBookmark, openAuthModal, loadBookmarks]
  );

  return (
    <BookmarkContext.Provider value={contextValue}>
      {children}

      {/* Auth Guard Modal for Guests */}
      <AuthPromptModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
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
