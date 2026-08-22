import React, { useState } from 'react';
import { StaffShift, DashboardData } from '../types';
import {
  UserCheck,
  Clock,
  X,
  Play,
  LogOut,
  Briefcase,
  TrendingUp,
} from 'lucide-react';

interface StaffShiftModalProps {
  isOpen: boolean;
  activeShift: StaffShift | null;
  dashboardData: DashboardData;
  currentStore?: string;
  onStartShift: (shift: StaffShift) => void;
  onEndShift: () => void;
  onClose: () => void;
}

const SHIFT_TYPES = [
  'Morning shift',
  'Afternoon shift',
  'Custom',
];

export const StaffShiftModal: React.FC<StaffShiftModalProps> = ({
  isOpen,
  activeShift,
  dashboardData,
  currentStore = 'Binti Gym',
  onStartShift,
  onEndShift,
  onClose,
}) => {
  // Form states for Starting Shift
  const [staffName, setStaffName] = useState(() => {
    return localStorage.getItem('last_staff_name') || '';
  });
  const [shiftOption, setShiftOption] = useState<string>('Morning shift');
  const [customShiftTitle, setCustomShiftTitle] = useState<string>('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalStaffName = staffName.trim() || 'Staff On Duty';
    localStorage.setItem('last_staff_name', finalStaffName);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const resolvedShiftTitle =
      shiftOption === 'Custom'
        ? customShiftTitle.trim() || 'Custom Shift'
        : shiftOption;

    const newShift: StaffShift = {
      id: 'shift-' + Date.now(),
      staffName: finalStaffName,
      shiftTitle: resolvedShiftTitle,
      startTime: timeStr,
      startTimestamp: Date.now(),
      notes,
    };

    onStartShift(newShift);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5 border-b border-slate-800 pb-4">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Staff Shift Management</h2>
            <p className="text-xs text-slate-400">Terminal Access & Shift Duty Register — <span className="text-emerald-400 font-bold">{currentStore}</span></p>
          </div>
        </div>

        {/* Active Shift Card or Start Shift Form */}
        {activeShift ? (
          <div className="space-y-4">
            {/* Active Shift Details */}
            <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                Active Shift
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 text-lg font-bold">
                  👤
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">{activeShift.staffName}</h3>
                  <p className="text-xs text-emerald-400 font-semibold">{activeShift.shiftTitle}</p>
                </div>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs border-t border-slate-800/80 mt-2">
                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-sky-400" /> Shift Started At
                </div>
                <div className="text-sm font-bold text-slate-100 mt-1">{activeShift.startTime}</div>
              </div>

              {/* Financial Shift Overview */}
              <div className="mt-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                <div className="text-[11px] font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Today's Terminal Totals
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Total Sales:</span>
                    <span className="font-bold text-emerald-400 ml-1.5">${dashboardData.totalRevenue.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Cash In:</span>
                    <span className="font-bold text-amber-400 ml-1.5">${dashboardData.cashIn.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* End Shift Button */}
            <button
              type="button"
              onClick={onEndShift}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> End Shift & Clock Out
            </button>
          </div>
        ) : (
          /* Start Shift Form */
          <form onSubmit={handleStartSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Enter Staff Member Name
              </label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="e.g. Front Desk Staff"
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-sky-400" /> Shift Duty Type
              </label>
              <div className="space-y-2">
                <select
                  value={shiftOption}
                  onChange={(e) => setShiftOption(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="Morning shift">Morning shift</option>
                  <option value="Afternoon shift">Afternoon shift</option>
                  <option value="Custom">Custom / Editable Shift...</option>
                </select>

                {shiftOption === 'Custom' && (
                  <div className="space-y-1 animate-in fade-in">
                    <input
                      type="text"
                      value={customShiftTitle}
                      onChange={(e) => setCustomShiftTitle(e.target.value)}
                      placeholder="Type custom shift duty (e.g. Evening shift, Night shift)..."
                      className="w-full bg-slate-950 border border-sky-500/50 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-sky-300 font-bold focus:outline-none placeholder:text-slate-600"
                      required
                    />
                    <span className="text-[10px] text-slate-400 block px-1">
                      Enter any custom duty shift title for your gym schedule.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Current Time
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 font-mono">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all mt-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" /> Start Staff Shift
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
