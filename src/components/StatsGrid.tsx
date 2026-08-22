import React from 'react';
import { DollarSign, TrendingDown, Wallet, Users, AlertTriangle } from 'lucide-react';
import { DashboardData } from '../types';

interface StatsGridProps {
  data: DashboardData;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ data }) => {
  const totalRev = Number(data?.totalRevenue) || 0;
  const totalExp = Number(data?.totalExpenses) || 0;
  const netInc = Number(data?.netIncome) || 0;
  const checkinCnt = Number(data?.checkinCount) || 0;
  const expiringCnt = Number(data?.expiringCount) || 0;
  const isNetPositive = netInc >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3.5 mb-6">
      {/* Gross Sales */}
      <div className="bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Gross Sales</span>
          <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <h2 className="text-lg sm:text-2xl font-black text-emerald-400 tracking-tight">
          ${totalRev.toFixed(2)}
        </h2>
      </div>

      {/* Expenses */}
      <div className="bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Expenses</span>
          <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400">
            <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <h2 className="text-lg sm:text-2xl font-black text-rose-400 tracking-tight">
          ${totalExp.toFixed(2)}
        </h2>
      </div>

      {/* Net Profit */}
      <div className="bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Net Profit</span>
          <div className={`p-1 rounded-lg ${isNetPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <h2 className={`text-lg sm:text-2xl font-black tracking-tight ${isNetPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          ${netInc.toFixed(2)}
        </h2>
      </div>

      {/* Check-Ins */}
      <div className="bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Check-Ins</span>
          <div className="p-1 rounded-lg bg-sky-500/10 text-sky-400">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <h2 className="text-lg sm:text-2xl font-black text-sky-400 tracking-tight">
          {checkinCnt}
        </h2>
      </div>

      {/* Expiring Soon */}
      <div className="bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-amber-500/30 shadow-sm col-span-2 md:col-span-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-amber-400/90 mb-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-400">Expiring Soon</span>
          <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <h2 className="text-lg sm:text-2xl font-black text-amber-400 tracking-tight">
          {expiringCnt}
        </h2>
      </div>
    </div>
  );
};

