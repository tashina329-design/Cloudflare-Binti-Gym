import React, { useState } from 'react';
import { DollarSign, CheckCircle2 } from 'lucide-react';
import { DashboardData } from '../../types';

interface ExpenseTabProps {
  onRecordExpense: (data: { category: string; description: string; amount: number; paymentMethod: string }) => Promise<DashboardData>;
}

export const ExpenseTab: React.FC<ExpenseTabProps> = ({ onRecordExpense }) => {
  const [category, setCategory] = useState('Stock Restock');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    setLoading(true);
    setSuccessMsg(null);
    try {
      await onRecordExpense({
        category,
        description,
        amount: parseFloat(amount) || 0,
        paymentMethod,
      });
      setSuccessMsg(`Expense recorded! $${parseFloat(amount || '0').toFixed(2)} (${category}) added to outflow ledger.`);
      setDescription('');
      setAmount('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to record expense: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg space-y-4">
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-3 text-emerald-400 font-semibold text-sm animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <DollarSign className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">Record Business Expense Outflow</h3>
          <p className="text-xs text-slate-400">Log operational costs, supplier payouts, restocks & utilities.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Expense Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
          >
            <option value="Stock Restock">Merchandise / Stock Restock</option>
            <option value="Equipment Repair">Equipment Repair</option>
            <option value="Utilities">Utilities</option>
            <option value="Salaries">Staff Salaries</option>
            <option value="Rent">Rent & Facility</option>
            <option value="Misc">Other Expense</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Water Bottle Inventory Restock"
            required
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Amount Spent ($)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-rose-500 font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
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
          disabled={loading}
          className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? 'Recording...' : 'Record Expense Outflow'}
        </button>
      </form>
    </div>
  );
};
