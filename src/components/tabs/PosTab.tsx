import React, { useState } from 'react';
import { ShoppingBag, Zap, CheckCircle2 } from 'lucide-react';
import { DashboardData } from '../../types';

interface PosTabProps {
  onRecordPOS: (data: { itemName: string; qty: number; amount: number; paymentMethod: string }) => Promise<DashboardData>;
}

export const PosTab: React.FC<PosTabProps> = ({ onRecordPOS }) => {
  const [itemName, setItemName] = useState('Small Water Bottle');
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(1.00);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const totalCharge = (qty * unitPrice).toFixed(2);

  const presets = [
    { name: 'Small Water Bottle', price: 1.00, icon: '💧' },
    { name: 'Big Water Bottle', price: 2.00, icon: '🚰' },
    { name: 'Sauna', price: 3.00, icon: '🧖' },
    { name: 'Sauna (4 Pax)', price: 10.00, icon: '🧖‍♀️' },
  ];

  const applyPreset = (name: string, price: number) => {
    setItemName(name);
    setUnitPrice(price);
    setQty(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || qty <= 0 || unitPrice < 0) return;

    setLoading(true);
    setSuccessMsg(null);
    try {
      await onRecordPOS({
        itemName,
        qty,
        amount: parseFloat(totalCharge),
        paymentMethod,
      });
      setSuccessMsg(`Sale recorded! ${itemName} (x${qty}) - $${totalCharge} (${paymentMethod}) added to income ledger.`);
      setQty(1);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to record POS sale: ' + (err.message || err));
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
      {/* Presets */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" /> Quick Sale Presets
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(preset.name, preset.price)}
              className="bg-slate-900 border border-slate-800 hover:border-emerald-500/80 p-4 rounded-xl text-center cursor-pointer transition-all hover:bg-slate-800/80 group"
            >
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">{preset.icon}</div>
              <h4 className="text-sm font-bold text-slate-100">{preset.name}</h4>
              <p className="text-xs font-semibold text-emerald-400 mt-0.5">${preset.price.toFixed(2)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-emerald-400" /> Custom POS / Merchandise Sale
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Item Name / Description
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Small Water Bottle"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 1)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Unit Price ($)</label>
            <input
              type="number"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Total Charge ($)</label>
            <input
              type="number"
              step="0.01"
              value={totalCharge}
              readOnly
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm font-bold text-emerald-400 focus:outline-none"
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

          <div className="lg:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record POS Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
