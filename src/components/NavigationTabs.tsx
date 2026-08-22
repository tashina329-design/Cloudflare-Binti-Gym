import React, { useState } from 'react';
import {
  BarChart3,
  Smartphone,
  ShoppingBag,
  Activity,
  Dumbbell,
  Footprints,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  Grid,
  X,
  UserCheck,
  Lock,
  ChevronRight,
  Sparkles,
  Bell,
} from 'lucide-react';
import { StaffShift } from '../types';

export type TabId =
  | 'sales'
  | 'staffcheckin'
  | 'pos'
  | 'classes'
  | 'pt'
  | 'walkin'
  | 'membership'
  | 'expense'
  | 'sheets';

interface NavigationTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  activeShift?: StaffShift | null;
  onOpenShiftModal?: () => void;
  onToggleCheckinMode?: () => void;
  unreadNotifCount?: number;
  onOpenNotifications?: () => void;
}

interface TabItem {
  id: TabId;
  label: string;
  shortLabel?: string;
  category: 'Operations' | 'Members' | 'Tools';
  icon: React.ReactNode;
  badge?: string;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onTabChange,
  activeShift,
  onOpenShiftModal,
  unreadNotifCount = 0,
  onOpenNotifications,
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const tabs: TabItem[] = [
    { id: 'sales', label: 'Sales & Logs', shortLabel: 'Logs', category: 'Operations', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'staffcheckin', label: 'Phone Check-In', shortLabel: 'Check-In', category: 'Operations', icon: <Smartphone className="w-4 h-4" />, badge: 'Fast' },
    { id: 'pos', label: 'POS & Sauna', shortLabel: 'POS', category: 'Operations', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'classes', label: 'Dance & Fitness Classes', shortLabel: 'Classes', category: 'Operations', icon: <Activity className="w-4 h-4" /> },
    { id: 'pt', label: 'PT (Check In/Out)', shortLabel: 'PT Coach', category: 'Members', icon: <Dumbbell className="w-4 h-4" /> },
    { id: 'walkin', label: 'Walk-In Pass', shortLabel: 'Walk-In', category: 'Members', icon: <Footprints className="w-4 h-4" /> },
    { id: 'membership', label: 'Register Member', shortLabel: 'Members', category: 'Members', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'expense', label: 'Expense Outflow', shortLabel: 'Expenses', category: 'Members', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'sheets', label: 'Google Sheets Sync', shortLabel: 'Sheets', category: 'Tools', icon: <FileSpreadsheet className="w-4 h-4" />, badge: 'Sync' },
  ];

  const handleSelectTab = (tabId: TabId) => {
    if (!activeShift) {
      onOpenShiftModal?.();
      return;
    }
    onTabChange(tabId);
    setShowMobileMenu(false);
  };

  const activeTabItem = tabs.find((t) => t.id === activeTab) || tabs[0];

  // Mobile Bottom Bar Primary Tabs (Quick Access)
  const mobilePrimaryTabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'sales', label: 'Logs', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'staffcheckin', label: 'Check-In', icon: <Smartphone className="w-5 h-5" /> },
    { id: 'walkin', label: 'Walk-In', icon: <Footprints className="w-5 h-5" /> },
    { id: 'membership', label: 'Members', icon: <CreditCard className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* ========================================================= */}
      {/* DESKTOP / TABLET MAIN NAVIGATION PANEL                    */}
      {/* ========================================================= */}
      <div className="hidden md:block bg-slate-900/95 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl space-y-4 relative">
        {!activeShift && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] rounded-2xl z-10 flex items-center justify-between px-6 py-3 border border-rose-500/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Navigation Locked</p>
                <p className="text-[11px] text-rose-300">Staff shift required to switch tabs & perform operations</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenShiftModal}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" /> Start Shift to Unlock
            </button>
          </div>
        )}

        {/* Categorized Tab Buttons Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Daily Operations */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block px-1">
              ⚡ Daily Operations
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {tabs
                .filter((t) => t.category === 'Operations')
                .map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleSelectTab(tab.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all border cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40'
                          : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={isActive ? 'text-slate-950' : 'text-emerald-400'}>{tab.icon}</span>
                        <span className="truncate">{tab.label}</span>
                      </div>
                      {tab.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                            isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Services & Members */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block px-1">
              👥 Services & Members
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {tabs
                .filter((t) => t.category === 'Members')
                .map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleSelectTab(tab.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all border cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40'
                          : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={isActive ? 'text-slate-950' : 'text-emerald-400'}>{tab.icon}</span>
                        <span className="truncate">{tab.label}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Tools & Cloud Sync */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block px-1">
              🛠️ Tools & Cloud Sync
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {tabs
                .filter((t) => t.category === 'Tools')
                .map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleSelectTab(tab.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all border cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40'
                          : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={isActive ? 'text-slate-950' : 'text-emerald-400'}>{tab.icon}</span>
                        <span className="truncate">{tab.label}</span>
                      </div>
                      {tab.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                            isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE TOP TAB CHIPS (Fast horizontal swipe on mobile)    */}
      {/* ========================================================= */}
      <div className="md:hidden bg-slate-900/90 border border-slate-800/80 rounded-2xl p-2 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 px-1 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider shrink-0">View:</span>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 truncate">
              {activeTabItem.icon} {activeTabItem.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile Alerts Quick Button */}
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className={`text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                  unreadNotifCount > 0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'text-slate-400 bg-slate-800 hover:text-slate-200 border border-slate-700'
                }`}
                title="View Notifications"
              >
                <Bell className={`w-3.5 h-3.5 ${unreadNotifCount > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Alerts</span>
                {unreadNotifCount > 0 && (
                  <span className="bg-rose-500 text-white text-[9px] px-1 rounded-full font-black">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (!activeShift) {
                  onOpenShiftModal?.();
                  return;
                }
                setShowMobileMenu(true);
              }}
              className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5" /> All Views
            </button>
          </div>
        </div>

        {/* Scrollable pill row for swift thumb access */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 touch-pan-x">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 shrink-0 transition-all border cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm font-black'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <span className={isActive ? 'text-slate-950' : 'text-emerald-400'}>{tab.icon}</span>
                <span>{tab.shortLabel || tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE BOTTOM NAVIGATION DOCK (Persistent on mobile)      */}
      {/* ========================================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
          {mobilePrimaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer min-h-[48px] ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-950/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className={`${isActive ? 'text-slate-950 scale-110' : 'text-slate-400'} transition-transform`}>
                  {tab.icon}
                </div>
                <span className="text-[10px] mt-0.5 font-bold tracking-tight truncate w-full text-center">
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* 5th Button: Open Full 9-Module Drawer (with notification badge if unread) */}
          <button
            onClick={() => {
              if (!activeShift) {
                onOpenShiftModal?.();
                return;
              }
              setShowMobileMenu(true);
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer min-h-[48px] relative ${
              showMobileMenu || !mobilePrimaryTabs.some((t) => t.id === activeTab)
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <div className="relative">
              <Grid className="w-5 h-5 text-emerald-400" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-rose-500 rounded-full border-2 border-slate-900 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-bold tracking-tight">More</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE FULL MODULE DRAWER (Bottom Sheet Modal)            */}
      {/* ========================================================= */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col justify-end p-3 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl pb-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Grid className="w-5 h-5 text-emerald-400" /> All Gym Modules
                </h3>
                <p className="text-xs text-slate-400">Quick access to all operational views</p>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Alerts Banner inside Drawer if unread */}
            {onOpenNotifications && (
              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenNotifications();
                }}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                  unreadNotifCount > 0
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${unreadNotifCount > 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-xs block text-white">Live Notifications & Check-In Alerts</span>
                    <span className="text-[11px] text-slate-400">
                      {unreadNotifCount > 0 ? `${unreadNotifCount} unread alert${unreadNotifCount > 1 ? 's' : ''} waiting` : 'No unread alerts'}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400">Open &rarr;</span>
              </button>
            )}

            {/* Currently Active Banner */}
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-500 text-slate-950 rounded-xl">{activeTabItem.icon}</span>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Currently Viewing</span>
                  <span className="font-bold text-white text-sm">{activeTabItem.label}</span>
                </div>
              </div>
            </div>

            {/* Categorized Modules */}
            {(['Operations', 'Members', 'Tools'] as const).map((categoryName) => {
              const categoryTitle =
                categoryName === 'Operations'
                  ? '⚡ Daily Operations'
                  : categoryName === 'Members'
                  ? '👥 Members & Services'
                  : '🛠️ Cloud & Sync Tools';

              return (
                <div key={categoryName} className="space-y-2">
                  <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block px-1">
                    {categoryTitle}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {tabs
                      .filter((t) => t.category === categoryName)
                      .map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => handleSelectTab(tab.id)}
                            className={`p-3 rounded-2xl text-left border flex flex-col justify-between gap-2 transition-all cursor-pointer min-h-[72px] ${
                              isActive
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-lg shadow-emerald-950/50'
                                : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`p-2 rounded-xl text-xs ${
                                  isActive ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-emerald-400'
                                }`}
                              >
                                {tab.icon}
                              </span>
                              {tab.badge && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                    isActive ? 'bg-slate-950/30 text-slate-950' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  {tab.badge}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-bold leading-snug">{tab.label}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


