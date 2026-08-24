import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarCheck2,
  Search,
  Users,
  History,
  TrendingUp,
  Clock,
  Calendar,
  Phone,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  X,
  Filter,
  Download,
  Flame,
  ArrowUpDown,
  UserCheck,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { DashboardData, Member, AttendanceRecord } from '../../types';
import { fetchAllStoresAttendance, getBruneiFormattedTime, getBruneiTodayIsoDate } from '../../lib/firebaseSync';

interface AttendanceTabProps {
  data: DashboardData;
  currentStore: string;
  availableStores?: string[];
  onDeleteAttendance?: (record: AttendanceRecord & { index?: number }) => void;
  onSelectMemberForRenewal?: (member: Member) => void;
}

interface CustomerAttendanceStats {
  memberId: string;
  name: string;
  phone: string;
  plan: string;
  status: string;
  registeredStore?: string;
  totalCheckins: number;
  thisMonthCheckins: number;
  past7DaysCheckins: number;
  todayCheckins: number;
  firstCheckinDate: string | null;
  lastCheckinTimestamp: string | null;
  lastCheckinFormatted: string | null;
  records: (AttendanceRecord & { storeName?: string })[];
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  data,
  currentStore,
  availableStores = [],
  onDeleteAttendance,
  onSelectMemberForRenewal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'expired' | 'guest'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'count_desc' | 'recent_desc' | 'name_asc'>('count_desc');
  const [viewMode, setViewMode] = useState<'customers' | 'feed'>('customers');
  
  // Cross-store attendance cache
  const [crossStoreAttendance, setCrossStoreAttendance] = useState<(AttendanceRecord & { storeName?: string })[]>([]);
  const [isLoadingCrossStore, setIsLoadingCrossStore] = useState(false);

  // Today ISO Date
  const todayIso = useMemo(() => getBruneiTodayIsoDate(), []);

  // Fetch cross-store attendance when multi-store is enabled or on mount
  useEffect(() => {
    let isMounted = true;
    const storesToFetch = availableStores.length > 0 ? availableStores : [currentStore || 'Binti Gym'];
    
    setIsLoadingCrossStore(true);
    fetchAllStoresAttendance(storesToFetch)
      .then((records) => {
        if (isMounted) {
          setCrossStoreAttendance(records);
        }
      })
      .catch((err) => console.warn('Could not load cross-store attendance:', err))
      .finally(() => {
        if (isMounted) setIsLoadingCrossStore(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentStore, availableStores]);

  // Combine live local store attendance and cross-store data
  const allAttendanceRecords = useMemo(() => {
    const recordsMap = new Map<string, AttendanceRecord & { storeName?: string }>();
    
    // First populate cross-store records
    crossStoreAttendance.forEach((rec) => {
      const key = rec.id || `${rec.timestamp}_${rec.name}_${rec.phone}`;
      recordsMap.set(key, rec);
    });

    // Merge live local store records from data.store.attendance
    const localRecords = (data.store?.attendance || []) as (AttendanceRecord & { storeName?: string })[];
    localRecords.forEach((rec) => {
      const key = rec.id || `${rec.timestamp}_${rec.name}_${rec.phone}`;
      const d = rec.timestamp ? new Date(rec.timestamp) : new Date();
      recordsMap.set(key, {
        ...rec,
        time: rec.time || getBruneiFormattedTime(isNaN(d.getTime()) ? undefined : d),
        storeName: rec.storeName || currentStore,
      });
    });

    return Array.from(recordsMap.values()).sort((a, b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tB - tA;
    });
  }, [crossStoreAttendance, data.store?.attendance, currentStore]);

  // Build Aggregated Customer Attendance Intelligence Map
  const customerStatsList = useMemo(() => {
    const statsMap = new Map<string, CustomerAttendanceStats>();

    // 1. First seed with all registered members so even members with 0 check-ins are searchable
    data.members.forEach((m) => {
      const key = (m.memberId || m.name || m.phone).trim().toLowerCase();
      statsMap.set(key, {
        memberId: m.memberId || 'N/A',
        name: m.name || 'Unnamed Member',
        phone: m.phone || '-',
        plan: m.plan || 'Membership',
        status: m.status || 'Active',
        registeredStore: m.registeredStore || currentStore,
        totalCheckins: 0,
        thisMonthCheckins: 0,
        past7DaysCheckins: 0,
        todayCheckins: 0,
        firstCheckinDate: null,
        lastCheckinTimestamp: null,
        lastCheckinFormatted: null,
        records: [],
      });
    });

    // 2. Compute date boundaries
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    // 3. Process all attendance records
    allAttendanceRecords.forEach((rec) => {
      const recMemberId = (rec.memberId || '').trim();
      const recPhone = (rec.phone || '').trim();
      const recName = (rec.name || '').trim();

      // Find matching member key
      let matchedKey: string | null = null;
      if (recMemberId && recMemberId !== 'GUEST') {
        const lowerId = recMemberId.toLowerCase();
        for (const [k, v] of statsMap.entries()) {
          if (v.memberId.toLowerCase() === lowerId) {
            matchedKey = k;
            break;
          }
        }
      }

      if (!matchedKey && recPhone && recPhone !== '-') {
        const cleanPhone = recPhone.replace(/[^0-9]/g, '');
        if (cleanPhone.length >= 4) {
          for (const [k, v] of statsMap.entries()) {
            if (v.phone.replace(/[^0-9]/g, '') === cleanPhone) {
              matchedKey = k;
              break;
            }
          }
        }
      }

      if (!matchedKey && recName) {
        const lowerName = recName.toLowerCase();
        for (const [k, v] of statsMap.entries()) {
          if (v.name.toLowerCase() === lowerName) {
            matchedKey = k;
            break;
          }
        }
      }

      // If no member exists in registry (e.g. walk-in guest or legacy checkin), create a guest entry
      if (!matchedKey) {
        matchedKey = `guest_${recName.toLowerCase()}_${recPhone}`;
        if (!statsMap.has(matchedKey)) {
          statsMap.set(matchedKey, {
            memberId: recMemberId || 'GUEST',
            name: recName || 'Walk-In Guest',
            phone: recPhone || '-',
            plan: rec.plan || 'Walk-In Pass',
            status: rec.status || 'Active',
            registeredStore: rec.storeName || currentStore,
            totalCheckins: 0,
            thisMonthCheckins: 0,
            past7DaysCheckins: 0,
            todayCheckins: 0,
            firstCheckinDate: null,
            lastCheckinTimestamp: null,
            lastCheckinFormatted: null,
            records: [],
          });
        }
      }

      const customer = statsMap.get(matchedKey)!;
      customer.records.push(rec);
      customer.totalCheckins += 1;

      if (rec.timestamp) {
        const recDate = new Date(rec.timestamp);
        if (!isNaN(recDate.getTime())) {
          // Today checkin
          const recIsoDate = rec.timestamp.split('T')[0];
          if (recIsoDate === todayIso) {
            customer.todayCheckins += 1;
          }
          // This month checkin
          if (recDate.getFullYear() === currentYear && recDate.getMonth() === currentMonth) {
            customer.thisMonthCheckins += 1;
          }
          // Past 7 days checkin
          if (recDate >= sevenDaysAgo) {
            customer.past7DaysCheckins += 1;
          }
          // First and last dates
          if (!customer.firstCheckinDate || recDate < new Date(customer.firstCheckinDate)) {
            customer.firstCheckinDate = rec.timestamp;
          }
          if (!customer.lastCheckinTimestamp || recDate > new Date(customer.lastCheckinTimestamp)) {
            customer.lastCheckinTimestamp = rec.timestamp;
            customer.lastCheckinFormatted = getBruneiFormattedTime(recDate, true);
          }
        }
      }
    });

    return Array.from(statsMap.values());
  }, [allAttendanceRecords, data.members, todayIso, currentStore]);

  // Filter & Search Logic
  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryDigits = query.replace(/[^0-9]/g, '');

    return customerStatsList
      .filter((cust) => {
        // Status filter
        if (statusFilter === 'active' && cust.status !== 'Active') return false;
        if (statusFilter === 'expiring' && cust.status !== 'Expiring Soon') return false;
        if (statusFilter === 'expired' && cust.status !== 'Expired') return false;
        if (statusFilter === 'guest' && cust.memberId !== 'GUEST' && !cust.plan.toLowerCase().includes('walk-in')) return false;

        // Store filter
        if (selectedStoreFilter !== 'all' && cust.registeredStore && cust.registeredStore !== selectedStoreFilter) {
          return false;
        }

        // Search Query filter (matches Name, Phone, Member ID, or Plan)
        if (query) {
          const matchName = cust.name.toLowerCase().includes(query);
          const matchId = cust.memberId.toLowerCase().includes(query);
          const matchPlan = cust.plan.toLowerCase().includes(query);
          const matchPhone =
            cust.phone.toLowerCase().includes(query) ||
            (queryDigits.length >= 3 && cust.phone.replace(/[^0-9]/g, '').includes(queryDigits));

          if (!matchName && !matchId && !matchPlan && !matchPhone) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'count_desc') {
          return b.totalCheckins - a.totalCheckins;
        }
        if (sortBy === 'recent_desc') {
          const tA = a.lastCheckinTimestamp ? new Date(a.lastCheckinTimestamp).getTime() : 0;
          const tB = b.lastCheckinTimestamp ? new Date(b.lastCheckinTimestamp).getTime() : 0;
          return tB - tA;
        }
        if (sortBy === 'name_asc') {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [customerStatsList, searchQuery, statusFilter, selectedStoreFilter, sortBy]);

  // Selected customer object for deep checkin breakdown
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) {
      // If user typed a specific search query that uniquely matches one person, auto-select them
      if (searchQuery.trim().length >= 3 && filteredCustomers.length === 1) {
        return filteredCustomers[0];
      }
      return null;
    }
    return customerStatsList.find(
      (c) =>
        c.memberId === selectedCustomerId ||
        c.name.toLowerCase() === selectedCustomerId.toLowerCase() ||
        c.phone === selectedCustomerId
    ) || null;
  }, [selectedCustomerId, customerStatsList, filteredCustomers, searchQuery]);

  // Filtered raw feed records
  const filteredFeedRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryDigits = query.replace(/[^0-9]/g, '');

    return allAttendanceRecords.filter((rec) => {
      // Store filter
      if (selectedStoreFilter !== 'all' && rec.storeName && rec.storeName !== selectedStoreFilter) {
        return false;
      }

      // Date preset filter
      if (dateFilter === 'today') {
        const iso = rec.timestamp?.split('T')[0];
        if (iso !== todayIso) return false;
      } else if (dateFilter === 'week') {
        if (!rec.timestamp) return false;
        const d = new Date(rec.timestamp);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (d < sevenDaysAgo) return false;
      } else if (dateFilter === 'month') {
        if (!rec.timestamp) return false;
        const d = new Date(rec.timestamp);
        const now = new Date();
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      } else if (dateFilter === 'custom') {
        if (!rec.timestamp) return false;
        const iso = rec.timestamp.split('T')[0];
        if (customStartDate && iso < customStartDate) return false;
        if (customEndDate && iso > customEndDate) return false;
      }

      // Status filter
      if (statusFilter === 'active' && rec.status !== 'Active') return false;
      if (statusFilter === 'expiring' && rec.status !== 'Expiring Soon') return false;
      if (statusFilter === 'expired' && rec.status !== 'Expired') return false;
      if (statusFilter === 'guest' && rec.memberId !== 'GUEST' && !rec.plan?.toLowerCase().includes('walk-in')) return false;

      // Search Query
      if (query) {
        const matchName = (rec.name || '').toLowerCase().includes(query);
        const matchId = (rec.memberId || '').toLowerCase().includes(query);
        const matchPlan = (rec.plan || '').toLowerCase().includes(query);
        const matchPhone =
          (rec.phone || '').toLowerCase().includes(query) ||
          (queryDigits.length >= 3 && (rec.phone || '').replace(/[^0-9]/g, '').includes(queryDigits));

        if (!matchName && !matchId && !matchPlan && !matchPhone) {
          return false;
        }
      }

      return true;
    });
  }, [allAttendanceRecords, searchQuery, selectedStoreFilter, dateFilter, todayIso, customStartDate, customEndDate, statusFilter]);

  // Overall Quick Stats
  const overallStats = useMemo(() => {
    const totalCheckinsLogged = allAttendanceRecords.length;
    const todayCount = allAttendanceRecords.filter((r) => r.timestamp?.split('T')[0] === todayIso).length;
    const uniqueCustomers = customerStatsList.filter((c) => c.totalCheckins > 0).length;
    const topCustomer = [...customerStatsList].sort((a, b) => b.totalCheckins - a.totalCheckins)[0];

    return {
      totalCheckinsLogged,
      todayCount,
      uniqueCustomers,
      topCustomerName: topCustomer && topCustomer.totalCheckins > 0 ? topCustomer.name : 'N/A',
      topCustomerCount: topCustomer ? topCustomer.totalCheckins : 0,
    };
  }, [allAttendanceRecords, todayIso, customerStatsList]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Date & Time', 'Member ID', 'Customer Name', 'Phone Number', 'Plan', 'Status', 'Store Location'];
    const rows = filteredFeedRecords.map((r) => {
      const d = r.timestamp ? new Date(r.timestamp) : new Date();
      return [
        `"${r.timestamp || ''}"`,
        `"${getBruneiFormattedTime(isNaN(d.getTime()) ? undefined : d, true)}"`,
        `"${r.memberId || ''}"`,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${r.phone || ''}"`,
        `"${r.plan || ''}"`,
        `"${r.status || ''}"`,
        `"${r.storeName || currentStore}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gym_attendance_report_${todayIso}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Expiring Soon') return 'bg-amber-950/80 text-amber-300 border border-amber-700/50';
    if (status === 'Expired') return 'bg-rose-950/80 text-rose-300 border border-rose-700/50';
    return 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Customer Attendance & Check-In Tracker
              </h2>
              <p className="text-xs text-slate-400">
                Track how many times each customer has checked in • Search by name, phone number, or Member ID
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            title="Download CSV report of filtered attendance"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
          </button>

          {/* View Toggle */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center">
            <button
              type="button"
              onClick={() => setViewMode('customers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'customers'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Customer Directory
            </button>
            <button
              type="button"
              onClick={() => setViewMode('feed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'feed'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Live Check-In Feed
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 sm:p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Today's Check-Ins</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">{overallStats.todayCount}</span>
            <span className="text-xs text-slate-400">sessions</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 sm:p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Logged Check-Ins</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-sky-400">{overallStats.totalCheckinsLogged}</span>
            <span className="text-xs text-slate-400">all-time</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 sm:p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Visiting Customers</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{overallStats.uniqueCustomers}</span>
            <span className="text-xs text-slate-400">unique patrons</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 sm:p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-rose-400" /> Top Regular Visitor
          </span>
          <div className="mt-1">
            <p className="text-sm font-bold text-white truncate">{overallStats.topCustomerName}</p>
            <p className="text-xs text-emerald-400 font-bold">{overallStats.topCustomerCount} total check-ins</p>
          </div>
        </div>
      </div>

      {/* Main Search & Filters Bar */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer by name (e.g. John), phone number (e.g. 8881234), or Member ID..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort & Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Members</option>
              <option value="expiring">Expiring Soon</option>
              <option value="expired">Expired Members</option>
              <option value="guest">Walk-In Passes</option>
            </select>

            {/* Date Filter (Feed view or custom filter) */}
            {viewMode === 'feed' && (
              <select
                value={dateFilter}
                onChange={(e: any) => setDateFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All-Time</option>
                <option value="today">Today</option>
                <option value="week">Past 7 Days</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            )}

            {/* Store Filter (if multi-store) */}
            {availableStores.length > 1 && (
              <select
                value={selectedStoreFilter}
                onChange={(e) => setSelectedStoreFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Stores</option>
                {availableStores.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}

            {/* Sort order (in Directory View) */}
            {viewMode === 'customers' && (
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="count_desc">Sort: Most Check-Ins (🔥)</option>
                <option value="recent_desc">Sort: Latest Visit (⏱️)</option>
                <option value="name_asc">Sort: Customer Name (A-Z)</option>
              </select>
            )}
          </div>
        </div>

        {/* Custom date range inputs */}
        {viewMode === 'feed' && dateFilter === 'custom' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400 font-semibold">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200"
            />
            <span className="text-slate-400 font-semibold">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200"
            />
          </div>
        )}

        {/* Quick Result Indicator */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>
            Showing{' '}
            <strong className="text-emerald-400">
              {viewMode === 'customers' ? filteredCustomers.length : filteredFeedRecords.length}
            </strong>{' '}
            {viewMode === 'customers' ? 'customer records' : 'check-in logs'}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
          {isLoadingCrossStore && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" /> Syncing branch records...
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEEP DIVE CUSTOMER ATTENDANCE PROFILE (Shown when a customer is selected) */}
      {/* ========================================================================= */}
      {selectedCustomer && (
        <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in duration-200 relative">
          <button
            type="button"
            onClick={() => setSelectedCustomerId(null)}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            title="Close customer profile"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Profile Header & Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-xl sm:text-2xl font-black text-white">{selectedCustomer.name}</span>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(
                    selectedCustomer.status
                  )}`}
                >
                  {selectedCustomer.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1 font-mono text-emerald-400">
                  <CreditCard className="w-3.5 h-3.5" /> ID: {selectedCustomer.memberId}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-sky-400" /> {selectedCustomer.phone}
                </span>
                <span className="flex items-center gap-1 text-slate-300">
                  Plan: <strong className="text-white">{selectedCustomer.plan}</strong>
                </span>
                {selectedCustomer.registeredStore && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Building2 className="w-3.5 h-3.5" /> {selectedCustomer.registeredStore}
                  </span>
                )}
              </div>
            </div>

            {/* Check-In Summary Badge */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-emerald-950/80 border border-emerald-500/40 p-3 sm:p-4 rounded-2xl text-center shadow-lg">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                  Total Check-Ins
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-300">
                  {selectedCustomer.totalCheckins}
                </span>
                <span className="text-[10px] text-emerald-400/80 block">times recorded</span>
              </div>
            </div>
          </div>

          {/* Quick Frequency Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-800">
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase">This Month</span>
              <p className="text-lg font-black text-emerald-400 mt-0.5">{selectedCustomer.thisMonthCheckins} visits</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Past 7 Days</span>
              <p className="text-lg font-black text-sky-400 mt-0.5">{selectedCustomer.past7DaysCheckins} visits</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Today's Visits</span>
              <p className="text-lg font-black text-amber-400 mt-0.5">{selectedCustomer.todayCheckins} times</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Last Check-In</span>
              <p className="text-xs font-bold text-slate-200 mt-1 truncate">
                {selectedCustomer.lastCheckinFormatted || 'No check-ins yet'}
              </p>
            </div>
          </div>

          {/* Detailed Visit Timeline for this member */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-400" /> Complete Check-In Session History ({selectedCustomer.records.length})
              </h4>
              {selectedCustomer.status === 'Expired' && onSelectMemberForRenewal && (
                <button
                  type="button"
                  onClick={() => {
                    const memberObj = data.members.find((m) => m.memberId === selectedCustomer.memberId);
                    if (memberObj) onSelectMemberForRenewal(memberObj);
                  }}
                  className="px-3 py-1 bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Renew Membership
                </button>
              )}
            </div>

            {selectedCustomer.records.length === 0 ? (
              <div className="p-6 bg-slate-950/50 rounded-xl text-center text-slate-400 text-xs border border-dashed border-slate-800">
                No check-in sessions recorded yet for {selectedCustomer.name}.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {selectedCustomer.records
                  .sort((a, b) => {
                    const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return tB - tA;
                  })
                  .map((rec, idx) => {
                    const d = rec.timestamp ? new Date(rec.timestamp) : new Date();
                    const dayOfWeek = isNaN(d.getTime())
                      ? ''
                      : d.toLocaleDateString('en-GB', { weekday: 'short' });
                    const formattedDate = isNaN(d.getTime())
                      ? 'N/A'
                      : getBruneiFormattedTime(d, true);

                    return (
                      <div
                        key={rec.id || idx}
                        className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center font-mono text-[10px] font-bold text-emerald-400 shrink-0">
                            <span>#{selectedCustomer.records.length - idx}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-100">{formattedDate}</span>
                              {dayOfWeek && (
                                <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                  {dayOfWeek}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span>Plan: {rec.plan || selectedCustomer.plan}</span>
                              <span>•</span>
                              <span>Location: {rec.storeName || currentStore}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${getStatusBadge(
                              rec.status || selectedCustomer.status
                            )}`}
                          >
                            {rec.status || 'Active'}
                          </span>
                          {onDeleteAttendance && (
                            <button
                              type="button"
                              onClick={() => onDeleteAttendance(rec)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                              title="Delete check-in entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: CUSTOMER DIRECTORY & TOTAL CHECK-IN COUNT RANKINGS                */}
      {/* ========================================================================= */}
      {viewMode === 'customers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" /> Customer Check-In Leaderboard & Frequency
            </h3>
            <span className="text-xs text-slate-400">Click any customer to inspect their check-in log</span>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-200">No customer matches found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Try searching with a different name, phone number, or clearing status filters.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3.5">Customer / Member</th>
                      <th className="px-4 py-3.5">Phone Number</th>
                      <th className="px-4 py-3.5">Plan Type</th>
                      <th className="px-4 py-3.5 text-center">Total Check-Ins</th>
                      <th className="px-4 py-3.5 text-center">This Month</th>
                      <th className="px-4 py-3.5">Last Check-In</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredCustomers.map((cust) => {
                      const isSelected = selectedCustomer?.memberId === cust.memberId || selectedCustomer?.name === cust.name;

                      return (
                        <tr
                          key={cust.memberId + cust.name}
                          onClick={() => setSelectedCustomerId(cust.memberId || cust.name)}
                          className={`hover:bg-slate-800/60 transition cursor-pointer ${
                            isSelected ? 'bg-emerald-950/30' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-100 flex items-center gap-2">
                              <span>{cust.name}</span>
                              {cust.totalCheckins >= 20 && (
                                <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                                  🔥 VIP Regular
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              ID: {cust.memberId}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-300">{cust.phone}</td>
                          <td className="px-4 py-3.5 text-slate-300">{cust.plan}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-600/40 font-mono">
                              {cust.totalCheckins} times
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-sky-400">
                            {cust.thisMonthCheckins}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                            {cust.lastCheckinFormatted || 'Never'}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(
                                cust.status
                              )}`}
                            >
                              {cust.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomerId(cust.memberId || cust.name);
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 text-xs font-bold rounded-lg transition cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>History</span> <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredCustomers.map((cust) => {
                  const isSelected = selectedCustomer?.memberId === cust.memberId || selectedCustomer?.name === cust.name;

                  return (
                    <div
                      key={cust.memberId + cust.name}
                      onClick={() => setSelectedCustomerId(cust.memberId || cust.name)}
                      className={`bg-slate-900 border rounded-2xl p-4 space-y-3 cursor-pointer transition ${
                        isSelected ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            {cust.name}
                            {cust.totalCheckins >= 20 && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                                VIP
                              </span>
                            )}
                          </h4>
                          <span className="text-xs font-mono text-slate-400">ID: {cust.memberId} • {cust.phone}</span>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                            {cust.totalCheckins} check-ins
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80 text-slate-400">
                        <span>Plan: <strong className="text-slate-200">{cust.plan}</strong></span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${getStatusBadge(cust.status)}`}>
                          {cust.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Last: {cust.lastCheckinFormatted || 'Never'}</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                          View details &rarr;
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: LIVE RAW ATTENDANCE FEED / LOGS                                   */}
      {/* ========================================================================= */}
      {viewMode === 'feed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" /> Chronological Check-In Event Stream
            </h3>
            <span className="text-xs text-slate-400">
              Sorted newest to oldest
            </span>
          </div>

          {filteredFeedRecords.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                <CalendarCheck2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-200">No attendance entries found for current filters</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Try selecting "All-Time" or searching another customer name.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Check-In Time</th>
                    <th className="px-4 py-3.5">Customer Name</th>
                    <th className="px-4 py-3.5">Phone Number</th>
                    <th className="px-4 py-3.5">Membership Plan</th>
                    <th className="px-4 py-3.5">Store Branch</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    {onDeleteAttendance && <th className="px-4 py-3.5 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredFeedRecords.map((rec, idx) => {
                    const d = rec.timestamp ? new Date(rec.timestamp) : new Date();
                    const formattedTime = getBruneiFormattedTime(isNaN(d.getTime()) ? undefined : d, true);

                    return (
                      <tr
                        key={rec.id || idx}
                        onClick={() => setSelectedCustomerId(rec.memberId || rec.name)}
                        className="hover:bg-slate-800/60 transition cursor-pointer"
                      >
                        <td className="px-4 py-3.5 font-mono text-emerald-400 font-bold">
                          {formattedTime}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{rec.name}</span>
                          </div>
                          {rec.memberId && rec.memberId !== 'GUEST' && (
                            <span className="text-[10px] font-mono text-slate-400">
                              ID: {rec.memberId}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-300">{rec.phone || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-300">{rec.plan || 'Standard'}</td>
                        <td className="px-4 py-3.5 text-slate-400">{rec.storeName || currentStore}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${getStatusBadge(
                              rec.status || 'Active'
                            )}`}
                          >
                            {rec.status || 'Active'}
                          </span>
                        </td>
                        {onDeleteAttendance && (
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteAttendance(rec);
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                              title="Delete this record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
