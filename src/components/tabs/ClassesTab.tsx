import React, { useState } from 'react';
import { Activity, Zap, CheckCircle2 } from 'lucide-react';
import { DashboardData } from '../../types';

interface ClassesTabProps {
  onRecordClass: (data: { className: string; clientName: string; amount: number; paymentMethod: string }) => Promise<DashboardData>;
}

export const ClassesTab: React.FC<ClassesTabProps> = ({ onRecordClass }) => {
  const [className, setClassName] = useState('Trampoline');
  const [clientName, setClientName] = useState('');
  const [price, setPrice] = useState(6.00);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const presets = [
    { name: 'Trampoline', price: 6.00, icon: '🧗' },
    { name: 'Pop Pilates', price: 5.00, icon: '🧘' },
    { name: 'Zumba', price: 6.00, icon: '💃' },
    { name: 'Body Combat', price: 7.00, icon: '🥊' },
    { name: 'Pound', price: 6.00, icon: '🥁' },
  ];

  const applyPreset = (name: string, p: number) => {
    setClassName(name);
    setPrice(p);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim() || !clientName.trim() || price < 0) return;

    setLoading(true);
    setSuccessMsg(null);
    try {
      await onRecordClass({
        className,
        clientName,
        amount: price,
        paymentMethod,
      });
      setSuccessMsg(`Class ticket recorded for ${clientName} (${className} - $${price.toFixed(2)})!`);
      setClientName('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to record class pass: ' + (err.message || err));
    } finally {
      setLoading(false);
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
          <Activity className="w-4 h-4 text-purple-400" /> Fitness Classes
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Quick pass sales for group fitness classes. Automatically adds entry to class roster & sales income.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(preset.name, preset.price)}
              className="bg-slate-900 border border-slate-800 hover:border-purple-500/80 p-3.5 rounded-xl text-center cursor-pointer transition-all hover:bg-slate-800/80 group"
            >
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">{preset.icon}</div>
              <h4 className="text-xs font-bold text-slate-100">{preset.name}</h4>
              <p className="text-xs font-semibold text-purple-400 mt-0.5">${preset.price.toFixed(2)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" /> Log Class Ticket
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Class Name</label>
            <input
              type="text"
              list="class-options"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Trampoline"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
            />
            <datalist id="class-options">
              <option value="Trampoline" />
              <option value="Pop Pilates" />
              <option value="Zumba" />
              <option value="Body Combat" />
              <option value="Pound" />
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Attendee / Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Sarah Connor"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Class Fee ($)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
            >
              <option value="Cash">Cash</option>
              <option value="Baiduri">Baiduri</option>
              <option value="Bibd">Bibd</option>
              <option value="Coupon">Coupon</option>
            </select>
          </div>

          <div className="lg:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Record Class Pass & Attend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
