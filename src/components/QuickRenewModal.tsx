import React, { useState, useEffect } from 'react';
import { Zap, X, CheckCircle2 } from 'lucide-react';
import { Member, DashboardData } from '../types';

interface QuickRenewModalProps {
  member: Member | null;
  onClose: () => void;
  onConfirmRenew: (data: {
    memberId: string;
    planType: string;
    price: number;
    paymentMethod: string;
  }) => Promise<DashboardData>;
}

export const QuickRenewModal: React.FC<QuickRenewModalProps> = ({
  member,
  onClose,
  onConfirmRenew,
}) => {
  const [planType, setPlanType] = useState(member?.plan || 'Standard Monthly');
  const [price, setPrice] = useState(member?.plan === 'Student Monthly' ? 45.00 : 55.00);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (member) {
      setPlanType(member.plan || 'Standard Monthly');
      setPrice(member.plan === 'Student Monthly' ? 45.00 : 55.00);
    }
  }, [member]);

  if (!member) return null;

  const handlePlanChange = (plan: string) => {
    setPlanType(plan);
    setPrice(plan === 'Student Monthly' ? 45.00 : 55.00);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (price < 0) return;

    setLoading(true);
    try {
      await onConfirmRenew({
        memberId: member.memberId,
        planType,
        price,
        paymentMethod,
      });
      onClose();
    } catch (err: any) {
      alert('Renewal failed: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-emerald-400 mb-1">
          <Zap className="w-5 h-5" />
          <h3 className="text-lg font-bold text-slate-100">Quick Member Renewal</h3>
        </div>

        <p className="text-sm font-semibold text-emerald-400 mb-4">
          Member: <span className="text-slate-100 font-bold">{member.name}</span> ({member.phone})
        </p>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Plan Type</label>
            <select
              value={planType}
              onChange={(e) => handlePlanChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="Standard Monthly">Standard Monthly ($55/mo)</option>
              <option value="Student Monthly">Student Monthly ($45/mo)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Renewal Fee ($)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="Cash">Cash</option>
              <option value="Baiduri">Baiduri</option>
              <option value="Bibd">Bibd</option>
              <option value="Coupon">Coupon</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? 'Processing...' : 'Confirm & Renew'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
