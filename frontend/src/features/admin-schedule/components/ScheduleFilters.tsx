import React from 'react';
import { Search } from 'lucide-react';

export const ScheduleFilters: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">
        Facility Locator & Quick Resolution
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            1. Building
          </label>
          <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none">
            <option>Lumen Center (LC4)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            2. Floor
          </label>
          <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none">
            <option>Floor 1 (Ground)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            3. Room
          </label>
          <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none">
            <option>Room LC4-101 (Cap. 120)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Search course code, title, organizer..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
