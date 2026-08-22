import React, { useState } from 'react';
import { Trash2, Pencil, X, Check, DollarSign, CreditCard } from 'lucide-react';
import { DashboardData, SalesRecord, AttendanceRecord, ExpenseRecord } from '../../types';

interface SalesTabProps {
  data: DashboardData;
  onDeleteSale?: (record: SalesRecord & { index?: number }) => void;
  onDeleteAttendance?: (record: AttendanceRecord & { index?: number }) => void;
  onDeleteExpense?: (record: ExpenseRecord & { index?: number }) => void;
  onEditSale?: (
    record: SalesRecord & { index?: number },
    updates: { paymentMethod: string; amount: number; category?: string; customer?: string; phone?: string }
  ) => void;
  onEditAttendance?: (
    record: AttendanceRecord & { index?: number },
    updates: { plan: string; status: string; name?: string; phone?: string }
  ) => void;
  onEditExpense?: (
    record: ExpenseRecord & { index?: number },
    updates: { paymentMethod: string; amount: number; category?: string; description?: string }
  ) => void;
}

export const SalesTab: React.FC<SalesTabProps> = ({
  data,
  onDeleteSale,
  onDeleteAttendance,
  onDeleteExpense,
  onEditSale,
  onEditAttendance,
  onEditExpense,
}) => {
  // Modal states for editing
  const [editingSale, setEditingSale] = useState<(SalesRecord & { index?: number }) | null>(null);
  const [salePaymentMethod, setSalePaymentMethod] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [saleCategory, setSaleCategory] = useState('');
  const [saleCustomer, setSaleCustomer] = useState('');
  const [salePhone, setSalePhone] = useState('');

  const [editingAttendance, setEditingAttendance] = useState<(AttendanceRecord & { index?: number }) | null>(null);
  const [attPlan, setAttPlan] = useState('');
  const [attStatus, setAttStatus] = useState('');
  const [attName, setAttName] = useState('');
  const [attPhone, setAttPhone] = useState('');

  const [editingExpense, setEditingExpense] = useState<(ExpenseRecord & { index?: number }) | null>(null);
  const [expPaymentMethod, setExpPaymentMethod] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('');
  const [expDescription, setExpDescription] = useState('');

  const netCash = (data.cashIn || 0) - (data.cashOut || 0);

  const getBadgeStyle = (status: string) => {
    if (status === 'Expiring Soon') return 'bg-amber-950/80 text-amber-300 border border-amber-700/50';
    if (status === 'Expired') return 'bg-rose-950/80 text-rose-300 border border-rose-700/50';
    if (status === 'Expense') return 'bg-rose-950/80 text-rose-300 border border-rose-700/50';
    return 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50';
  };

  // Open Edit Sale Modal
  const openEditSale = (s: SalesRecord, i: number) => {
    setEditingSale({ ...s, index: i });
    setSalePaymentMethod(s.payment || 'Cash');
    setSaleAmount(String(s.amount || '0'));
    setSaleCategory(s.category || 'POS');
    setSaleCustomer(s.customer || '');
    setSalePhone(s.phone && s.phone !== '-' ? s.phone : '');
  };

  const handleSaveSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale || !onEditSale) return;
    const numAmt = parseFloat(saleAmount);
    onEditSale(editingSale, {
      paymentMethod: salePaymentMethod.trim() || 'Cash',
      amount: isNaN(numAmt) ? 0 : Math.max(0, numAmt),
      category: saleCategory.trim(),
      customer: saleCustomer.trim(),
      phone: salePhone.trim() || '-',
    });
    setEditingSale(null);
  };

  // Open Edit Attendance Modal
  const openEditAttendance = (a: AttendanceRecord, i: number) => {
    setEditingAttendance({ ...a, index: i });
    setAttPlan(a.plan || 'Walk-In Pass');
    setAttStatus(a.status || 'Active');
    setAttName(a.name || '');
    setAttPhone(a.phone || '');
  };

  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendance || !onEditAttendance) return;
    onEditAttendance(editingAttendance, {
      plan: attPlan.trim() || 'Walk-In Pass',
      status: attStatus.trim() || 'Active',
      name: attName.trim(),
      phone: attPhone.trim(),
    });
    setEditingAttendance(null);
  };

  // Open Edit Expense Modal
  const openEditExpense = (exp: ExpenseRecord, i: number) => {
    setEditingExpense({ ...exp, index: i });
    setExpPaymentMethod(exp.payment || 'Cash');
    setExpAmount(String(exp.amount || '0'));
    setExpCategory(exp.category || 'Other');
    setExpDescription(exp.description || '');
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !onEditExpense) return;
    const numAmt = parseFloat(expAmount);
    onEditExpense(editingExpense, {
      paymentMethod: expPaymentMethod.trim() || 'Cash',
      amount: isNaN(numAmt) ? 0 : Math.max(0, numAmt),
      category: expCategory.trim(),
      description: expDescription.trim(),
    });
    setEditingExpense(null);
  };

  return (
    <div className="space-y-6">
      {/* Payment Method Summary */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-3">Payment Method Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-emerald-600/40 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-semibold uppercase text-emerald-400">💵 Net Cash</span>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">${netCash.toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-sky-600/40 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-semibold uppercase text-sky-400">💳 Total Baiduri Sales</span>
            <h3 className="text-2xl font-bold text-sky-400 mt-1">${(data.baiduriIn || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-purple-600/40 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-semibold uppercase text-purple-400">📱 Total BIBD Sales</span>
            <h3 className="text-2xl font-bold text-purple-400 mt-1">${(data.bibdIn || 0).toFixed(2)}</h3>
          </div>
        </div>
      </div>

      {/* Categorized Income Breakdown */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-3">Categorized Income Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">👕 POS & Sauna</span>
            <h3 className="text-lg font-bold text-slate-100 mt-1">${(data.posSalesTotal || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">💃 Classes</span>
            <h3 className="text-lg font-bold text-purple-400 mt-1">${(data.classSalesTotal || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">🏋️‍♂️ PT Payment IN</span>
            <h3 className="text-lg font-bold text-emerald-400 mt-1">${(data.ptSalesTotal || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">💸 PT Payment OUT</span>
            <h3 className="text-lg font-bold text-rose-400 mt-1">${(data.ptPayoutTotal || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">👟 Walk-In Passes</span>
            <h3 className="text-lg font-bold text-sky-400 mt-1">${(data.walkInSalesTotal || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">💳 Memberships</span>
            <h3 className="text-lg font-bold text-emerald-400 mt-1">${(data.membershipSalesTotal || 0).toFixed(2)}</h3>
          </div>
        </div>
      </div>

      {/* Income & Revenue Log */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-base font-semibold text-slate-200">Income & Revenue Log</h3>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-700/40">
            {data.todaySales?.length || 0} records
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3">Time</th>
                <th className="p-3">Staff on Duty</th>
                <th className="p-3">Category</th>
                <th className="p-3">Details</th>
                <th className="p-3">Payment Method</th>
                <th className="p-3">Amount</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.todaySales && data.todaySales.length > 0 ? (
                data.todaySales.map((s, i) => (
                  <tr key={s.id || i} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{s.time}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800/90 text-slate-300 border border-slate-700">
                        👤 {s.staff || 'Duty Staff'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                        {s.category}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-200">{s.customer}</div>
                      {s.phone && s.phone !== '-' && (
                        <div className="text-[11px] text-sky-400 font-mono flex items-center gap-1 mt-0.5">
                          <span>📞 {s.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                        {s.payment}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-emerald-400">+${Number(s.amount).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onEditSale && (
                          <button
                            type="button"
                            onClick={() => openEditSale(s, i)}
                            className="p-1.5 text-amber-400 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 rounded-lg transition-colors cursor-pointer"
                            title="Edit payment method & amount"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteSale && (
                          <button
                            type="button"
                            onClick={() => onDeleteSale({ ...s, index: i })}
                            className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors cursor-pointer"
                            title="Delete sale record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500 italic">
                    No sales recorded for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden space-y-2.5">
          {data.todaySales && data.todaySales.length > 0 ? (
            data.todaySales.map((s, i) => (
              <div
                key={s.id || i}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                      {s.time}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                      {s.category}
                    </span>
                  </div>
                  <span className="text-base font-black text-emerald-400">
                    +${Number(s.amount).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">{s.customer}</h4>
                    {s.phone && s.phone !== '-' && (
                      <a
                        href={`tel:${s.phone}`}
                        className="text-xs text-sky-400 font-mono hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        📞 {s.phone}
                      </a>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                    👤 {s.staff || 'Duty Staff'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-xs font-semibold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    💳 {s.payment}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {onEditSale && (
                      <button
                        type="button"
                        onClick={() => openEditSale(s, i)}
                        className="px-2.5 py-1 text-xs text-amber-400 bg-amber-950/50 border border-amber-800/60 rounded-lg flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    )}
                    {onDeleteSale && (
                      <button
                        type="button"
                        onClick={() => onDeleteSale({ ...s, index: i })}
                        className="p-1.5 text-rose-400 bg-rose-950/50 border border-rose-800/60 rounded-lg cursor-pointer"
                        title="Delete sale record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center text-slate-500 italic text-xs">
              No sales recorded for this date.
            </div>
          )}
        </div>
      </div>

      {/* Attendance Log */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-base font-semibold text-slate-200">Attendance Log</h3>
          <span className="text-xs font-mono text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-700/40">
            {data.todayAttendance?.length || 0} check-ins
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3">Time</th>
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Plan / Activity</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.todayAttendance && data.todayAttendance.length > 0 ? (
                data.todayAttendance.map((a, i) => (
                  <tr key={a.id || i} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{a.time}</td>
                    <td className="p-3 font-bold text-slate-100">{a.name}</td>
                    <td className="p-3 text-slate-400 font-mono">{a.phone}</td>
                    <td className="p-3 text-slate-300">{a.plan}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getBadgeStyle(a.status)}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onEditAttendance && (
                          <button
                            type="button"
                            onClick={() => openEditAttendance(a, i)}
                            className="p-1.5 text-amber-400 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 rounded-lg transition-colors cursor-pointer"
                            title="Edit attendance log"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteAttendance && (
                          <button
                            type="button"
                            onClick={() => onDeleteAttendance({ ...a, index: i })}
                            className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors cursor-pointer"
                            title="Delete attendance log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                    No check-ins recorded for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden space-y-2.5">
          {data.todayAttendance && data.todayAttendance.length > 0 ? (
            data.todayAttendance.map((a, i) => (
              <div
                key={a.id || i}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                    {a.time}
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${getBadgeStyle(a.status)}`}>
                    {a.status}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">{a.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{a.plan}</p>
                  </div>
                  {a.phone && a.phone !== '-' && (
                    <a
                      href={`tel:${a.phone}`}
                      className="text-xs text-sky-400 font-mono hover:underline inline-flex items-center gap-1 bg-sky-950/30 px-2 py-1 rounded-lg border border-sky-800/40"
                    >
                      📞 {a.phone}
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-800/80">
                  {onEditAttendance && (
                    <button
                      type="button"
                      onClick={() => openEditAttendance(a, i)}
                      className="px-2.5 py-1 text-xs text-amber-400 bg-amber-950/50 border border-amber-800/60 rounded-lg flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                  {onDeleteAttendance && (
                    <button
                      type="button"
                      onClick={() => onDeleteAttendance({ ...a, index: i })}
                      className="p-1.5 text-rose-400 bg-rose-950/50 border border-rose-800/60 rounded-lg cursor-pointer"
                      title="Delete attendance log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center text-slate-500 italic text-xs">
              No check-ins recorded for this date.
            </div>
          )}
        </div>
      </div>

      {/* Expense Outflows */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-base font-semibold text-slate-200">Expense Outflows</h3>
          <span className="text-xs font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-700/40">
            {data.todayExpenses?.length || 0} outflows
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3">Time</th>
                <th className="p-3">Staff on Duty</th>
                <th className="p-3">Category</th>
                <th className="p-3">Description</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Amount</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.todayExpenses && data.todayExpenses.length > 0 ? (
                data.todayExpenses.map((e, i) => (
                  <tr key={e.id || i} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{e.time}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800/90 text-slate-300 border border-slate-700">
                        👤 {e.staff || 'Duty Staff'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/50">
                        {e.category}
                      </span>
                    </td>
                    <td className="p-3 text-slate-200">{e.description}</td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                        {e.payment}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-rose-400">-${Number(e.amount).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onEditExpense && (
                          <button
                            type="button"
                            onClick={() => openEditExpense(e, i)}
                            className="p-1.5 text-amber-400 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 rounded-lg transition-colors cursor-pointer"
                            title="Edit expense payment & amount"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteExpense && (
                          <button
                            type="button"
                            onClick={() => onDeleteExpense({ ...e, index: i })}
                            className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors cursor-pointer"
                            title="Delete expense record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500 italic">
                    No expenses recorded for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden space-y-2.5">
          {data.todayExpenses && data.todayExpenses.length > 0 ? (
            data.todayExpenses.map((e, i) => (
              <div
                key={e.id || i}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                      {e.time}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700/50">
                      {e.category}
                    </span>
                  </div>
                  <span className="text-base font-black text-rose-400">
                    -${Number(e.amount).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-200 font-medium">{e.description}</p>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                    👤 {e.staff || 'Duty Staff'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-xs font-semibold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    💳 {e.payment}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {onEditExpense && (
                      <button
                        type="button"
                        onClick={() => openEditExpense(e, i)}
                        className="px-2.5 py-1 text-xs text-amber-400 bg-amber-950/50 border border-amber-800/60 rounded-lg flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    )}
                    {onDeleteExpense && (
                      <button
                        type="button"
                        onClick={() => onDeleteExpense({ ...e, index: i })}
                        className="p-1.5 text-rose-400 bg-rose-950/50 border border-rose-800/60 rounded-lg cursor-pointer"
                        title="Delete expense record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center text-slate-500 italic text-xs">
              No expenses recorded for this date.
            </div>
          )}
        </div>
      </div>

      {/* EDIT INCOME MODAL */}
      {editingSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Edit Income / Revenue Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSale} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Customer / Description</label>
                <input
                  type="text"
                  value={saleCustomer}
                  onChange={(e) => setSaleCustomer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Phone Number (Optional / Walk-in)</label>
                <input
                  type="tel"
                  value={salePhone}
                  onChange={(e) => setSalePhone(e.target.value)}
                  placeholder="e.g. 8712345"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Category</label>
                <select
                  value={saleCategory}
                  onChange={(e) => setSaleCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="POS">POS & Sauna</option>
                  <option value="Walk-In">Walk-In Pass</option>
                  <option value="Class">Class / Dance Pass</option>
                  <option value="PT In">PT Payment IN</option>
                  <option value="PT Out">PT Payment OUT (Payout)</option>
                  <option value="Membership">Membership Registration</option>
                  <option value="Renewal">Membership Renewal</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Payment Method</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {['Cash', 'Baiduri', 'BIBD'].map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setSalePaymentMethod(pm)}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all ${
                        salePaymentMethod.toLowerCase().includes(pm.toLowerCase())
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-950/50'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={salePaymentMethod}
                  onChange={(e) => setSalePaymentMethod(e.target.value)}
                  placeholder="Or custom payment method..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Amount ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 pl-7 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-950/40 transition"
                >
                  <Check className="w-3.5 h-3.5" /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ATTENDANCE MODAL */}
      {editingAttendance && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Edit Attendance Log</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAttendance(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Member / Guest Name</label>
                <input
                  type="text"
                  value={attName}
                  onChange={(e) => setAttName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Phone Number</label>
                <input
                  type="text"
                  value={attPhone}
                  onChange={(e) => setAttPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Plan / Activity Type</label>
                <input
                  type="text"
                  value={attPlan}
                  onChange={(e) => setAttPlan(e.target.value)}
                  placeholder="e.g. 1 Month Pass, Walk-In Pass, Zumba..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Status Badge</label>
                <select
                  value={attStatus}
                  onChange={(e) => setAttStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="Active">Active</option>
                  <option value="Walk-In Pass">Walk-In Pass</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAttendance(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-950/40 transition"
                >
                  <Check className="w-3.5 h-3.5" /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EXPENSE MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Edit Expense Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Description</label>
                <input
                  type="text"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="Utilities">Utilities & Bills</option>
                  <option value="Supplies">Supplies & Cleaning</option>
                  <option value="Equipment">Equipment Maintenance</option>
                  <option value="Inventory">Inventory Restock</option>
                  <option value="Staff Payout">Staff / Coach Payout</option>
                  <option value="Other">Other Expenses</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Payment Method</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {['Cash', 'Baiduri', 'BIBD'].map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setExpPaymentMethod(pm)}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all ${
                        expPaymentMethod.toLowerCase().includes(pm.toLowerCase())
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-950/50'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={expPaymentMethod}
                  onChange={(e) => setExpPaymentMethod(e.target.value)}
                  placeholder="Or custom payment method..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Amount ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 pl-7 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-950/40 transition"
                >
                  <Check className="w-3.5 h-3.5" /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
