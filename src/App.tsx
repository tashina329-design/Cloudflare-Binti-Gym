import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, AlertTriangle, Lock, Play, UserCheck, Bell, X, AlertCircle, Monitor } from 'lucide-react';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { StatsGrid } from './components/StatsGrid';
import { NavigationTabs, TabId } from './components/NavigationTabs';
import { SalesTab } from './components/tabs/SalesTab';
import { PhoneCheckinTab } from './components/tabs/PhoneCheckinTab';
import { PosTab } from './components/tabs/PosTab';
import { ClassesTab } from './components/tabs/ClassesTab';
import { PersonalTrainerTab } from './components/tabs/PersonalTrainerTab';
import { WalkInTab } from './components/tabs/WalkInTab';
import { MemberRegistrationTab } from './components/tabs/MemberRegistrationTab';
import { ExpenseTab } from './components/tabs/ExpenseTab';
import { GoogleSheetsTab } from './components/tabs/GoogleSheetsTab';
import { QuickRenewModal } from './components/QuickRenewModal';
import { EntranceCheckInView } from './components/EntranceCheckInView';
import { StaffShiftModal } from './components/StaffShiftModal';
import { BusinessAuthModal } from './components/BusinessAuthModal';
import { ResetDatabaseModal } from './components/ResetDatabaseModal';
import { InstallPrompt } from './components/InstallPrompt';
import { playSelfCheckinNotificationSound } from './lib/soundNotification';
import {
  subscribeFirestoreBusiness,
  dbCheckInPhone,
  dbCheckInId,
  dbRecordWalkIn,
  dbRecordPOS,
  dbRecordClass,
  dbRecordPTIn,
  dbRecordPTOut,
  dbRecordExpense,
  dbRegisterMember,
  dbRenewMember,
  dbDeleteSale,
  dbDeleteAttendance,
  dbDeleteExpense,
  dbDeleteMember,
  dbUpdateSale,
  dbUpdateAttendance,
  dbUpdateExpense,
  dbUpdateMember,
  dbStartShift,
  dbEndShift,
  dbResetDemoData,
  dbClearAllDataToZero,
  fetchStoresFromCloud,
  getBruneiTodayIsoDate,
  SyncEventPayload,
} from './lib/firebaseSync';

import { DashboardData, Member, CheckInResponse, StaffShift, PushNotification } from './types';

function getStoredActiveShift(businessName?: string): StaffShift | null {
  try {
    const clean = (businessName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_') || 'binti_gym';
    const stored = localStorage.getItem(`gym_active_shift_${clean}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && parsed.staffName) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to get stored active shift:', e);
  }
  return null;
}

function saveStoredActiveShift(shift: StaffShift | null, businessName?: string) {
  try {
    const clean = (businessName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_') || 'binti_gym';
    if (shift) {
      localStorage.setItem(`gym_active_shift_${clean}`, JSON.stringify(shift));
    } else {
      localStorage.removeItem(`gym_active_shift_${clean}`);
    }
  } catch (e) {
    console.warn('Failed to save stored active shift:', e);
  }
}

export function App() {
  const getTodayIsoDate = () => getBruneiTodayIsoDate();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayIsoDate());
  const [activeTab, setActiveTab] = useState<TabId>('sales');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckinMode, setIsCheckinMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isUrlKiosk =
        params.get('p') === 'checkin' ||
        params.get('mode') === 'checkin' ||
        window.location.hash === '#checkin' ||
        window.location.pathname === '/checkin';
      if (isUrlKiosk) return true;

      try {
        const savedMode = localStorage.getItem('gym_terminal_mode');
        if (savedMode === 'kiosk') return true;
      } catch {}
    }
    return false;
  });

  const handleEnterCheckinMode = () => {
    setIsCheckinMode(true);
    try {
      localStorage.setItem('gym_terminal_mode', 'kiosk');
    } catch {}
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'checkin');
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleExitCheckinMode = () => {
    setIsCheckinMode(false);
    try {
      localStorage.setItem('gym_terminal_mode', 'staff');
    } catch {}
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      url.searchParams.delete('p');
      if (url.hash === '#checkin') {
        url.hash = '';
      }
      const cleanPath = url.pathname + (url.search ? url.search : '');
      window.history.replaceState(null, '', cleanPath);
    }
  };

  const [syncStatus, setSyncStatus] = useState<'connected' | 'reconnecting' | 'offline'>('connected');

  // Listen for URL parameter changes or hash changes for QR Code entrance terminal
  useEffect(() => {
    const checkUrlMode = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('p') === 'checkin' || params.get('mode') === 'checkin' || window.location.hash === '#checkin') {
          handleEnterCheckinMode();
        }
      }
    };

    checkUrlMode();
    window.addEventListener('popstate', checkUrlMode);
    window.addEventListener('hashchange', checkUrlMode);
    return () => {
      window.removeEventListener('popstate', checkUrlMode);
      window.removeEventListener('hashchange', checkUrlMode);
    };
  }, []);

  // Multi-Store Terminal State (persisted in localStorage)
  const [currentBusinessName, setCurrentBusinessName] = useState<string>(() => {
    try {
      return localStorage.getItem('current_business_name') || '';
    } catch {
      return '';
    }
  });

  const [currentBusinessPin, setCurrentBusinessPin] = useState<string>(() => {
    try {
      return localStorage.getItem('current_business_pin') || '';
    } catch {
      return '';
    }
  });

  const [showBusinessAuthModal, setShowBusinessAuthModal] = useState<boolean>(
    () => !currentBusinessName || !currentBusinessPin
  );

  const [currentStore, setCurrentStore] = useState<string>(() => {
    return currentBusinessName || localStorage.getItem('current_store_name') || 'Binti Gym';
  });

  const [availableStores, setAvailableStores] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gym_available_stores');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    fetchStoresFromCloud().then((stores) => {
      if (stores && stores.length > 0) {
        setAvailableStores(stores);
        try {
          localStorage.setItem('gym_available_stores', JSON.stringify(stores));
        } catch {}
      }
    });
  }, []);

  const handleBusinessAuthenticated = (bizName: string, pin: string) => {
    setCurrentBusinessName(bizName);
    setCurrentBusinessPin(pin);
    setCurrentStore(bizName);
    try {
      localStorage.setItem('current_store_name', bizName);
      localStorage.setItem('current_business_name', bizName);
      localStorage.setItem('current_business_pin', pin);
    } catch {}
    setShowBusinessAuthModal(false);
  };

  const handleLogout = () => {
    setCurrentBusinessName('');
    setCurrentBusinessPin('');
    try {
      localStorage.removeItem('current_business_name');
      localStorage.removeItem('current_business_pin');
      localStorage.removeItem('current_store_name');
    } catch {}
    setShowBusinessAuthModal(true);
  };

  // Terminal Push Notifications State
  const [notifications, setNotifications] = useState<PushNotification[]>(() => {
    try {
      const stored = localStorage.getItem('gym_terminal_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [activePushBanner, setActivePushBanner] = useState<PushNotification | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('gym_sound_enabled');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleSound = () => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gym_sound_enabled', String(next));
      } catch {}
      return next;
    });
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    setActivePushBanner(null);
    try {
      localStorage.removeItem('gym_terminal_notifications');
    } catch {}
  };

  const handleClearNotificationItem = (id: string) => {
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== id);
      try {
        localStorage.setItem('gym_terminal_notifications', JSON.stringify(filtered));
      } catch {}
      return filtered;
    });
    setActivePushBanner((current) => (current?.id === id ? null : current));
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      try {
        localStorage.setItem('gym_terminal_notifications', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setActivePushBanner((current) => (current?.id === id ? null : current));
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      try {
        localStorage.setItem('gym_terminal_notifications', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setActivePushBanner(null);
  };

  const triggerSelfCheckinNotification = (
    title: string,
    message: string,
    memberName?: string,
    memberId?: string,
    type: 'checkin' | 'walkin' | 'expired' | 'blocked' | 'info' = 'checkin'
  ) => {
    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const newNotif: PushNotification = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title,
      message,
      timestamp: timeStr,
      memberName,
      memberId,
      type,
      read: false,
    };

    // Sound chime notification if enabled
    if (isSoundEnabled) {
      if (type === 'expired' || type === 'blocked') {
        playSelfCheckinNotificationSound('expired');
      } else if (type === 'walkin') {
        playSelfCheckinNotificationSound('sale');
      } else {
        playSelfCheckinNotificationSound('checkin');
      }
    }

    setNotifications((prev) => {
      const updated = [newNotif, ...prev.slice(0, 49)];
      try {
        localStorage.setItem('gym_terminal_notifications', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setActivePushBanner(newNotif);

    // Auto dismiss banner after 6s (or 8s for expired warning)
    const timeoutDuration = type === 'expired' || type === 'blocked' ? 8000 : 6000;
    setTimeout(() => {
      setActivePushBanner((current) => (current?.id === newNotif.id ? null : current));
    }, timeoutDuration);
  };

  const handleTestNotification = () => {
    triggerSelfCheckinNotification(
      'Self Check-In (Test)',
      'Member test check-in processed successfully. Cloud database synchronized.',
      'Ahmad Syazwan (Test Member)',
      'MEM-099',
      'checkin'
    );
  };

  const [activeShift, setActiveShift] = useState<StaffShift | null>(() => getStoredActiveShift(currentStore));
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [dismissShiftBanner, setDismissShiftBanner] = useState<boolean>(false);

  // Quick renew modal state
  const [renewMember, setRenewMember] = useState<Member | null>(null);

  // Database reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'sale' | 'attendance' | 'expense' | 'member';
    title: string;
    subtitle: string;
    data: any;
  } | null>(null);

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    posSalesTotal: 0,
    classSalesTotal: 0,
    ptSalesTotal: 0,
    ptPayoutTotal: 0,
    walkInSalesTotal: 0,
    membershipSalesTotal: 0,
    checkinCount: 0,
    expiringCount: 0,
    todayAttendance: [],
    todaySales: [],
    todayExpenses: [],
    members: [],
    cashIn: 0,
    cashOut: 0,
    baiduriIn: 0,
    bibdIn: 0,
    ptDetails: [],
    viewDate: getTodayIsoDate(),
  });

  // Real-Time Firestore Single Source of Truth Subscription
  useEffect(() => {
    if (!currentStore) return;

    const unsubscribe = subscribeFirestoreBusiness(
      currentStore,
      (liveDashboard: DashboardData, eventData?: SyncEventPayload, isRemote?: boolean) => {
        setDashboardData(liveDashboard);
        if (liveDashboard.store?.activeShift !== undefined) {
          setActiveShift(liveDashboard.store.activeShift);
        }
        if (liveDashboard.store?.availableStores && liveDashboard.store.availableStores.length > 0) {
          setAvailableStores(liveDashboard.store.availableStores);
        }

        // If change came from another device/terminal in real-time, play audio chime & show notification
        if (isRemote && eventData) {
          const title = eventData.title || '⚡ Live Cloud Sync Alert';
          const message = eventData.message || 'Data updated in real time from another terminal.';
          const timeStr =
            eventData.timestamp ||
            new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            });

          const isExpiredEvent =
            eventData.type === 'expired' ||
            eventData.type === 'blocked' ||
            title.toLowerCase().includes('expired') ||
            message.toLowerCase().includes('expired');

          if (isSoundEnabled) {
            playSelfCheckinNotificationSound(
              isExpiredEvent ? 'expired' : eventData.type === 'pos' || eventData.type === 'walkin' ? 'sale' : 'checkin'
            );
          }

          const newNotif: PushNotification = {
            id: 'notif-' + Date.now(),
            title,
            message,
            timestamp: timeStr,
            memberName: eventData.memberName,
            memberId: eventData.memberId,
            type: isExpiredEvent ? 'expired' : eventData.type === 'walkin' ? 'walkin' : 'checkin',
            read: false,
          };

          setNotifications((prev) => {
            const updated = [newNotif, ...prev.slice(0, 49)];
            try {
              localStorage.setItem('gym_terminal_notifications', JSON.stringify(updated));
            } catch {}
            return updated;
          });
          setActivePushBanner(newNotif);

          const bannerTimeout = isExpiredEvent ? 8000 : 6000;
          setTimeout(() => {
            setActivePushBanner((current) => (current?.id === newNotif.id ? null : current));
          }, bannerTimeout);
        }
      },
      (status) => {
        setSyncStatus(status);
      },
      selectedDate
    );

    return () => unsubscribe();
  }, [currentStore, selectedDate, isSoundEnabled]);

  // Handler functions
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleResetToday = () => {
    const today = getTodayIsoDate();
    setSelectedDate(today);
  };

  const handleResetDatabase = () => {
    setIsResetModalOpen(true);
  };

  const handleResetToDemo = async () => {
    setIsRefreshing(true);
    try {
      await dbResetDemoData(currentStore);
      const today = getBruneiTodayIsoDate();
      setSelectedDate(today);
    } catch (err: any) {
      console.error('Error resetting database to demo:', err);
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearToZero = async () => {
    setIsRefreshing(true);
    try {
      await dbClearAllDataToZero(currentStore);
      const today = getBruneiTodayIsoDate();
      setSelectedDate(today);
    } catch (err: any) {
      console.error('Error clearing database to zero:', err);
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  };

  // Check-In API calls
  const handleCheckinPhone = async (phone: string): Promise<CheckInResponse> => {
    try {
      const result = await dbCheckInPhone(currentStore, phone);
      if (result.isExpired) {
        const matchedMember = result.members?.[0];
        const name = matchedMember?.fullName || 'Member';
        triggerSelfCheckinNotification(
          '🚫 Check-In Blocked (Expired)',
          result.message || `Check-in blocked: ${name}'s membership is EXPIRED. Current status is Expired.`,
          name,
          matchedMember?.memberId,
          'expired'
        );
      } else if (result.success && !result.multiple) {
        const matchedMember = result.members?.[0];
        const name = matchedMember?.fullName || 'Member';
        triggerSelfCheckinNotification(
          '🔔 Member Check-In',
          `Welcome back, ${name}! (${currentStore})`,
          name,
          matchedMember?.memberId,
          'checkin'
        );
      }
      return result;
    } catch (err: any) {
      return { success: false, message: err.message || 'Check-in failed.' };
    }
  };

  const handleCheckinId = async (memberId: string): Promise<CheckInResponse> => {
    try {
      const result = await dbCheckInId(currentStore, memberId);
      if (result.isExpired) {
        const matchedMember = result.members?.[0];
        const name = matchedMember?.fullName || `Member #${memberId}`;
        triggerSelfCheckinNotification(
          '🚫 Check-In Blocked (Expired)',
          result.message || `Check-in blocked: ${name}'s membership is EXPIRED. Current status is Expired.`,
          name,
          memberId,
          'expired'
        );
      } else if (result.success) {
        const matchedMember = result.members?.[0];
        const name = matchedMember?.fullName || `Member #${memberId}`;
        triggerSelfCheckinNotification(
          '🔔 Member Check-In',
          `Welcome back, ${name}! (${currentStore})`,
          name,
          memberId,
          'checkin'
        );
      }
      return result;
    } catch (err: any) {
      return { success: false, message: err.message || 'Check-in failed.' };
    }
  };

  // Optimistic UI updates helper for immediate 0ms responsiveness
  const addOptimisticSale = (sale: any) => {
    setDashboardData((prev) => {
      const newTodaySales = [sale, ...prev.todaySales];
      const amount = Number(sale.amount) || 0;
      const isIncome = sale.category !== 'PT Out';

      const newTotalRevenue = isIncome ? prev.totalRevenue + amount : prev.totalRevenue;
      const newNetIncome = prev.netIncome + (isIncome ? amount : -amount);

      let newCashIn = prev.cashIn;
      let newBaiduriIn = prev.baiduriIn;
      let newBibdIn = prev.bibdIn;

      if (sale.paymentMethod === 'Cash') newCashIn += amount;
      if (sale.paymentMethod === 'Baiduri' || sale.paymentMethod === 'Card') newBaiduriIn += amount;
      if (sale.paymentMethod === 'BIBD' || sale.paymentMethod === 'Online') newBibdIn += amount;

      let posSalesTotal = prev.posSalesTotal;
      let classSalesTotal = prev.classSalesTotal;
      let ptSalesTotal = prev.ptSalesTotal;
      let ptPayoutTotal = prev.ptPayoutTotal;
      let walkInSalesTotal = prev.walkInSalesTotal;
      let membershipSalesTotal = prev.membershipSalesTotal;

      if (sale.category === 'POS') posSalesTotal += amount;
      else if (sale.category === 'Class') classSalesTotal += amount;
      else if (sale.category === 'PT In') ptSalesTotal += amount;
      else if (sale.category === 'PT Out') ptPayoutTotal += amount;
      else if (sale.category === 'Walk-In') walkInSalesTotal += amount;
      else if (sale.category === 'Membership' || sale.category === 'Renewal') membershipSalesTotal += amount;

      return {
        ...prev,
        todaySales: newTodaySales,
        totalRevenue: newTotalRevenue,
        netIncome: newNetIncome,
        cashIn: newCashIn,
        baiduriIn: newBaiduriIn,
        bibdIn: newBibdIn,
        posSalesTotal,
        classSalesTotal,
        ptSalesTotal,
        ptPayoutTotal,
        walkInSalesTotal,
        membershipSalesTotal,
      };
    });
  };

  const addOptimisticExpense = (expense: any) => {
    setDashboardData((prev) => {
      const newTodayExpenses = [expense, ...prev.todayExpenses];
      const amount = Number(expense.amount) || 0;
      const newTotalExpenses = prev.totalExpenses + amount;
      const newNetIncome = prev.netIncome - amount;
      const newCashOut = expense.paymentMethod === 'Cash' ? prev.cashOut + amount : prev.cashOut;

      return {
        ...prev,
        todayExpenses: newTodayExpenses,
        totalExpenses: newTotalExpenses,
        netIncome: newNetIncome,
        cashOut: newCashOut,
      };
    });
  };

  // Transaction Actions (Direct Firestore Subcollection Writes with 0ms Optimistic UI)
  const handleRecordWalkIn = async (data: { name: string; phone?: string; amount: number; paymentMethod: string }) => {
    if (!activeShift && !isCheckinMode) {
      setShowShiftModal(true);
      return dashboardData;
    }

    const now = new Date();
    const timestamp = selectedDate ? `${selectedDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
    const guestName = (data.name || '').trim();
    const guestPhone = (data.phone || '').trim();
    const formattedCustomer = guestName ? (guestPhone ? `${guestName} (${guestPhone})` : `${guestName} (Walk-In)`) : 'Walk-In Guest';

    const optSale = {
      id: 'opt_' + Date.now(),
      timestamp,
      category: 'Walk-In',
      customer: formattedCustomer,
      phone: guestPhone || '',
      paymentMethod: data.paymentMethod || 'Cash',
      amount: Number(data.amount) || 0,
      staff: activeShift?.staffName || 'Duty Staff',
    };

    addOptimisticSale(optSale);

    if (isCheckinMode) {
      triggerSelfCheckinNotification(
        '🔔 Walk-In Pass Check-In Alert',
        `Guest ${guestName || 'Walk-In'} (${guestPhone || 'No Phone'}) registered & checked in ($${(Number(data.amount) || 4.0).toFixed(2)})!`,
        guestName
      );
    } else {
      setActiveTab('sales');
    }

    dbRecordWalkIn(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    }).catch((err) => {
      console.error('Failed to sync walk-in to cloud:', err);
    });

    return dashboardData;
  };

  const handleRecordPOS = async (data: { itemName: string; qty: number; amount: number; paymentMethod: string }) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return dashboardData;
    }

    const now = new Date();
    const timestamp = selectedDate ? `${selectedDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
    const optSale = {
      id: 'opt_' + Date.now(),
      timestamp,
      category: 'POS',
      customer: `${data.itemName} x${data.qty}`,
      itemName: data.itemName,
      qty: Number(data.qty) || 1,
      paymentMethod: data.paymentMethod || 'Cash',
      amount: Number(data.amount) || 0,
      staff: activeShift?.staffName || 'Duty Staff',
    };

    addOptimisticSale(optSale);
    setActiveTab('sales');

    dbRecordPOS(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    }).catch((err) => {
      console.error('Failed to sync POS sale to cloud:', err);
    });

    return dashboardData;
  };

  const handleRecordClass = async (data: { className: string; clientName: string; amount: number; paymentMethod: string }) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return dashboardData;
    }

    const now = new Date();
    const timestamp = selectedDate ? `${selectedDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
    const optSale = {
      id: 'opt_' + Date.now(),
      timestamp,
      category: 'Class',
      customer: `${data.clientName} (${data.className})`,
      className: data.className,
      paymentMethod: data.paymentMethod || 'Cash',
      amount: Number(data.amount) || 0,
      staff: activeShift?.staffName || 'Duty Staff',
    };

    addOptimisticSale(optSale);
    setActiveTab('sales');

    dbRecordClass(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    }).catch((err) => {
      console.error('Failed to sync class sale to cloud:', err);
    });

    return dashboardData;
  };

  const handleRecordPTIn = async (data: { trainerName: string; clientName: string; sessions: string; amount: number; paymentMethod: string }) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return dashboardData;
    }

    const now = new Date();
    const timestamp = selectedDate ? `${selectedDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
    const optSale = {
      id: 'opt_' + Date.now(),
      timestamp,
      category: 'PT In',
      customer: `${data.clientName} (Coach ${data.trainerName})`,
      trainerName: data.trainerName,
      paymentMethod: data.paymentMethod || 'Cash',
      amount: Number(data.amount) || 0,
      staff: activeShift?.staffName || 'Duty Staff',
    };

    addOptimisticSale(optSale);
    setActiveTab('sales');

    dbRecordPTIn(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    }).catch((err) => {
      console.error('Failed to sync PT sale to cloud:', err);
    });

    return dashboardData;
  };

  const handleRecordPTOut = async (data: { trainerName: string; description: string; amount: number; paymentMethod: string }) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return dashboardData;
    }

    const now = new Date();
    const timestamp = selectedDate ? `${selectedDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
    const optSale = {
      id: 'opt_' + Date.now(),
      timestamp,
      category: 'PT Out',
      customer: `Payout: Coach ${data.trainerName}`,
      trainerName: data.trainerName,
      paymentMethod: data.paymentMethod || 'Cash',
      amount: Number(data.amount) || 0,
      staff: activeShift?.staffName || 'Duty Staff',
    };

    addOptimisticSale(optSale);
    setActiveTab('sales');

    dbRecordPTOut(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    }).catch((err) => {
      console.error('Failed to sync PT payout to cloud:', err);
    });

    return dashboardData;
  };

  const handleRecordExpense = async (data: { category: string; description: string; amount: number; paymentMethod: string }) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return dashboardData;
    }

    const now = new Date();
    const timestamp = selectedDate ? `${selectedDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
    const optExp = {
      id: 'opt_' + Date.now(),
      timestamp,
      category: data.category,
      description: data.description,
      paymentMethod: data.paymentMethod || 'Cash',
      amount: Number(data.amount) || 0,
      staff: activeShift?.staffName || 'Duty Staff',
    };

    addOptimisticExpense(optExp);
    setActiveTab('sales');

    dbRecordExpense(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    }).catch((err) => {
      console.error('Failed to sync expense to cloud:', err);
    });

    return dashboardData;
  };

  const handleRegisterMember = async (data: {
    name: string;
    phone: string;
    planType: string;
    price: number;
    startDate: string;
    endDate: string;
    paymentMethod: string;
  }) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return dashboardData;
    }

    const now = new Date();
    const timestamp = selectedDate ? `${selectedDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
    const optMemberId = 'MEM' + String(Math.floor(1000 + Math.random() * 9000));
    const optSale = {
      id: 'opt_' + Date.now(),
      timestamp,
      category: 'Membership',
      customer: `${data.name} (#${optMemberId} - ${data.planType})`,
      memberId: optMemberId,
      paymentMethod: data.paymentMethod || 'Cash',
      amount: Number(data.price) || 0,
      staff: activeShift?.staffName || 'Duty Staff',
    };

    setDashboardData((prev) => ({
      ...prev,
      members: [
        {
          memberId: optMemberId,
          name: data.name,
          phone: data.phone,
          plan: data.planType,
          startDate: data.startDate,
          endDate: data.endDate,
          status: 'active' as const,
        },
        ...prev.members,
      ],
    }));

    addOptimisticSale(optSale);
    setActiveTab('sales');

    dbRegisterMember(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    }).catch((err) => {
      console.error('Failed to sync member registration to cloud:', err);
    });

    return dashboardData;
  };

  const handleConfirmRenew = async (data: {
    memberId: string;
    planType: string;
    price: number;
    paymentMethod: string;
  }) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return dashboardData;
    }

    const now = new Date();
    const timestamp = selectedDate ? `${selectedDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
    const optSale = {
      id: 'opt_' + Date.now(),
      timestamp,
      category: 'Renewal',
      customer: `Renewal #${data.memberId} (${data.planType})`,
      memberId: data.memberId,
      paymentMethod: data.paymentMethod || 'Cash',
      amount: Number(data.price) || 0,
      staff: activeShift?.staffName || 'Duty Staff',
    };

    addOptimisticSale(optSale);
    setActiveTab('sales');

    dbRenewMember(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    }).catch((err) => {
      console.error('Failed to sync renewal to cloud:', err);
    });

    return dashboardData;
  };

  // Deletion Handlers triggering custom confirmation modal
  const handleDeleteSale = (record: any) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return;
    }
    setDeleteTarget({
      type: 'sale',
      title: 'Delete Income Record',
      subtitle: `Are you sure you want to delete "${record.customer || record.category}" ($${Number(record.amount || 0).toFixed(2)})?`,
      data: record,
    });
  };

  const handleDeleteAttendance = (record: any) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return;
    }
    setDeleteTarget({
      type: 'attendance',
      title: 'Delete Attendance Log',
      subtitle: `Are you sure you want to delete check-in log for "${record.name}" (${record.phone})?`,
      data: record,
    });
  };

  const handleDeleteExpense = (record: any) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return;
    }
    setDeleteTarget({
      type: 'expense',
      title: 'Delete Expense Record',
      subtitle: `Are you sure you want to delete expense "${record.description || record.category}" ($${Number(record.amount || 0).toFixed(2)})?`,
      data: record,
    });
  };

  const handleDeleteMember = (memberId: string) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return;
    }
    const member = dashboardData.members?.find((m) => m.memberId === memberId);
    const nameStr = member ? member.name : memberId;
    setDeleteTarget({
      type: 'member',
      title: 'Delete Member Record',
      subtitle: `Are you sure you want to delete registered member "${nameStr}"? This action cannot be undone.`,
      data: { memberId },
    });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const { type, data } = deleteTarget;
    setDeleteTarget(null);

    try {
      if (type === 'sale') {
        await dbDeleteSale(currentStore, data);
      } else if (type === 'attendance') {
        await dbDeleteAttendance(currentStore, data);
      } else if (type === 'expense') {
        await dbDeleteExpense(currentStore, data);
      } else if (type === 'member') {
        const mId = (data.memberId || data || '').toString().trim();
        const mIdLower = mId.toLowerCase();
        setDashboardData((prev) => ({
          ...prev,
          members: prev.members.filter(
            (m) => (m.memberId || '').trim().toLowerCase() !== mIdLower
          ),
        }));
        await dbDeleteMember(currentStore, mId);
      }
    } catch (err: any) {
      console.error('Delete error in Firestore:', err);
    }
  };

  const handleEditMember = async (
    memberId: string,
    updates: {
      name: string;
      phone: string;
      plan: string;
      startDate: string;
      endDate: string;
      status: 'active' | 'expiring' | 'expired';
    }
  ) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return;
    }

    setDashboardData((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.memberId === memberId
          ? {
              ...m,
              name: updates.name,
              phone: updates.phone,
              plan: updates.plan,
              startDate: updates.startDate,
              endDate: updates.endDate,
              status: updates.status,
            }
          : m
      ),
    }));

    try {
      await dbUpdateMember(currentStore, memberId, updates);
    } catch (err) {
      console.error('Failed to update member in cloud:', err);
    }
  };

  // Edit Handlers with Optimistic Updates & Firestore Sync
  const handleEditSale = async (
    record: any,
    updates: { paymentMethod: string; amount: number; category?: string; customer?: string; phone?: string }
  ) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return;
    }

    setDashboardData((prev) => {
      const oldAmount = Number(record.amount) || 0;
      const newAmount = Number(updates.amount) || 0;
      const amountDiff = newAmount - oldAmount;

      const oldPayment = (record.payment || record.paymentMethod || '').toLowerCase();
      const newPayment = (updates.paymentMethod || '').toLowerCase();

      let cashInDiff = 0;
      let baiduriInDiff = 0;
      let bibdInDiff = 0;

      // Remove old amount from old payment bucket
      if (oldPayment.includes('cash')) cashInDiff -= oldAmount;
      else if (oldPayment.includes('baiduri')) baiduriInDiff -= oldAmount;
      else if (oldPayment.includes('bibd')) bibdInDiff -= oldAmount;

      // Add new amount to new payment bucket
      if (newPayment.includes('cash')) cashInDiff += newAmount;
      else if (newPayment.includes('baiduri')) baiduriInDiff += newAmount;
      else if (newPayment.includes('bibd')) bibdInDiff += newAmount;

      const updatedTodaySales = prev.todaySales.map((s, i) => {
        if ((record.id && s.id === record.id) || (record.index !== undefined && i === record.index)) {
          return {
            ...s,
            payment: updates.paymentMethod,
            amount: newAmount,
            category: updates.category || s.category,
            customer: updates.customer || s.customer,
            phone: updates.phone !== undefined ? updates.phone : s.phone,
          };
        }
        return s;
      });

      return {
        ...prev,
        todaySales: updatedTodaySales,
        totalRevenue: prev.totalRevenue + amountDiff,
        netIncome: prev.netIncome + amountDiff,
        cashIn: Math.max(0, prev.cashIn + cashInDiff),
        baiduriIn: Math.max(0, prev.baiduriIn + baiduriInDiff),
        bibdIn: Math.max(0, prev.bibdIn + bibdInDiff),
      };
    });

    try {
      await dbUpdateSale(currentStore, record, updates);
    } catch (err) {
      console.error('Failed to update sale in cloud:', err);
    }
  };

  const handleEditAttendance = async (
    record: any,
    updates: { plan: string; status: string; name?: string; phone?: string }
  ) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return;
    }

    setDashboardData((prev) => {
      const updatedTodayAttendance = prev.todayAttendance.map((a, i) => {
        if ((record.id && a.id === record.id) || (record.index !== undefined && i === record.index)) {
          return {
            ...a,
            plan: updates.plan,
            status: updates.status,
            name: updates.name || a.name,
            phone: updates.phone !== undefined ? updates.phone : a.phone,
          };
        }
        return a;
      });

      return {
        ...prev,
        todayAttendance: updatedTodayAttendance,
      };
    });

    try {
      await dbUpdateAttendance(currentStore, record, updates);
    } catch (err) {
      console.error('Failed to update attendance in cloud:', err);
    }
  };

  const handleEditExpense = async (
    record: any,
    updates: { paymentMethod: string; amount: number; category?: string; description?: string }
  ) => {
    if (!activeShift) {
      setShowShiftModal(true);
      return;
    }

    setDashboardData((prev) => {
      const oldAmount = Number(record.amount) || 0;
      const newAmount = Number(updates.amount) || 0;
      const amountDiff = newAmount - oldAmount;

      const oldPayment = (record.payment || record.paymentMethod || '').toLowerCase();
      const newPayment = (updates.paymentMethod || '').toLowerCase();

      let cashOutDiff = 0;
      if (oldPayment.includes('cash')) cashOutDiff -= oldAmount;
      if (newPayment.includes('cash')) cashOutDiff += newAmount;

      const updatedTodayExpenses = prev.todayExpenses.map((e, i) => {
        if ((record.id && e.id === record.id) || (record.index !== undefined && i === record.index)) {
          return {
            ...e,
            payment: updates.paymentMethod,
            amount: newAmount,
            category: updates.category || e.category,
            description: updates.description || e.description,
          };
        }
        return e;
      });

      return {
        ...prev,
        todayExpenses: updatedTodayExpenses,
        totalExpenses: prev.totalExpenses + amountDiff,
        netIncome: prev.netIncome - amountDiff,
        cashOut: Math.max(0, prev.cashOut + cashOutDiff),
      };
    });

    try {
      await dbUpdateExpense(currentStore, record, updates);
    } catch (err) {
      console.error('Failed to update expense in cloud:', err);
    }
  };

  const handleStartShift = async (shift: StaffShift) => {
    setActiveShift(shift);
    saveStoredActiveShift(shift, currentStore);
    setShowShiftModal(false);
    try {
      await dbStartShift(currentStore, shift);
    } catch (err) {
      console.warn('Shift sync warning:', err);
    }
  };

  const handleEndShift = async () => {
    setActiveShift(null);
    saveStoredActiveShift(null, currentStore);
    setShowShiftModal(false);
    try {
      await dbEndShift(currentStore);
    } catch (err) {
      console.warn('End shift sync warning:', err);
    }
  };

  // Standalone Customer Entrance Check-In Terminal Mode (Clean Kiosk: No staff pop up notifications)
  if (isCheckinMode) {
    return (
      <div className="relative min-h-screen min-h-dvh">
        <EntranceCheckInView
          onCheckinPhone={handleCheckinPhone}
          onCheckinId={handleCheckinId}
          onRecordWalkIn={handleRecordWalkIn}
          onBackToStaffPOS={handleExitCheckinMode}
          currentStore={currentBusinessName || currentStore}
          availableStores={availableStores}
          currentBusinessPin={currentBusinessPin}
        />
      </div>
    );
  }

  const isToday = selectedDate === getTodayIsoDate();
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen min-h-dvh bg-slate-950 text-slate-100 pt-safe pb-safe pl-safe pr-safe p-3 sm:p-5 lg:p-8 font-sans pb-28 md:pb-8 relative">
      {/* Floating Push Notification Banner on Main Terminal */}
      {activePushBanner && (
        <div className="fixed top-3 inset-x-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-[99999] animate-in slide-in-from-top-3 duration-300">
          <div
            onClick={() => {
              handleMarkAsRead(activePushBanner.id);
              setShowNotificationsModal(true);
            }}
            className={`bg-slate-900 border-2 rounded-2xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex items-start justify-between gap-3 text-slate-100 backdrop-blur-xl cursor-pointer hover:bg-slate-850 transition-all ${
              activePushBanner.type === 'expired' || activePushBanner.type === 'blocked'
                ? 'border-rose-500 shadow-rose-950/80 ring-2 ring-rose-500/20'
                : 'border-emerald-500 shadow-emerald-950/80 ring-2 ring-emerald-500/20'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 animate-pulse ${
                  activePushBanner.type === 'expired' || activePushBanner.type === 'blocked'
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                }`}
              >
                {activePushBanner.type === 'expired' || activePushBanner.type === 'blocked' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <Bell className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-black uppercase tracking-wide truncate ${
                      activePushBanner.type === 'expired' || activePushBanner.type === 'blocked'
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {activePushBanner.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {activePushBanner.timestamp}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 mt-0.5 leading-snug break-words">
                  {activePushBanner.message}
                </p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span
                    className={`text-[10px] font-semibold ${
                      activePushBanner.type === 'expired' || activePushBanner.type === 'blocked'
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {activePushBanner.type === 'expired' || activePushBanner.type === 'blocked'
                      ? '⚠️ Action Required: Expired'
                      : '✓ Synced Real-Time'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold underline">
                    Tap to view alerts &rarr;
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkAsRead(activePushBanner.id);
                  setActivePushBanner(null);
                }}
                className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer rounded-lg hover:bg-slate-800 text-[11px] font-bold"
                title="Mark as Read / Dismiss"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearNotificationItem(activePushBanner.id);
                }}
                className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer rounded-lg hover:bg-slate-800"
                title="Clear Alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Mobile Alert Bubble if unread alerts exist while scrolling */}
      {unreadNotifCount > 0 && !showNotificationsModal && (
        <button
          type="button"
          onClick={() => setShowNotificationsModal(true)}
          className="md:hidden fixed bottom-16 right-3 z-30 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-2 rounded-2xl font-black text-xs shadow-2xl flex items-center gap-1.5 border border-amber-300 ring-2 ring-slate-950 animate-bounce cursor-pointer active:scale-95 transition-transform"
          title="Open Notifications"
        >
          <Bell className="w-4 h-4 text-slate-950" />
          <span>{unreadNotifCount} New Alert{unreadNotifCount > 1 ? 's' : ''}</span>
        </button>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <Header
          viewDate={selectedDate}
          isToday={selectedDate === getTodayIsoDate()}
          isCheckinMode={isCheckinMode}
          activeShift={activeShift}
          notifications={notifications}
          currentStore={currentBusinessName || currentStore}
          syncStatus={syncStatus}
          isSoundEnabled={isSoundEnabled}
          onToggleSound={toggleSound}
          onOpenShiftModal={() => setShowShiftModal(true)}
          onLockTerminal={handleLogout}
          onToggleCheckinMode={handleEnterCheckinMode}
          onRefresh={() => {
            setIsRefreshing(true);
            setTimeout(() => setIsRefreshing(false), 500);
          }}
          onClearNotifications={handleClearNotifications}
          onClearNotificationItem={handleClearNotificationItem}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onTestNotification={handleTestNotification}
          isOpenNotifications={showNotificationsModal}
          onToggleNotifications={setShowNotificationsModal}
        />

        {/* Global Toolbar & Date Navigation */}
        <Toolbar
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onResetToday={handleResetToday}
          onResetDatabase={handleResetDatabase}
          isRefreshing={isRefreshing}
          onRefresh={() => {
            setIsRefreshing(true);
            setTimeout(() => setIsRefreshing(false), 500);
          }}
        />

        {/* Terminal Blocked Alert Banner if no active staff shift */}
        {!activeShift && (
          <div className="bg-rose-950/40 border border-rose-500/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-200 backdrop-blur-sm shadow-xl shadow-rose-950/30">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 animate-pulse">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-rose-100 flex items-center gap-2">
                  Terminal Blocked: No Staff On Duty
                </p>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  All terminal operations, transaction logs, check-ins, and POS sales are blocked until an authorized staff starts duty.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowShiftModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 transition cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" /> Start Staff Shift
              </button>
            </div>
          </div>
        )}

        {/* Operational Statistics Grid */}
        <StatsGrid
          data={dashboardData}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Navigation Tabs Bar (Positioned between Gross Sales & Payment Method Summary) */}
        <NavigationTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeShift={activeShift}
          onOpenShiftModal={() => setShowShiftModal(true)}
          onToggleCheckinMode={handleEnterCheckinMode}
          unreadNotifCount={unreadNotifCount}
          onOpenNotifications={() => setShowNotificationsModal(true)}
        />

        {/* Active Tab View Content / Locked Screen */}
        {!activeShift ? (
          <div className="bg-slate-900/95 border-2 border-rose-500/30 p-8 sm:p-12 rounded-3xl shadow-2xl text-center flex flex-col items-center justify-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Terminal Locked — Staff On Duty Required
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                All daily operations, POS checkout, dance/fitness classes, PT sessions, walk-in passes, member registrations, and ledgers are locked until a staff member clocks in.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowShiftModal(true)}
                className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <UserCheck className="w-4 h-4" /> Start Staff Duty Shift
              </button>
              <button
                type="button"
                onClick={handleEnterCheckinMode}
                className="w-full sm:w-auto px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-sm flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
              >
                <Monitor className="w-4 h-4 text-emerald-400" /> Customer Entrance Kiosk
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl">
            {activeTab === 'sales' && (
              <SalesTab
                data={dashboardData}
                onDeleteSale={handleDeleteSale}
                onDeleteAttendance={handleDeleteAttendance}
                onDeleteExpense={handleDeleteExpense}
                onEditSale={handleEditSale}
                onEditAttendance={handleEditAttendance}
                onEditExpense={handleEditExpense}
              />
            )}

            {activeTab === 'staffcheckin' && (
              <PhoneCheckinTab
                onCheckinPhone={handleCheckinPhone}
                onCheckinId={handleCheckinId}
              />
            )}

            {activeTab === 'pos' && <PosTab onRecordPOS={handleRecordPOS} />}

            {activeTab === 'classes' && <ClassesTab onRecordClass={handleRecordClass} />}

            {activeTab === 'pt' && (
              <PersonalTrainerTab
                onRecordPTIn={handleRecordPTIn}
                onRecordPTOut={handleRecordPTOut}
              />
            )}

            {activeTab === 'walkin' && <WalkInTab onRecordWalkIn={handleRecordWalkIn} />}

            {activeTab === 'membership' && (
              <MemberRegistrationTab
                data={dashboardData}
                onRegisterMember={handleRegisterMember}
                onOpenRenewModal={(m) => setRenewMember(m)}
                onDeleteMember={handleDeleteMember}
                onEditMember={handleEditMember}
              />
            )}

            {activeTab === 'expense' && <ExpenseTab onRecordExpense={handleRecordExpense} />}

            {activeTab === 'sheets' && (
              <GoogleSheetsTab
                dashboardData={dashboardData}
                currentStore={currentStore}
                onMembersImported={(pulledMembers) => {
                  setDashboardData((prev) => {
                    const existingMap = new Map(prev.members.map((m) => [m.memberId || m.name, m]));
                    for (const pm of pulledMembers) {
                      existingMap.set(pm.memberId || pm.name, {
                        ...pm,
                        status: pm.status || 'Active',
                        memberId: pm.memberId || 'MEM-' + Math.floor(100000 + Math.random() * 900000),
                      });
                    }
                    return {
                      ...prev,
                      members: Array.from(existingMap.values()),
                    };
                  });
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Quick Renew Modal */}
      <QuickRenewModal
        member={renewMember}
        onClose={() => setRenewMember(null)}
        onConfirmRenew={handleConfirmRenew}
      />

      {/* Staff Shift Management Modal */}
      <StaffShiftModal
        isOpen={showShiftModal}
        activeShift={activeShift}
        dashboardData={dashboardData}
        currentStore={currentStore}
        onStartShift={handleStartShift}
        onEndShift={handleEndShift}
        onClose={() => setShowShiftModal(false)}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">{deleteTarget.title}</h3>
                <p className="text-xs text-slate-400">Confirm Deletion</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              {deleteTarget.subtitle}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-950/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Reset Options Modal */}
      <ResetDatabaseModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onResetToDemo={handleResetToDemo}
        onClearToZero={handleClearToZero}
        currentStore={currentStore}
      />

      {/* Store Registration / Multi-Device Business Login Modal */}
      <BusinessAuthModal
        isOpen={showBusinessAuthModal}
        currentBusinessName={currentBusinessName}
        canClose={!!currentBusinessName && !!currentBusinessPin}
        onClose={() => setShowBusinessAuthModal(false)}
        onAuthenticated={handleBusinessAuthenticated}
      />

      {/* PWA Install Banner Prompt */}
      <InstallPrompt />
    </div>
  );
}

export default App;
