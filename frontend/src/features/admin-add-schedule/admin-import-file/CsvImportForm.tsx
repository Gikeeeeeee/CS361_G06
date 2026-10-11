import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileText, Download, Info, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { importSchedulesCSV } from '../services/csvScheduleService';

function formatPreviewDateTime(isoString: string | undefined): { date: string; time: string } {
  if (!isoString) return { date: '-', time: '-' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      const parts = isoString.split('T');
      return { date: parts[0] || isoString, time: parts[1]?.slice(0, 5) || '-' };
    }
    const date = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return { date, time };
  } catch {
    return { date: isoString, time: '-' };
  }
}

function getTypeBadge(type: string) {
  switch (type?.toUpperCase()) {
    case 'COURSE':
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">COURSE</span>;
    case 'EXAM':
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">EXAM</span>;
    case 'ACTIVITY':
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">ACTIVITY</span>;
    default:
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">{type}</span>;
  }
}

export default function CsvImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'preview' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState<any[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const csvContent = 
`building,room,type,title,start_at,end_at,course_code,organizer,recurrence_rule
LC4,210,COURSE,CS361 Software Architecture,2026-10-05T09:00:00+07:00,2026-10-05T12:00:00+07:00,CS361,CSV-TEST,FREQ=WEEKLY;COUNT=15
LC4,210,COURSE,CS284 Data Structures,2026-10-05T13:00:00+07:00,2026-10-05T16:00:00+07:00,CS284,CSV-TEST,FREQ=WEEKLY;COUNT=15
LC4,211,COURSE,CS213 Computer Networks,2026-10-06T09:00:00+07:00,2026-10-06T12:00:00+07:00,CS213,CSV-TEST,FREQ=WEEKLY;COUNT=15
LC4,212,COURSE,CS222 Operating Systems,2026-10-07T09:00:00+07:00,2026-10-07T10:30:00+07:00,CS222,CSV-TEST,"FREQ=WEEKLY;BYDAY=WE,FR;COUNT=30"
LC4,213,COURSE,"CS101 Intro to Programming, Section 1",2026-10-08T13:00:00+07:00,2026-10-08T16:00:00+07:00,CS101,CSV-TEST,FREQ=WEEKLY;COUNT=15
LC4,214,COURSE,MA211 Calculus II,2026-10-09T09:00:00+07:00,2026-10-09T12:00:00+07:00,MA211,CSV-TEST,FREQ=WEEKLY;COUNT=15
LC4,201,COURSE,CS361 Lab,2026-10-06T13:00:00+07:00,2026-10-06T16:00:00+07:00,CS361,CSV-TEST,FREQ=WEEKLY;COUNT=12
LC4,302,COURSE,CS284 Lab,2026-10-07T13:00:00+07:00,2026-10-07T16:00:00+07:00,CS284,CSV-TEST,FREQ=WEEKLY;COUNT=12
LC3,103,COURSE,SC135 General Physics,2026-10-05T09:00:00+07:00,2026-10-05T12:00:00+07:00,SC135,CSV-TEST,FREQ=WEEKLY;COUNT=15
LC3,104,COURSE,TU100 Civic Education,2026-10-06T13:30:00+07:00,2026-10-06T16:30:00+07:00,TU100,CSV-TEST,FREQ=WEEKLY;COUNT=15
LC3,105,COURSE,Thai for Communication,2026-10-07T09:30:00+07:00,2026-10-07T12:30:00+07:00,TH161,CSV-TEST,FREQ=WEEKLY;COUNT=15
LC3,124,COURSE,CS311 Database Lab,2026-10-08T09:00:00+07:00,2026-10-08T12:00:00+07:00,CS311,CSV-TEST,FREQ=WEEKLY;COUNT=12
LC4,210,EXAM,CS361 Midterm Exam,2026-11-23T09:00:00+07:00,2026-11-23T12:00:00+07:00,CS361,CSV-TEST,
LC4,211,EXAM,CS213 Midterm Exam,2026-11-24T13:00:00+07:00,2026-11-24T16:00:00+07:00,CS213,CSV-TEST,
LC3,103,EXAM,SC135 Midterm Exam,2026-11-28T09:00:00+07:00,2026-11-28T12:00:00+07:00,SC135,CSV-TEST,
LC4,215,EXAM,CS101 Final Exam,2027-01-25T09:00:00+07:00,2027-01-25T12:00:00+07:00,CS101,CSV-TEST,
LC3,115,ACTIVITY,Student Council Meeting,2026-10-14T17:00:00+07:00,2026-10-14T19:00:00+07:00,,CSV-TEST,FREQ=WEEKLY;COUNT=10
LC4,204,ACTIVITY,Advisor Office Hours,2026-10-08T10:00:00+07:00,2026-10-08T11:00:00+07:00,,CSV-TEST,FREQ=WEEKLY;COUNT=12
LC3,104/1,ACTIVITY,Study Group,2026-10-10T10:00:00+07:00,2026-10-10T12:00:00+07:00,,CSV-TEST,FREQ=WEEKLY;COUNT=8
LC4,500,ACTIVITY,Freshmen Orientation,2026-10-17T08:30:00+07:00,2026-10-17T16:30:00+07:00,,CSV-TEST,`;

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'schedule_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      resetImportState();
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      resetImportState();
    }
  };

  const resetImportState = () => {
    setPreviewData([]);
    setImportStatus('idle');
    setErrorMessage('');
    setErrorDetails([]);
    setCurrentPage(1);
  };

  const handlePreview = async () => {
    if (!file) return;
    setIsLoading(true);
    
    const { status, body } = await importSchedulesCSV(file, true);
    
    if (status === 200) {
      setPreviewData(body.rows || []);
      setCurrentPage(1);
      setImportStatus('preview');
    } else if (body.error?.details) {
      setErrorMessage(body.error.message);
      setErrorDetails(body.error.details);
      setImportStatus('error');
    } else {
      setErrorMessage(body.error?.message ?? "System error. Please try again.");
      setImportStatus('error');
    }
    setIsLoading(false);
    return;
  };

  const handleConfirmImport = async () => {
    if (!file) return;
    setIsLoading(true);
    
    const { status, body } = await importSchedulesCSV(file, false);
    
    if (status === 201) {
      setImportStatus('success');
      setErrorMessage(`Successfully imported ${body.created || previewData.length} schedules.`);
      setFile(null);
    } else if (body.error?.details) {
      setErrorMessage(body.error.message);
      setErrorDetails(body.error.details);
      setImportStatus('error');
    } else {
      setErrorMessage(body.error?.message ?? "System error. Please try again.");
      setImportStatus('error');
    }
    setIsLoading(false);
    return;
  };

  // Pagination calculation
  const totalRows = previewData.length;
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalRows / pageSize) || 1;
  const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
  const endIndex = pageSize === 'all' ? totalRows : Math.min(startIndex + pageSize, totalRows);
  const displayedRows = pageSize === 'all' ? previewData : previewData.slice(startIndex, endIndex);

  return (
    <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-8 shadow-sm min-h-[400px] flex flex-col">
      {/* Top Header */}
      <div className="pb-6 mb-6 border-b border-slate-200">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-blue-600" />
          Import Schedules via CSV
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Batch upload multiple schedule records simultaneously using a .csv file.
        </p>
      </div>

      {importStatus === 'success' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border border-green-200 rounded-xl">
          <CheckCircle2 className="w-14 h-14 text-green-500 mb-3" />
          <h3 className="text-lg font-semibold text-slate-800 mb-1">Import Completed</h3>
          <p className="text-slate-600 mb-6 text-sm">{errorMessage}</p>
          <button
            type="button"
            onClick={resetImportState}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 px-6 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Import Another CSV
          </button>
        </div>
      )}

      {importStatus === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            {errorDetails.length > 0 && (
              <div className="mt-4 bg-white rounded border border-red-100 overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-red-50 border-b border-red-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2">Row</th>
                      <th className="px-4 py-2">Building</th>
                      <th className="px-4 py-2">Room</th>
                      <th className="px-4 py-2">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorDetails.map((err, idx) => (
                      <tr key={idx} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2 font-medium">{err.row}</td>
                        <td className="px-4 py-2">{err.building || '-'}</td>
                        <td className="px-4 py-2">{err.room || '-'}</td>
                        <td className="px-4 py-2 text-red-600">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {file && (
            <div className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  resetImportState();
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 font-medium px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Remove file
              </button>
            </div>
          )}
        </div>
      )}

      {importStatus === 'preview' && (
        <div className="mb-6 bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col shadow-xs">
          {/* Preview Header & Stats */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-slate-800 text-sm">Preview Data</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Total {totalRows} rows
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">All ({totalRows})</option>
                </select>
              </div>

              <button 
                type="button"
                onClick={resetImportState} 
                className="text-slate-500 hover:text-slate-800 font-medium px-2 py-1 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Full Rows Table with Date-Time Columns */}
          <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-slate-50/90 backdrop-blur-xs sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-600">Row</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Building</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Room</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Title</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Start Time</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>End Time</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Organizer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRows.map((row, idx) => {
                  const start = formatPreviewDateTime(row.start_at);
                  const end = formatPreviewDateTime(row.end_at);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-slate-500 font-medium">{row.row}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{row.building}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{row.room}</td>
                      <td className="px-4 py-2.5">{getTypeBadge(row.type)}</td>
                      <td className="px-4 py-2.5 truncate max-w-xs font-medium text-slate-800" title={row.title}>
                        {row.title}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">{start.date}</span>
                          <span className="font-mono text-[11px] text-slate-500">{start.time}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">{end.date}</span>
                          <span className="font-mono text-[11px] text-slate-500">{end.time}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 truncate max-w-[130px]" title={row.organizer}>
                        {row.organizer || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Navigation Footer */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="p-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Showing rows <span className="font-medium text-slate-800">{startIndex + 1}</span> - <span className="font-medium text-slate-800">{endIndex}</span> of <span className="font-semibold text-slate-800">{totalRows}</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-2 font-medium text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {importStatus === 'idle' && (
        <>
          {/* CSV Format Reference Guide */}
          <div className="mb-5 bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 text-xs font-semibold">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>CSV Schema & Column Guide</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide((prev) => !prev)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                {showGuide ? 'Hide Guide' : 'View Column Details'}
              </button>
            </div>

            {showGuide && (
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-2 text-slate-600">
                <p className="text-slate-500">
                  The CSV file must include all 9 header columns in the first row in the following order:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-800">building</span> <span className="text-red-500">*</span>
                    <p className="text-slate-500 mt-0.5">Building code e.g. <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">LC4</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">LC3</code></p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-800">room</span> <span className="text-red-500">*</span>
                    <p className="text-slate-500 mt-0.5">Room number e.g. <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">201</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">101</code></p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-800">type</span> <span className="text-red-500">*</span>
                    <p className="text-slate-500 mt-0.5"><code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">COURSE</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">EXAM</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">ACTIVITY</code></p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-800">title</span> <span className="text-red-500">*</span>
                    <p className="text-slate-500 mt-0.5">Event or course title e.g. <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">Software Architecture</code></p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-800">start_at / end_at</span> <span className="text-red-500">*</span>
                    <p className="text-slate-500 mt-0.5">ISO 8601 with offset e.g. <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">2026-10-12T09:00:00+07:00</code></p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-800">recurrence_rule</span>
                    <p className="text-slate-500 mt-0.5">Optional RRULE e.g. <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">FREQ=WEEKLY;BYDAY=MO;COUNT=15</code></p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Drag & Drop File Zone */}
          <div 
              className={`relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition-colors flex-1 ${
                file ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400 bg-white'
              }`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
          >
            <UploadCloud className={`w-12 h-12 mb-4 ${file ? 'text-blue-500' : 'text-blue-400'}`} />
            
            {file ? (
              <div>
                <p className="text-slate-800 font-medium mb-1">Selected File: {file.name}</p>
                <p className="text-slate-500 text-sm mb-4">{(file.size / 1024).toFixed(2)} KB</p>
                <button 
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-sm text-red-500 hover:text-red-700 font-medium cursor-pointer"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <>
                <p className="text-slate-800 font-medium mb-1">Drag & drop .csv file here</p>
                <p className="text-slate-500 text-sm mb-2">or click to browse files</p>
                <p className="text-slate-400 text-xs mt-3">
                  Supported columns: building, room, type, title, start_at, end_at, course_code, organizer, recurrence_rule
                </p>
              </>
            )}
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".csv"
              className="hidden" 
            />
            {!file && (
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Upload file"
              />
            )}
          </div>
        </>
      )}

      {/* Action Buttons at the Bottom */}
      {importStatus === 'idle' && (
        <div className="mt-8 flex flex-col items-center justify-center gap-5">
          <button 
            type="button"
            onClick={handlePreview}
            disabled={!file || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-10 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <UploadCloud className="w-5 h-5" />
            {isLoading ? 'Processing...' : 'Upload & Preview'}
          </button>

          {/* Dedicated New Row: Sample CSV File Format + Download Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-4 border-t border-slate-200/80 w-full max-w-md text-xs text-slate-500">
            <span className="font-medium text-slate-600">Sample CSV File Format:</span>
            <button
              type="button"
              id="download-template-button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-blue-600 rounded-lg font-medium shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Download Sample CSV Template"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download Template (.csv)</span>
            </button>
          </div>
        </div>
      )}

      {importStatus === 'preview' && (
        <div className="mt-8 flex justify-center">
          <button 
            type="button"
            onClick={handleConfirmImport}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-8 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? 'Importing...' : 'Confirm Import All'}
          </button>
        </div>
      )}
    </div>
  );
}
