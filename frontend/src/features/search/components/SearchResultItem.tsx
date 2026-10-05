import { Building2, DoorOpen, Calendar } from 'lucide-react';
import type { SearchResultItem as SearchResultItemType } from '../types';

interface SearchResultItemProps {
  item: SearchResultItemType;
  isSelected: boolean;
  highlightQuery: string;
  onMouseEnter: () => void;
  onClick: () => void;
}

const renderHighlightedText = (text: string, highlight: string) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="font-bold text-blue-600 bg-blue-50/50 rounded-sm">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

export function SearchResultItem({
  item,
  isSelected,
  highlightQuery,
  onMouseEnter,
  onClick,
}: SearchResultItemProps) {
  let Icon = Building2;
  let title = '';
  let subtitle = '';
  
  if (item.type === 'BUILDING') {
    Icon = Building2;
    const nameTh = typeof item.name === 'string' ? item.name : item.name?.th || '';
    const nameEn = typeof item.name === 'string' ? '' : item.name?.en || '';
    title = item.code ? `${item.code} - ${nameTh}` : nameTh;
    subtitle = nameEn;
  } else if (item.type === 'ROOM') {
    Icon = DoorOpen;
    const nameTh = item.name_th || (typeof item.name === 'string' ? item.name : item.name?.th) || '';
    const nameEn = item.name_en || (typeof item.name === 'string' ? '' : item.name?.en) || '';
    
    title = item.title || (item.room_number ? `Room ${item.room_number}` : nameTh || nameEn || 'Room');
    subtitle = item.subtitle || item.description || nameEn || nameTh;
  } else {
    // COURSE, EXAM, ACTIVITY
    Icon = Calendar;
    title = item.course_code ? `${item.course_code} - ${item.title || ''}` : item.title || '';
    subtitle = item.subtitle || '';
  }

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className={`p-2 rounded-lg flex-shrink-0 ${
        item.type === 'BUILDING' ? 'bg-indigo-100 text-indigo-600' :
        item.type === 'ROOM' ? 'bg-emerald-100 text-emerald-600' :
        'bg-amber-100 text-amber-600'
      }`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-sm font-semibold text-slate-800 truncate">
          {renderHighlightedText(title, highlightQuery)}
        </span>
        {subtitle && (
          <span className="text-xs text-slate-500 truncate">
            {renderHighlightedText(subtitle, highlightQuery)}
          </span>
        )}
      </div>
      <div className="flex-shrink-0 self-center">
        <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-1 bg-slate-100 text-slate-500 rounded-md">
          {item.type}
        </span>
      </div>
    </div>
  );
}
