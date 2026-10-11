import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { importSchedulesCSV } from '../services/csvScheduleService';

export default function CsvImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'preview' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState<any[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  };

  const handlePreview = async () => {
    if (!file) return;
    setIsLoading(true);
    
    const { status, body } = await importSchedulesCSV(file, true);
    
    if (status === 200) {
      setPreviewData(body.rows || []);
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

  return (
    <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-8 shadow-sm min-h-[400px] flex flex-col">
      {importStatus === 'success' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border border-green-200 rounded-xl">
          <CheckCircle2 className="w-14 h-14 text-green-500 mb-3" />
          <h3 className="text-lg font-semibold text-slate-800 mb-1">Import Completed</h3>
          <p className="text-slate-600 mb-6 text-sm">{errorMessage}</p>
          <button
            type="button"
            onClick={resetImportState}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 px-6 rounded-lg shadow-sm transition-colors"
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
                className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 font-medium px-3.5 py-1.5 rounded-lg transition-colors"
              >
                Remove file
              </button>
            </div>
          )}
        </div>
      )}

      {importStatus === 'preview' && (
        <div className="mb-6 bg-white rounded-lg border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <span className="font-medium text-slate-700">Preview ({previewData.length} rows ready to import)</span>
            <button onClick={resetImportState} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-white sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">Row</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Building</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Room</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Type</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.slice(0, 20).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2">{row.row}</td>
                    <td className="px-4 py-2">{row.building}</td>
                    <td className="px-4 py-2">{row.room}</td>
                    <td className="px-4 py-2">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{row.type}</span>
                    </td>
                    <td className="px-4 py-2 truncate max-w-xs">{row.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importStatus === 'idle' && (
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
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Remove file
              </button>
            </div>
          ) : (
            <>
              <p className="text-slate-800 font-medium mb-1">Drag & drop .csv file here</p>
              <p className="text-slate-500 text-sm mb-6">or click to browse files</p>
              <p className="text-slate-400 text-xs mt-4">
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
      )}

      {/* Action Buttons */}
      {importStatus === 'idle' && (
        <div className="mt-8 flex justify-center">
          <button 
            type="button"
            onClick={handlePreview}
            disabled={!file || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-8 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UploadCloud className="w-5 h-5" />
            {isLoading ? 'Processing...' : 'Upload & Preview'}
          </button>
        </div>
      )}

      {importStatus === 'preview' && (
        <div className="mt-8 flex justify-center">
          <button 
            type="button"
            onClick={handleConfirmImport}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-8 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Importing...' : 'Confirm Import All'}
          </button>
        </div>
      )}
    </div>
  );
}
