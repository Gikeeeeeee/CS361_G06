import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFacilityDetail } from '../features/room-detail/hooks/useFacilityDetail';
import { ArrowLeft, Bookmark, MapPin, Info } from 'lucide-react';

export default function FacilityDetailPage() {
  const { facilityId } = useParams<{ facilityId: string }>();
  const navigate = useNavigate();
  const { facility, floor, loading, error } = useFacilityDetail(facilityId || '');

  useEffect(() => {
    if (facility) {
      document.title = `${facility.name.th} | KU Long`;
    }
  }, [facility]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin"></div>
      </div>
    );
  }

  if (error || !facility) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Facility not found</h2>
        <p className="text-slate-500">{error || 'The facility details could not be loaded.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Hero Header */}
      <div className="relative h-44 w-full overflow-hidden bg-blue-600 flex flex-col justify-between pt-8 pb-10 px-5">
        {/* Floating nav */}
        <div className="flex items-center justify-between relative z-10">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
          </button>
          <button
            className="w-10 h-10 -mr-1 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition"
            aria-label="Bookmark"
          >
            <Bookmark className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* Facility name */}
        <h1 className="text-3xl font-extrabold text-white tracking-tight relative z-10">
          {facility.name.th}
        </h1>
      </div>

      {/* Floating Info Card */}
      <div className="-mt-6 mx-4 relative z-20">
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-slate-100/80">
          {/* English name */}
          <p className="text-sm text-slate-500 font-medium">{facility.name.en}</p>

          {/* Type badge */}
          <div className="flex items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold uppercase tracking-wide">
              <MapPin className="w-3 h-3 text-slate-500" />
              {facility.type}
            </span>
            {floor && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-semibold">
                Level {floor.floor_number}
              </span>
            )}
          </div>

          {/* Description */}
          {facility.description && (facility.description.th || facility.description.en) && (
            <>
              <div className="border-t border-slate-100 my-3.5" />
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-slate-600 leading-relaxed">
                  {facility.description.th && <p>{facility.description.th}</p>}
                  {facility.description.en && (
                    <p className="text-xs text-slate-400 mt-1">({facility.description.en})</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Location Section */}
      <section className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Location</h3>
        </div>
        <div className="w-full rounded-xl border border-slate-200 bg-white p-4">
        </div>
      </section>
    </div>
  );
}
