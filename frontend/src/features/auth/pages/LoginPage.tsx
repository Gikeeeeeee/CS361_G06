import React from 'react';
import { LoginForm } from '../components/LoginForm';
import { Building2, Calendar, MapPin, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 md:p-6 lg:p-10">
      <div className="w-full max-w-4xl bg-white md:rounded-3xl md:border md:border-slate-200/80 md:shadow-xl md:shadow-slate-200/50 overflow-hidden flex flex-col md:flex-row min-h-screen md:min-h-[620px]">
        {/* Left Panel: Desktop Branding Showcase (Visible on md and up) */}
        <div className="hidden md:flex md:w-5/12 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 text-white p-8 lg:p-10 flex-col justify-between relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />

          {/* Brand header */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">KU Long</h2>
                <span className="text-[11px] text-blue-200 uppercase tracking-widest font-semibold">Campus Explorer</span>
              </div>
            </div>

            <h3 className="text-2xl font-black leading-snug tracking-tight mb-2">
              Your University Campus, Fully Connected.
            </h3>
            <p className="text-xs text-blue-100/80 leading-relaxed">
              Find classrooms, check schedules, and export your personal timetable with ease.
            </p>
          </div>

          {/* Highlights */}
          <div className="relative z-10 space-y-3 my-8">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold">Interactive Floor Plans</p>
                <p className="text-[11px] text-blue-100/70">Zoom and pan through university buildings</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold">Live Schedules & .ics Export</p>
                <p className="text-[11px] text-blue-100/70">Sync lectures to your personal calendar</p>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="relative z-10 text-[11px] text-blue-200/60 pt-4 border-t border-white/10 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>Kasetsart University Smart Campus System</span>
          </div>
        </div>

        {/* Right Panel: Form Area (Full width on mobile, 7/12 on desktop) */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-12 py-8 bg-white overflow-y-auto">
          <LoginForm />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
