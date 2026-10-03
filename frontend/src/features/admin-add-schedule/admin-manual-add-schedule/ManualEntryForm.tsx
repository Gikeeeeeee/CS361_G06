import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function ManualEntryForm() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submit manual form", { startDate, endDate });
    alert("Saved manually! (Mock data logged to console)");
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
      <form onSubmit={handleManualSubmit} className="grid grid-cols-2 gap-6">
        <div className="col-span-1 space-y-1">
          <label className="text-sm font-medium text-slate-700">Type</label>
          <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option>Course</option>
            <option>Activity</option>
            <option>Exam</option>
          </select>
        </div>
        
        <div className="col-span-1 space-y-1 flex flex-col">
          <label className="text-sm font-medium text-slate-700">Start at</label>
          <DatePicker
            selected={startDate}
            onChange={(date: Date | null) => setStartDate(date)}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="MM/dd/yyyy h:mm aa"
            placeholderText="mm/dd/yyyy --:--"
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="col-span-1 space-y-1">
          <label className="text-sm font-medium text-slate-700">Title</label>
          <input type="text" placeholder="e.g. Data Structures" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>

        <div className="col-span-1 space-y-1 flex flex-col">
            <label className="text-sm font-medium text-slate-700">End at</label>
            <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="MM/dd/yyyy h:mm aa"
                placeholderText="mm/dd/yyyy --:--"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
        </div>

        <div className="col-span-1 space-y-1">
          <label className="text-sm font-medium text-slate-700">Course Code</label>
          <input type="text" placeholder="e.g. CS201" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>

        <div className="col-span-1 space-y-1">
          <label className="text-sm font-medium text-slate-700">Repeat (RFC 5545)</label>
          <input type="text" placeholder="Configure custom recurrence rule" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>

        <div className="col-span-1 space-y-1">
          <label className="text-sm font-medium text-slate-700">Room</label>
          <input type="text" placeholder="Search rooms..." className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>

        <div className="col-span-1 space-y-1">
          <label className="text-sm font-medium text-slate-700">Status</label>
          <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>

        <div className="col-span-2 md:col-span-1 space-y-1">
          <label className="text-sm font-medium text-slate-700">Organizer</label>
          <input type="text" placeholder="e.g. Prof. Smith" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>

        <div className="col-span-2 space-y-1">
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea placeholder="Add notes or description..." rows={4} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"></textarea>
        </div>

        <div className="col-span-2 flex justify-end mt-4">
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">
            Save Schedule
          </button>
        </div>
      </form>
    </div>
  );
}
