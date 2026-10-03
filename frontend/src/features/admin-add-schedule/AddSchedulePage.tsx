import { useState } from 'react';
import { ArrowLeft, FileType, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ManualEntryForm from './admin-manual-add-schedule/ManualEntryForm';
import CsvImportForm from './admin-import-file/CsvImportForm';

export default function AddSchedulePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <button 
          onClick={() => navigate('/admin')} 
          className="flex items-center text-slate-800 font-bold text-2xl gap-2 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
          Add Schedule
        </button>
        <p className="text-slate-500 mt-2 text-sm ml-8">
          Create a new calendar entry manually or batch upload schedule records.
        </p>
      </div>

      <div className="flex gap-4 mb-8 ml-8">
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
            activeTab === 'manual' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileType className="w-4 h-4" />
          Manual Entry
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
            activeTab === 'csv' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          Import CSV
        </button>
      </div>

      <div className="ml-8">
        {activeTab === 'manual' ? <ManualEntryForm /> : <CsvImportForm />}
      </div>
    </div>
  );
}
