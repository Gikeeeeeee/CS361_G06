import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Save } from 'lucide-react';
import type { RoomStatus, CorridorStatus, NodeStatus } from '../types/status.types';

interface StatusEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  target: {
    type: 'ROOM' | 'CORRIDOR' | 'NODE';
    id: string;
    code: string;
    name?: string;
    floorId: string;
    buildingCode?: string;
    currentStatus: RoomStatus | CorridorStatus | NodeStatus;
    currentNote?: string | null;
  } | null;
  onSave: (
    type: 'ROOM' | 'CORRIDOR' | 'NODE',
    id: string,
    code: string,
    newStatus: string,
    note: string | null
  ) => Promise<void>;
}

export const StatusEditDrawer: React.FC<StatusEditDrawerProps> = ({
  isOpen,
  onClose,
  target,
  onSave,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [statusNote, setStatusNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (target) {
      setSelectedStatus(target.currentStatus || 'ACTIVE');
      setStatusNote(target.currentNote || '');
      setErrorMsg(null);
      setConfirming(false);
    }
  }, [target]);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    if (target.type === 'CORRIDOR') {
      if (selectedStatus === target.currentStatus) return;
      if (!confirming) { setConfirming(true); return; }
    }
    submitting.current = true;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await onSave(
        target.type,
        target.id,
        target.code,
        selectedStatus,
        statusNote.trim() || null
      );
      onClose();
    } catch (err: any) {
      setConfirming(false);
      setErrorMsg(err?.message || 'Failed to update status. Please try again.');
    } finally {
      setIsSubmitting(false);
      submitting.current = false;
    }
  };

  const isRoom = target.type === 'ROOM';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={() => { if (!submitting.current) onClose(); }}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div role="dialog" aria-modal="true" aria-label="Status Configuration" className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold leading-tight">
                Status Configuration
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRoom ? 'Manage Room Availability' : 'Manage Corridor Access'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Form */}
          <form onSubmit={handleSubmit} inert={isSubmitting} onChange={() => setConfirming(false)} className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Target Information Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Target Element
              </div>
              <div className="text-lg font-bold text-slate-900">{target.code}</div>
              {target.name && (
                <div className="text-xs text-slate-600 mt-0.5">{target.name}</div>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="px-2 py-0.5 rounded bg-slate-200/70 font-medium">
                  {target.type}
                </span>
                <span>Floor: {target.floorId}</span>
                <span>Building: {target.buildingCode}</span>
              </div>
              <p className="text-xs mt-2">Current status: {target.currentStatus}</p>
              {target.type === 'CORRIDOR' && <p className="text-xs mt-1">Connected nodes: {target.name}</p>}
            </div>

            {/* Status Options */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Operational Status
              </label>

              {isRoom ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {/* ACTIVE */}
                  <button
                    type="button"
                    onClick={() => { setSelectedStatus('ACTIVE'); setConfirming(false); }}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition ${
                      selectedStatus === 'ACTIVE'
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Active / Available</div>
                      <div className="text-xs text-slate-500 mt-0.5">Open for classes and normal usage</div>
                    </div>
                    {selectedStatus === 'ACTIVE' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    )}
                  </button>

                  {/* MAINTENANCE */}
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('MAINTENANCE')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition ${
                      selectedStatus === 'MAINTENANCE'
                        ? 'border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Under Maintenance</div>
                      <div className="text-xs text-slate-500 mt-0.5">Temporarily undergoing repairs or cleaning</div>
                    </div>
                    {selectedStatus === 'MAINTENANCE' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    )}
                  </button>

                  {/* CLOSED */}
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('CLOSED')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition ${
                      selectedStatus === 'CLOSED'
                        ? 'border-red-500 bg-red-50/70 text-red-950 ring-2 ring-red-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Closed / Unavailable</div>
                      <div className="text-xs text-slate-500 mt-0.5">Inaccessible to students and staff</div>
                    </div>
                    {selectedStatus === 'CLOSED' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    )}
                  </button>
                </div>
              ) : (
                /* Corridor / Node Status */
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedStatus('ACTIVE'); setConfirming(false); }}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition ${
                      selectedStatus === 'ACTIVE'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <span className="text-sm font-semibold">Passable (Active)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedStatus('BLOCKED'); setConfirming(false); }}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition ${
                      selectedStatus === 'BLOCKED'
                        ? 'border-red-500 bg-red-50 text-red-950 ring-2 ring-red-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <span className="text-sm font-semibold">Blocked (No Pass)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Status Note Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Status Note / Reason
                </label>
                <span className="text-[11px] text-slate-400">Optional</span>
              </div>
              <textarea
                rows={3}
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="e.g. Air conditioning repair, classes moved to room 405 until 16:00"
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none placeholder:text-slate-400"
              />
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                This message will be shown to users in search results and room details.
              </p>
            </div>

            {confirming && <p role="alert" className="p-3 rounded-xl bg-amber-50 text-sm text-amber-900">Confirm changing corridor {target.id} from {target.currentStatus} to {selectedStatus}? This affects navigation routes.</p>}
            {errorMsg && (
              <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMsg}
              </div>
            )}
          </form>

          {/* Footer Actions */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 active:scale-95 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || (target.type === 'CORRIDOR' && selectedStatus === target.currentStatus)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:scale-95 transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Updating...' : confirming ? 'Confirm change' : 'Save changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
