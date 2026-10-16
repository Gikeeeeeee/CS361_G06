import React from 'react';
import { Bookmark } from 'lucide-react';
import { useBookmarks } from '../context/BookmarkContext';
import type { BookmarkEntityType } from '../types/bookmark.types';

interface BookmarkButtonProps {
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
  className?: string;
  iconClassName?: string;
  activeColorClass?: string;
  inactiveColorClass?: string;
  size?: number;
  showText?: boolean;
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  entityId,
  entityType,
  title,
  subtitle,
  building,
  floor,
  courseCode,
  startAt,
  endAt,
  roomName,
  className = '',
  iconClassName = '',
  activeColorClass = 'text-blue-600 fill-blue-600',
  inactiveColorClass = 'text-slate-400 hover:text-slate-600',
  size = 20,
  showText = false,
}) => {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const saved = isBookmarked(entityId, entityType);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    await toggleBookmark({
      entityId,
      entityType,
      title,
      subtitle,
      building,
      floor,
      courseCode,
      startAt,
      endAt,
      roomName,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-90 cursor-pointer ${className}`}
      aria-label={saved ? 'Remove bookmark' : 'Bookmark this item'}
      title={saved ? 'Remove bookmark' : 'Add to bookmarks'}
    >
      <Bookmark
        size={size}
        className={`transition-all duration-150 ${
          saved ? activeColorClass : inactiveColorClass
        } ${iconClassName}`}
      />
      {showText && (
        <span
          className={`text-xs font-semibold ${
            saved ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          {saved ? 'Saved' : 'Save'}
        </span>
      )}
    </button>
  );
};
