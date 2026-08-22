import React from 'react';
import { Calendar, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface ToolbarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onResetToday: () => void;
  onResetDatabase: () => void;
  isRefreshing: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  selectedDate,
  onDateChange,
  onResetToday,
  onResetDatabase,
}) => {
  const handleShiftDay = (days: number) => {
    try {
      const current = new Date(selectedDate);
      if (isNaN(current.getTime())) return;
      current.setDate(current.getDate() + days);
      const newIso = current.toISOString().split('T')[0];
      onDateChange(newIso);
    } catch {}
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 mb-6 bg-slate-900/80 p-2.5 sm:p-3 rounded-2xl border border-slate-800 shadow-sm backdrop-blur-sm">
      {/* Date Stepper & Picker Controls */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded-xl p-0.5 shadow-inner">
          <button
            type="button"
            onClick={() => handleShiftDay(-1)}
            className="p-2 sm:p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <input
              type="date"
              id="toolbar-date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-slate-100 text-xs sm:text-sm font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => handleShiftDay(1)}
            className="p-2 sm:p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onResetToday}
          className="px-3 py-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm min-h-[36px]"
        >
          Today
        </button>
      </div>

      {/* Database Reset Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onResetDatabase}
          className="px-2.5 py-1.5 sm:px-3 bg-rose-950/40 hover:bg-rose-900/60 active:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
          title="Reset database with demo seed records or clear to zero"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset / Seed DB</span>
          <span className="sm:hidden">Reset DB</span>
        </button>
      </div>
    </div>
  );
};

