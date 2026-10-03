import React, { useState, useRef } from 'react';
import { ArrowLeft, UploadCloud, FileType, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// ⚠️ MOCK VERSION: หน้านี้จำลองการทำงานโดยไม่ยิง API ⚠️
export default function AddNewScheduleMock() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
  
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'preview' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
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
  };

  // --- ระบบ MOCK สำหรับจำลองการยิง API ---
  const handlePreview = () => {
    if (!file) return;
    setIsLoading(true);
    
    // จำลองเวลาโหลด 1.5 วินาที
    setTimeout(() => {
      // จำลองข้อมูลตอบกลับ (Mock Data)
      setPreviewData([
        { row: 1, building: 'LC4', room: '210', type: 'COURSE', title: 'CS361 (Mock)' },
        { row: 2, building: 'LC4', room: '211', type: 'ACTIVITY', title: 'Team Meeting (Mock)' },
      ]);
      setImportStatus('preview');
      setIsLoading(false);
    }, 1500);
  };

  const handleConfirmImport = () => {
    if (!file) return;
    setIsLoading(true);
    
    setTimeout(() => {
      setImportStatus('success');
      setErrorMessage(`นำเข้าสำเร็จ 2 รายการ (Mock Mode)`);
      setFile(null);
      setIsLoading(false);
    }, 1000);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("บันทึกสำเร็จ (ระบบ Mock)\nถ้าจะเชื่อม API จริง กรุณาลบโฟลเดอร์ mock ทิ้ง");
  };

  // -- UI ด้านล่างจะเหมือนตัวจริงเป๊ะ แต่ใช้ handlePreview/Confirm ตัวจำลองแทน --
  return (
    <div className="max-w-5xl mx-auto relative">
      {/* ป้ายเตือนว่านี่คือ Mock Mode */}
      <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg shadow-sm">
        MOCK MODE ACTIVE
      </div>

      <div className="mb-6 mt-4">
        <button 
          onClick={() => navigate('/admin/schedules')} 
          className="flex items-center text-slate-800 font-bold text-2xl gap-2 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
          Add New Schedule
        </button>
      </div>

      <div className="flex gap-4 mb-8 ml-8">
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
            activeTab === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileType className="w-4 h-4" /> Manual Entry
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
            activeTab === 'csv' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" /> Import CSV
        </button>
      </div>

      {activeTab === 'manual' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 ml-8 shadow-sm">
          <form onSubmit={handleManualSubmit} className="grid grid-cols-2 gap-6">
            <div className="col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate-700">Type</label>
              <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500">
                <option>Course</option><option>Activity</option><option>Exam</option>
              </select>
            </div>
            
            <div className="col-span-1 space-y-1 flex flex-col">
              <label className="text-sm font-medium text-slate-700">Start at</label>
              <DatePicker selected={startDate} onChange={(date: Date | null) => setStartDate(date)} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="MM/dd/yyyy h:mm aa" placeholderText="mm/dd/yyyy --:--" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500" />
            </div>

            <div className="col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input type="text" placeholder="e.g. Data Structures" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500" />
            </div>

            <div className="col-span-1 space-y-1 flex flex-col">
                <label className="text-sm font-medium text-slate-700">End at</label>
                <DatePicker selected={endDate} onChange={(date: Date | null) => setEndDate(date)} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="MM/dd/yyyy h:mm aa" placeholderText="mm/dd/yyyy --:--" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500" />
            </div>

            <div className="col-span-2 flex justify-end mt-4">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">
                Save Schedule (Mock)
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'csv' && (
        <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-8 ml-8 shadow-sm min-h-[400px] flex flex-col">
          {importStatus === 'success' && (
            <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2 border border-green-200">
              <CheckCircle2 className="w-5 h-5" /> <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {importStatus === 'preview' && (
            <div className="mb-6 bg-white rounded-lg border border-slate-200 overflow-hidden flex-1 flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <span className="font-medium text-slate-700">Preview ({previewData.length} rows - Mock)</span>
                <button onClick={resetImportState} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-white sticky top-0 border-b border-slate-200">
                    <tr><th className="px-4 py-3">Row</th><th className="px-4 py-3">Building</th><th className="px-4 py-3">Room</th><th className="px-4 py-3">Title</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2">{row.row}</td><td className="px-4 py-2">{row.building}</td><td className="px-4 py-2">{row.room}</td><td className="px-4 py-2">{row.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(importStatus === 'idle' || importStatus === 'error') && (
            <div 
                className={`relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center flex-1 ${file ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white'}`}
                onDragOver={handleDragOver}  
                onDrop={handleDrop}         
            >
              <UploadCloud className="w-12 h-12 mb-4 text-blue-400" />
              {file ? (
                <div>
                  <p className="font-medium">{file.name}</p>
                  <button onClick={() => setFile(null)} className="text-sm text-red-500 font-medium">Remove file</button>
                </div>
              ) : (
                <><p className="font-medium mb-1">Drag & drop .csv file here (Mock)</p><p className="text-sm text-slate-500">or click to browse files</p></>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".csv" className="hidden" />
              {!file && <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 w-full h-full opacity-0" />}
            </div>
          )}

          <div className="mt-8 flex justify-center">
            {importStatus === 'preview' ? (
              <button onClick={handleConfirmImport} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-8 rounded-lg flex gap-2">
                {isLoading ? 'Importing...' : 'Confirm Import All'}
              </button>
            ) : (
              <button onClick={handlePreview} disabled={!file || isLoading} className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-8 rounded-lg flex gap-2">
                <UploadCloud className="w-5 h-5" /> {isLoading ? 'Processing...' : 'Upload & Preview'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}