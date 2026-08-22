import React, { useState } from 'react';
import { Dumbbell, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { DashboardData } from '../../types';

interface PersonalTrainerTabProps {
  onRecordPTIn: (data: { trainerName: string; clientName: string; sessions: string; amount: number; paymentMethod: string }) => Promise<DashboardData>;
  onRecordPTOut: (data: { trainerName: string; description: string; amount: number; paymentMethod: string }) => Promise<DashboardData>;
}

export const PersonalTrainerTab: React.FC<PersonalTrainerTabProps> = ({
  onRecordPTIn,
  onRecordPTOut,
}) => {
  // PT IN State
  const [inTrainer, setInTrainer] = useState('');
  const [inClient, setInClient] = useState('');
  const [inSessions, setInSessions] = useState('');
  const [inAmount, setInAmount] = useState('');
  const [inPayment, setInPayment] = useState('Cash');
  const [inLoading, setInLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // PT OUT State
  const [outTrainer, setOutTrainer] = useState('');
  const [outDesc, setOutDesc] = useState('');
  const [outAmount, setOutAmount] = useState('');
  const [outPayment, setOutPayment] = useState('Cash');
  const [outLoading, setOutLoading] = useState(false);

  const handleInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inTrainer.trim() || !inClient.trim() || !inAmount) return;

    setInLoading(true);
    setSuccessMsg(null);
    try {
      await onRecordPTIn({
        trainerName: inTrainer,
        clientName: inClient,
        sessions: inSessions,
        amount: parseFloat(inAmount) || 0,
        paymentMethod: inPayment,
      });
      setSuccessMsg(`PT Client Purchase recorded! ${inClient} (${inTrainer}) - $${parseFloat(inAmount || '0').toFixed(2)}`);
      setInTrainer('');
      setInClient('');
      setInSessions('');
      setInAmount('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to record PT sale: ' + (err.message || err));
    } finally {
      setInLoading(false);
    }
  };

  const handleOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outTrainer.trim() || !outDesc.trim() || !outAmount) return;

    setOutLoading(true);
    setSuccessMsg(null);
    try {
      await onRecordPTOut({
        trainerName: outTrainer,
        description: outDesc,
        amount: parseFloat(outAmount) || 0,
        paymentMethod: outPayment,
      });
      setSuccessMsg(`Trainer Payout recorded! ${outTrainer} - $${parseFloat(outAmount || '0').toFixed(2)}`);
      setOutTrainer('');
      setOutDesc('');
      setOutAmount('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to record PT payout: ' + (err.message || err));
    } finally {
      setOutLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-3 text-emerald-400 font-semibold text-sm animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-1 flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-emerald-400" /> Personal Trainer Management
        </h3>
        <p className="text-xs text-slate-400">
          Track client payments collected for PT sessions (Inflow) and commission payouts made to trainers (Outflow).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PT Payment IN */}
        <div className="bg-slate-900 border border-emerald-900/60 p-5 rounded-xl shadow-lg">
          <h4 className="text-sm font-bold text-emerald-400 mb-4 flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4" /> 💰 PT Payment IN (Client Purchase)
          </h4>

          <form onSubmit={handleInSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Trainer Name</label>
              <input
                type="text"
                value={inTrainer}
                onChange={(e) => setInTrainer(e.target.value)}
                placeholder="e.g. Coach Alex"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Client Name</label>
              <input
                type="text"
                value={inClient}
                onChange={(e) => setInClient(e.target.value)}
                placeholder="e.g. Mark Lee"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Sessions Count / Package</label>
              <input
                type="text"
                value={inSessions}
                onChange={(e) => setInSessions(e.target.value)}
                placeholder="e.g. 10 Sessions Package"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Total Amount Collected ($)</label>
              <input
                type="number"
                step="0.01"
                value={inAmount}
                onChange={(e) => setInAmount(e.target.value)}
                placeholder="300.00"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
              <select
                value={inPayment}
                onChange={(e) => setInPayment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="Cash">Cash</option>
                <option value="Baiduri">Baiduri</option>
                <option value="Bibd">Bibd</option>
                <option value="Coupon">Coupon</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={inLoading}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg transition-colors disabled:opacity-50 mt-2"
            >
              {inLoading ? 'Recording...' : 'Record PT Income (IN)'}
            </button>
          </form>
        </div>

        {/* PT Payment OUT */}
        <div className="bg-slate-900 border border-rose-900/60 p-5 rounded-xl shadow-lg">
          <h4 className="text-sm font-bold text-rose-400 mb-4 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" /> 💸 PT Payment OUT (Trainer Payout)
          </h4>

          <form onSubmit={handleOutSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Trainer Name</label>
              <input
                type="text"
                value={outTrainer}
                onChange={(e) => setOutTrainer(e.target.value)}
                placeholder="e.g. Coach Alex"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Payout Details / Description</label>
              <input
                type="text"
                value={outDesc}
                onChange={(e) => setOutDesc(e.target.value)}
                placeholder="e.g. 50% Commission for Mark Lee"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Amount Paid Out ($)</label>
              <input
                type="number"
                step="0.01"
                value={outAmount}
                onChange={(e) => setOutAmount(e.target.value)}
                placeholder="150.00"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
              <select
                value={outPayment}
                onChange={(e) => setOutPayment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
              >
                <option value="Cash">Cash</option>
                <option value="Baiduri">Baiduri</option>
                <option value="Bibd">Bibd</option>
                <option value="Coupon">Coupon</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={outLoading}
              className="w-full py-2.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 mt-2"
            >
              {outLoading ? 'Recording...' : 'Record Trainer Payout (OUT)'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
