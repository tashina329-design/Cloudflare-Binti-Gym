import React, { useState, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Zap,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  Copy,
  Filter,
  Layers,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  Users,
  Edit2,
  X,
  Save
} from 'lucide-react';
import { DashboardData, Member } from '../../types';

interface MemberRegistrationTabProps {
  data: DashboardData;
  onRegisterMember: (data: {
    name: string;
    phone: string;
    planType: string;
    price: number;
    startDate: string;
    endDate: string;
    paymentMethod: string;
  }) => Promise<DashboardData>;
  onOpenRenewModal: (member: Member) => void;
  onDeleteMember?: (memberId: string) => void;
  onEditMember?: (
    memberId: string,
    updates: {
      name: string;
      phone: string;
      plan: string;
      startDate: string;
      endDate: string;
      status: 'active' | 'expiring' | 'expired';
    }
  ) => void;
}

// Phone & name normalization helpers for duplicate matching
const normalizePhone = (p: string = '') => {
  return p.replace(/[\s\-\(\)\+]/g, '').replace(/^673/, '').trim();
};

const normalizeName = (n: string = '') => {
  return n.toLowerCase().replace(/\s+/g, ' ').trim();
};

export const MemberRegistrationTab: React.FC<MemberRegistrationTabProps> = ({
  data,
  onRegisterMember,
  onOpenRenewModal,
  onDeleteMember,
  onEditMember,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterView, setFilterView] = useState<'all' | 'duplicates'>('all');
  
  // Edit member modal state
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'expiring' | 'expired'>('active');

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [planType, setPlanType] = useState('Standard Monthly');
  const [price, setPrice] = useState(55.00);

  const todayStr = new Date().toISOString().split('T')[0];
  const nextMonthObj = new Date();
  nextMonthObj.setMonth(nextMonthObj.getMonth() + 1);
  const nextMonthStr = nextMonthObj.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(nextMonthStr);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [ignoreDuplicateWarning, setIgnoreDuplicateWarning] = useState(false);

  const openEditModal = (m: Member) => {
    setEditingMember(m);
    setEditName(m.name);
    setEditPhone(m.phone);
    setEditPlan(m.plan);
    setEditStartDate(m.startDate || '');
    setEditEndDate(m.endDate || '');
    setEditStatus(m.status || 'active');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !onEditMember) return;
    onEditMember(editingMember.memberId, {
      name: editName.trim(),
      phone: editPhone.trim(),
      plan: editPlan.trim(),
      startDate: editStartDate.trim(),
      endDate: editEndDate.trim(),
      status: editStatus,
    });
    setSuccessMsg(`Updated member details for "${editName.trim()}" successfully!`);
    setEditingMember(null);
  };

  const handlePlanChange = (plan: string) => {
    setPlanType(plan);
    setPrice(plan === 'Student Monthly' ? 45.00 : 55.00);
  };

  // Real-time duplicate detection in the active registration form
  const formDuplicateMatches = useMemo(() => {
    const rawPhone = phone.trim();
    const rawName = name.trim();
    const normPhone = normalizePhone(rawPhone);
    const normName = normalizeName(rawName);

    if ((!normPhone || normPhone.length < 4) && (!normName || normName.length < 3)) {
      return [];
    }

    const matches: { member: Member; reason: 'phone' | 'name' | 'both' }[] = [];
    const seen = new Set<string>();

    for (const m of data.members || []) {
      const mNormPhone = normalizePhone(m.phone);
      const mNormName = normalizeName(m.name);

      const phoneMatch = normPhone.length >= 4 && (mNormPhone === normPhone || mNormPhone.includes(normPhone) || normPhone.includes(mNormPhone));
      const nameMatch = normName.length >= 3 && mNormName === normName;

      if (phoneMatch && nameMatch) {
        if (!seen.has(m.memberId)) {
          seen.add(m.memberId);
          matches.push({ member: m, reason: 'both' });
        }
      } else if (phoneMatch) {
        if (!seen.has(m.memberId)) {
          seen.add(m.memberId);
          matches.push({ member: m, reason: 'phone' });
        }
      } else if (nameMatch) {
        if (!seen.has(m.memberId)) {
          seen.add(m.memberId);
          matches.push({ member: m, reason: 'name' });
        }
      }
    }

    return matches;
  }, [name, phone, data.members]);

  // Directory-wide duplicate detection
  const duplicatePhoneMap = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const m of data.members || []) {
      const norm = normalizePhone(m.phone);
      if (norm && norm.length >= 4) {
        if (!map.has(norm)) map.set(norm, []);
        map.get(norm)!.push(m);
      }
    }
    return map;
  }, [data.members]);

  const duplicateNameMap = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const m of data.members || []) {
      const norm = normalizeName(m.name);
      if (norm && norm.length >= 2) {
        if (!map.has(norm)) map.set(norm, []);
        map.get(norm)!.push(m);
      }
    }
    return map;
  }, [data.members]);

  const duplicateMemberMap = useMemo(() => {
    const dupMap = new Map<string, { member: Member; reasons: string[] }>();

    duplicatePhoneMap.forEach((members) => {
      if (members.length > 1) {
        members.forEach((m) => {
          if (!dupMap.has(m.memberId)) {
            dupMap.set(m.memberId, { member: m, reasons: ['Phone'] });
          } else {
            const entry = dupMap.get(m.memberId)!;
            if (!entry.reasons.includes('Phone')) entry.reasons.push('Phone');
          }
        });
      }
    });

    duplicateNameMap.forEach((members) => {
      if (members.length > 1) {
        members.forEach((m) => {
          if (!dupMap.has(m.memberId)) {
            dupMap.set(m.memberId, { member: m, reasons: ['Name'] });
          } else {
            const entry = dupMap.get(m.memberId)!;
            if (!entry.reasons.includes('Name')) entry.reasons.push('Name');
          }
        });
      }
    });

    return dupMap;
  }, [duplicatePhoneMap, duplicateNameMap]);

  const duplicateMembersCount = duplicateMemberMap.size;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || price < 0) return;

    // If there's a strong duplicate match and user hasn't opted to ignore
    if (formDuplicateMatches.length > 0 && !ignoreDuplicateWarning) {
      const primaryDup = formDuplicateMatches[0].member;
      const confirmProceed = window.confirm(
        `⚠️ DUPLICATE WARNING:\n\nA member named "${primaryDup.name}" with phone "${primaryDup.phone}" already exists in the system!\n\nClick OK if you want to proceed and register as a separate duplicate entry, or Cancel to review/renew.`
      );
      if (!confirmProceed) return;
    }

    setLoading(true);
    setSuccessMsg(null);
    try {
      await onRegisterMember({
        name,
        phone,
        planType,
        price,
        startDate,
        endDate,
        paymentMethod,
      });
      setSuccessMsg(`Member registered! ${name} (${planType} - $${price.toFixed(2)}) is now active.`);
      setName('');
      setPhone('');
      setIgnoreDuplicateWarning(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to register member: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const getBadgeStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'expiring soon') return 'bg-amber-950/80 text-amber-300 border border-amber-700/50';
    if (s === 'expired') return 'bg-rose-950/80 text-rose-300 border border-rose-700/50';
    return 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50';
  };

  // Search and filter logic
  const filteredMembers = useMemo(() => {
    let list = data.members || [];

    if (filterView === 'duplicates') {
      list = list.filter((m) => duplicateMemberMap.has(m.memberId));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qPhone = normalizePhone(searchQuery);
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.phone.includes(searchQuery.trim()) ||
          (qPhone && normalizePhone(m.phone).includes(qPhone)) ||
          (m.memberId && m.memberId.toLowerCase().includes(q))
      );
    }

    return list;
  }, [data.members, filterView, searchQuery, duplicateMemberMap]);

  return (
    <div className="space-y-6">
      {/* Search Bar & Duplicates Quick Filter */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" /> Search Member Directory
          </h3>

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterView('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterView === 'all'
                  ? 'bg-slate-800 text-white border border-slate-600 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              All Members ({data.members ? data.members.length : 0})
            </button>

            <button
              onClick={() => setFilterView('duplicates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterView === 'duplicates'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                  : duplicateMembersCount > 0
                  ? 'bg-amber-950/40 text-amber-400 hover:bg-amber-900/50 border border-amber-700/40 animate-pulse'
                  : 'bg-slate-900/60 text-slate-500 border border-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Duplicates Only ({duplicateMembersCount})
            </button>
          </div>
        </div>

        <div className="relative max-w-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search by name, phone (e.g. 8712345), or Member ID..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 pl-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search Results Dropdown when user is actively typing a search */}
        {searchQuery.trim() !== '' && (
          <div className="mt-3 space-y-2 max-w-xl">
            {filteredMembers.length > 0 ? (
              filteredMembers.slice(0, 5).map((m) => {
                const isDup = duplicateMemberMap.has(m.memberId);
                const dupInfo = duplicateMemberMap.get(m.memberId);
                return (
                  <div
                    key={m.memberId}
                    className={`bg-slate-900 border ${
                      isDup ? 'border-amber-500/40 bg-amber-950/10' : 'border-slate-800'
                    } p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-md`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{m.name}</span>
                        {m.memberId && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            #{m.memberId}
                          </span>
                        )}
                        {isDup && (
                          <span className="text-[10px] font-semibold text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-600/40 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                            Duplicate ({dupInfo?.reasons.join(' & ')})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {m.phone} | {m.plan}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Start: {m.startDate || '-'} | Renew: <span className="text-slate-300 font-medium">{m.endDate}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getBadgeStyle(m.status)}`}>
                        {m.status}
                      </span>
                      <div className="mt-2">
                        <button
                          onClick={() => onOpenRenewModal(m)}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Zap className="w-3 h-3" /> Quick Renew
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-500 italic p-2">No matching members found.</p>
            )}
          </div>
        )}
      </div>

      <hr className="border-slate-800" />

      {/* New Member Registration Form */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-400" /> New Member Registration
          </h3>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Live duplicate protection active
          </span>
        </div>

        {/* Live Duplicate Warning Box in Registration Form */}
        {formDuplicateMatches.length > 0 && (
          <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-xl space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-amber-800/40 pb-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>⚠️ Duplicate Member Found ({formDuplicateMatches.length} existing record{formDuplicateMatches.length > 1 ? 's' : ''})</span>
              </div>
              <span className="text-[10px] text-amber-300/80 bg-amber-900/60 px-2 py-0.5 rounded font-mono font-bold uppercase">
                Matching {formDuplicateMatches[0].reason === 'both' ? 'Phone & Name' : formDuplicateMatches[0].reason === 'phone' ? 'Phone Number' : 'Name'}
              </span>
            </div>

            <p className="text-xs text-amber-200/90 leading-relaxed">
              A member with this {formDuplicateMatches[0].reason === 'phone' ? 'phone number' : formDuplicateMatches[0].reason === 'name' ? 'name' : 'phone number and name'} already exists in the system. You can <strong>Quick Renew</strong> their existing membership instead of creating a duplicate record:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {formDuplicateMatches.map(({ member, reason }) => (
                <div
                  key={member.memberId}
                  className="p-3 bg-slate-950/90 border border-amber-600/40 rounded-xl flex items-center justify-between gap-3 shadow-inner"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{member.name}</span>
                      {member.memberId && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          #{member.memberId}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${getBadgeStyle(member.status)}`}>
                        {member.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      📞 {member.phone} | {member.plan}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Expiry: <strong className="text-slate-200">{member.endDate}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenRenewModal(member)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0 shadow cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" /> Quick Renew
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-amber-400/80">
              <span>Tip: To extend or renew an existing member, click "Quick Renew" above.</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={ignoreDuplicateWarning}
                  onChange={(e) => setIgnoreDuplicateWarning(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Allow separate registration anyway</span>
              </label>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 8712345"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

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
            <label className="block text-xs font-semibold text-slate-400 mb-1">Fee ($)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-bold text-emerald-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Registered Date (Start)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Renew Date (Expiry)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
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

          <div className="lg:col-span-1 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 font-bold text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer ${
                formDuplicateMatches.length > 0 && !ignoreDuplicateWarning
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {loading
                ? 'Registering...'
                : formDuplicateMatches.length > 0 && !ignoreDuplicateWarning
                ? 'Register Duplicate Anyway'
                : 'Register & Save Sale'}
            </button>
          </div>
        </form>
      </div>

      {/* Members Directory Table */}
      <div className="space-y-3">
        {/* Banner if duplicates detected in whole directory */}
        {duplicateMembersCount > 0 && filterView !== 'duplicates' && (
          <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>{duplicateMembersCount} duplicate member record{duplicateMembersCount > 1 ? 's' : ''}</strong> detected in directory (sharing same phone number or full name).
              </span>
            </div>
            <button
              onClick={() => setFilterView('duplicates')}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1"
            >
              <Filter className="w-3 h-3" /> View Duplicates
            </button>
          </div>
        )}

        {filterView === 'duplicates' && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
            <span className="text-amber-300 font-bold flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Showing {filteredMembers.length} Duplicate Member Records
            </span>
            <button
              onClick={() => setFilterView('all')}
              className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              Show all members
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-200">Registered Members List</h3>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-700/50 font-bold">
              {filteredMembers.length} displayed
            </span>
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Adding via Google Sheet? Go to <strong className="text-slate-200">Google Sheets tab</strong> & click <strong className="text-sky-400">"📥 Pull / Import Members"</strong> to sync.</span>
          </p>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3">Member ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Registered Date</th>
                <th className="p-3">Renew Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((m) => {
                  const isDup = duplicateMemberMap.has(m.memberId);
                  const dupInfo = duplicateMemberMap.get(m.memberId);

                  return (
                    <tr
                      key={m.memberId}
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isDup ? 'bg-amber-950/20 hover:bg-amber-950/30' : ''
                      }`}
                    >
                      <td className="p-3 font-mono text-slate-400 text-[11px]">
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                          #{m.memberId || 'N/A'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{m.name}</span>
                          {isDup && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                              Duplicate {dupInfo?.reasons.join('+')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-slate-300 font-medium">{m.phone}</td>
                      <td className="p-3 text-slate-300">{m.plan}</td>
                      <td className="p-3 text-slate-400">{m.startDate || '-'}</td>
                      <td className="p-3 font-semibold text-slate-200">{m.endDate}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getBadgeStyle(m.status)}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => onOpenRenewModal(m)}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-bold text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Quick renew membership"
                          >
                            <Zap className="w-3 h-3" /> Renew
                          </button>
                          {onEditMember && (
                            <button
                              onClick={() => openEditModal(m)}
                              className="p-1.5 text-sky-400 hover:text-sky-200 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/50 rounded-lg transition-colors cursor-pointer"
                              title="Edit member details (Name, Phone, Plan, Dates, Status)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteMember && (
                            <button
                              onClick={() => onDeleteMember(m.memberId)}
                              className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors cursor-pointer"
                              title="Delete redundant duplicate record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                    {filterView === 'duplicates'
                      ? 'No duplicate members found! All member records are unique.'
                      : 'No registered members found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Member Cards List View */}
        <div className="md:hidden space-y-3">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((m) => {
              const isDup = duplicateMemberMap.has(m.memberId);
              const dupInfo = duplicateMemberMap.get(m.memberId);

              return (
                <div
                  key={m.memberId}
                  className={`bg-slate-900/95 border rounded-2xl p-4 shadow-sm space-y-3 transition-colors ${
                    isDup
                      ? 'border-amber-500/40 bg-amber-950/15'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Top Bar: Name + ID + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-100">{m.name}</h4>
                        <span className="bg-slate-800 text-slate-300 font-mono text-[10px] px-1.5 py-0.5 rounded">
                          #{m.memberId || 'N/A'}
                        </span>
                      </div>
                      {isDup && (
                        <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                          Duplicate {dupInfo?.reasons.join('+')}
                        </span>
                      )}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${getBadgeStyle(m.status)}`}>
                      {m.status}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Phone</span>
                      <div>
                        {m.phone ? (
                          <a
                            href={`tel:${m.phone}`}
                            className="font-mono text-sky-400 hover:underline flex items-center gap-1"
                          >
                            📞 {m.phone}
                          </a>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Plan</span>
                      <p className="font-medium text-slate-200 truncate">{m.plan}</p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Registered Date</span>
                      <p className="font-mono text-slate-400">{m.startDate || '-'}</p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Renew / Expiry</span>
                      <p className="font-mono font-bold text-slate-200">{m.endDate}</p>
                    </div>
                  </div>

                  {/* Actions Buttons Row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => onOpenRenewModal(m)}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer min-h-[38px]"
                    >
                      <Zap className="w-3.5 h-3.5" /> Quick Renew
                    </button>
                    {onEditMember && (
                      <button
                        onClick={() => openEditModal(m)}
                        className="px-3 py-2 text-sky-400 bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[38px]"
                        title="Edit details"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {onDeleteMember && (
                      <button
                        onClick={() => onDeleteMember(m.memberId)}
                        className="p-2 text-rose-400 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
                        title="Delete member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center text-slate-500 italic text-xs">
              {filterView === 'duplicates'
                ? 'No duplicate members found! All member records are unique.'
                : 'No registered members found.'}
            </div>
          )}
        </div>
      </div>

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl">
                  <Edit2 className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Member Details</h3>
                  <p className="text-[11px] text-slate-400 font-mono">ID: #{editingMember.memberId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. 8712345"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Plan Type</label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Standard Monthly">Standard Monthly ($55/mo)</option>
                    <option value="Student Monthly">Student Monthly ($45/mo)</option>
                    <option value="Walk-In">Walk-In Pass</option>
                    <option value="Class">Class / Dance Pass</option>
                    <option value="Personal Trainer">Personal Trainer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Membership Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="active">Active (Valid)</option>
                    <option value="expiring">Expiring Soon</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Start Date</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Expiry / Renew Date</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800">
                💡 Tip: When you save and next push data to Google Sheets, this member's updated details will be automatically synchronized to the <strong>Members Directory</strong> tab.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
