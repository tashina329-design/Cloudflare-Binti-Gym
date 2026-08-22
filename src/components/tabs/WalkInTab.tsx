import React, { useState } from 'react';
import { Footprints, CheckCircle2, AlertCircle, User, Phone, DollarSign, CreditCard } from 'lucide-react';
import { DashboardData } from '../../types';

interface WalkInTabProps {
  onRecordWalkIn: (data: { name: string; phone?: string; amount: number; paymentMethod: string }) => Promise<DashboardData>;
}

export const WalkInTab: React.FC<WalkInTabProps> = ({ onRecordWalkIn }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(4.00);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedPhone) {
      setErrorMsg('Visitor Name and Phone Number are both required to issue a Walk-In Pass.');
      return;
    }

    if (trimmedName.length < 2) {
      setErrorMsg('Please enter a valid visitor name (at least 2 characters).');
      return;
    }

    if (trimmedPhone.length < 4) {
      setErrorMsg('Please enter a valid contact phone number.');
      return;
    }

    if (amount < 0) {
      setErrorMsg('Entry fee cannot be negative.');
      return;
    }

    setLoading(true);
    setSuccessMsg(null);
    try {
      await onRecordWalkIn({
        name: trimmedName,
        phone: trimmedPhone,
        amount,
        paymentMethod,
      });
      setSuccessMsg(`Walk-in recorded! ${trimmedName} (${trimmedPhone}) checked in ($${amount.toFixed(2)} via ${paymentMethod}).`);
      setName('');
      setPhone('');
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      setErrorMsg('Failed to record walk-in: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-3 text-emerald-400 font-semibold text-sm animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-center gap-3 text-rose-400 font-semibold text-sm animate-fade-in shadow-lg">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
          <Footprints className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">Log Daily Pass / Walk-In</h3>
          <p className="text-xs text-slate-400">Collect walk-in entry fee and immediately check in visitor with contact details.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-sky-400" /> Visitor Name <span className="text-rose-400">*</span>
              </span>
              <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Required</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-sky-400" /> Phone Number <span className="text-rose-400">*</span>
              </span>
              <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Required</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 8712345"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition font-mono font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Entry Fee ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            required
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-emerald-400 font-black focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-sky-400" /> Payment Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-100 font-bold focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="Cash">💵 Cash</option>
            <option value="Baiduri">💳 Baiduri Card</option>
            <option value="Bibd">🏦 BIBD QuickPay</option>
            <option value="Coupon">🎟️ Coupon Voucher</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-sky-950/50 disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? 'Processing...' : '🎟️ Collect Fee & Check-In'}
        </button>
      </form>
    </div>
  );
};
