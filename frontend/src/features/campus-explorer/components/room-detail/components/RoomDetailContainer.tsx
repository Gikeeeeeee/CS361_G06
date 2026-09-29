import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark } from 'lucide-react';

interface RoomDetailContainerProps {
  children: React.ReactNode;
  roomNumber: string;
}

export function RoomDetailContainer({ children, roomNumber }: RoomDetailContainerProps) {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 h-16 pt-safe">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" strokeWidth={2.5} />
        </button>
        
        <h1 className="text-[15px] font-black tracking-wide text-slate-800 uppercase">
          {roomNumber}
        </h1>
        
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 active:bg-slate-100 transition-colors group">
          <Bookmark size={20} className="text-slate-400 group-active:text-primary transition-colors" strokeWidth={2.5} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-8">
        {children}
      </main>
    </div>
  );
}
