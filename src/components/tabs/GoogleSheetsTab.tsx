import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  LogOut,
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  ClipboardList,
  Eye,
  TrendingUp,
  CreditCard,
  Smartphone,
  Coins,
  Store,
  Link2,
  PlusCircle,
  Unlink,
  Settings2,
  Check,
  Copy,
  Globe
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  googleSignOut,
  getAccessToken
} from '../../lib/googleAuth';
import {
  findOrCreateGymSpreadsheet,
  createNewStoreSpreadsheet,
  verifyAndGetSpreadsheetInfo,
  extractSpreadsheetIdFromInput,
  syncDataToGoogleSheets,
  fetchMembersFromGoogleSheets,
  calculateDailySummaryMetrics,
  SpreadsheetInfo
} from '../../lib/sheetsSync';
import {
  dbBatchUpsertMembers,
  dbGetStoreSpreadsheet,
  dbSaveStoreSpreadsheet,
  dbClearStoreSpreadsheet
} from '../../lib/firebaseSync';
import { DashboardData, Member } from '../../types';

interface GoogleSheetsTabProps {
  dashboardData: DashboardData;
  currentStore?: string;
  onMembersImported?: (members: Member[]) => void;
}

export const GoogleSheetsTab: React.FC<GoogleSheetsTabProps> = ({ dashboardData, currentStore, onMembersImported }) => {
  const effectiveStore = (currentStore || 'Binti Gym').trim();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetInfo | null>(null);
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPullingMembers, setIsPullingMembers] = useState(false);
  const [showConfigOptions, setShowConfigOptions] = useState(false);
  const [customSheetInput, setCustomSheetInput] = useState('');
  const [isSavingCustomSheet, setIsSavingCustomSheet] = useState(false);
  const [isCreatingNewSheet, setIsCreatingNewSheet] = useState(false);

  const [lastSynced, setLastSynced] = useState<string | null>(() => {
    return localStorage.getItem(`last_sheets_sync_time_${effectiveStore}`);
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [copiedDomain, setCopiedDomain] = useState(false);
  const [showDomainHelp, setShowDomainHelp] = useState(false);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const isVercelOrCustomDomain = Boolean(
    currentHost &&
    currentHost !== 'localhost' &&
    currentHost !== '127.0.0.1' &&
    !currentHost.includes('firebaseapp.com') &&
    !currentHost.includes('web.app')
  );

  const handleCopyDomain = () => {
    if (currentHost) {
      navigator.clipboard.writeText(currentHost);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 3000);
    }
  };

  // Compute live Daily Summary Report metrics
  const summaryMetrics = useMemo(() => {
    return calculateDailySummaryMetrics(dashboardData);
  }, [dashboardData]);

  const fmtCurrency = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  const loadSpreadsheetForStore = useCallback(async (accessToken: string, storeName: string, customId?: string) => {
    setIsLoadingSpreadsheet(true);
    setErrorMsg(null);
    try {
      // 1. Check if store already has a linked sheet in Firestore
      const stored = await dbGetStoreSpreadsheet(storeName);
      const targetId = customId || stored?.spreadsheetId;

      const info = await findOrCreateGymSpreadsheet(accessToken, storeName, targetId);
      setSpreadsheet(info);

      // Save to Firestore so other terminals for this same store use the same sheet
      await dbSaveStoreSpreadsheet(storeName, info);

      // Load store-specific last sync time
      const savedTime = localStorage.getItem(`last_sheets_sync_time_${storeName}`);
      setLastSynced(savedTime || null);
    } catch (err: any) {
      console.error('Failed to load store spreadsheet:', err);
      setErrorMsg(err.message || `Unable to access Google Drive/Sheets for ${storeName}. Please check permissions.`);
    } finally {
      setIsLoadingSpreadsheet(false);
    }
  }, []);

  // Initialize Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        loadSpreadsheetForStore(accessToken, effectiveStore);
      },
      () => {
        setUser(null);
        setToken(null);
        setSpreadsheet(null);
      }
    );
    return () => unsubscribe();
  }, [effectiveStore, loadSpreadsheetForStore]);

  // When store changes while signed in, reload the store's dedicated spreadsheet
  useEffect(() => {
    if (token) {
      loadSpreadsheetForStore(token, effectiveStore);
    }
  }, [effectiveStore, token, loadSpreadsheetForStore]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        await loadSpreadsheetForStore(result.accessToken, effectiveStore);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Google Sign-In failed or was cancelled.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setUser(null);
    setToken(null);
    setSpreadsheet(null);
    setSuccessMsg('Signed out of Google Workspace.');
  };

  const handleCreateDedicatedStoreSheet = async () => {
    let activeToken = token || getAccessToken();
    if (!activeToken) {
      setErrorMsg('Google session expired. Please sign in again.');
      return;
    }

    setIsCreatingNewSheet(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const newSheet = await createNewStoreSpreadsheet(activeToken, effectiveStore);
      setSpreadsheet(newSheet);
      await dbSaveStoreSpreadsheet(effectiveStore, newSheet);
      setSuccessMsg(`Created and connected new dedicated spreadsheet: "${newSheet.title}" for ${effectiveStore}!`);
      setShowConfigOptions(false);
    } catch (err: any) {
      console.error('Failed to create dedicated sheet:', err);
      setErrorMsg(err.message || 'Failed to create new spreadsheet.');
    } finally {
      setIsCreatingNewSheet(false);
    }
  };

  const handleLinkCustomSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSheetInput.trim()) return;

    let activeToken = token || getAccessToken();
    if (!activeToken) {
      setErrorMsg('Google session expired. Please sign in again.');
      return;
    }

    setIsSavingCustomSheet(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const cleanId = extractSpreadsheetIdFromInput(customSheetInput);
      const verified = await verifyAndGetSpreadsheetInfo(activeToken, cleanId);
      setSpreadsheet(verified);
      await dbSaveStoreSpreadsheet(effectiveStore, verified);
      setSuccessMsg(`Successfully linked custom spreadsheet: "${verified.title}" to ${effectiveStore}!`);
      setCustomSheetInput('');
      setShowConfigOptions(false);
    } catch (err: any) {
      console.error('Failed to link custom spreadsheet:', err);
      setErrorMsg(err.message || 'Invalid spreadsheet ID or URL. Ensure your Google account has access to it.');
    } finally {
      setIsSavingCustomSheet(false);
    }
  };

  const handleUnlinkStoreSheet = async () => {
    let activeToken = token || getAccessToken();
    if (!activeToken) return;

    try {
      await dbClearStoreSpreadsheet(effectiveStore);
      setSpreadsheet(null);
      setSuccessMsg(`Unlinked spreadsheet for ${effectiveStore}. You can now link or create a new sheet.`);
      setShowConfigOptions(false);
      // Re-find or create default
      loadSpreadsheetForStore(activeToken, effectiveStore);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to unlink spreadsheet.');
    }
  };

  const handleTriggerSync = () => {
    if (!token || !spreadsheet) {
      setErrorMsg('Please connect your Google Account first.');
      return;
    }
    setShowConfirmModal(true);
  };

  const executeSync = async () => {
    setShowConfirmModal(false);
    let activeToken = token;
    if (!activeToken) {
      activeToken = getAccessToken();
    }
    if (!activeToken || !spreadsheet) {
      setErrorMsg('Google session expired. Please sign in again.');
      return;
    }

    setIsSyncing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await syncDataToGoogleSheets(activeToken, spreadsheet.spreadsheetId, dashboardData);
      const nowStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSynced(nowStr);
      localStorage.setItem(`last_sheets_sync_time_${effectiveStore}`, nowStr);
      
      const totalSales = dashboardData.store?.sales?.length || dashboardData.todaySales.length;
      const totalCheckIns = dashboardData.store?.attendance?.length || dashboardData.todayAttendance.length;
      const totalMembers = dashboardData.store?.members?.length || dashboardData.members.length;
      const totalExpenses = dashboardData.store?.expenses?.length || dashboardData.todayExpenses.length;

      setSuccessMsg(`🎉 Successfully pushed all past & current data for ${effectiveStore} (${totalSales} sales, ${totalCheckIns} check-ins, ${totalMembers} members, ${totalExpenses} expenses) + Daily & Monthly Summaries to "${spreadsheet.title}" at ${nowStr}!`);
    } catch (err: any) {
      console.error('Sync failed:', err);
      setErrorMsg(err.message || 'Failed to sync data to Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullMembers = async () => {
    let activeToken = token;
    if (!activeToken) {
      activeToken = getAccessToken();
    }
    if (!activeToken || !spreadsheet) {
      setErrorMsg('Please connect your Google Account first.');
      return;
    }

    setIsPullingMembers(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const pulledMembers = await fetchMembersFromGoogleSheets(activeToken, spreadsheet.spreadsheetId);
      if (pulledMembers.length === 0) {
        setSuccessMsg('No member rows found in "Members Directory" tab of your Google Sheet.');
        return;
      }

      const res = await dbBatchUpsertMembers(effectiveStore, pulledMembers);
      setSuccessMsg(`🎉 Successfully pulled from Google Sheets for ${effectiveStore}: Added ${res.added} new member(s) and updated ${res.updated} member(s)!`);
      if (onMembersImported) {
        onMembersImported(pulledMembers);
      }
    } catch (err: any) {
      console.error('Failed to pull members:', err);
      setErrorMsg(err.message || 'Failed to pull members from Google Sheet.');
    } finally {
      setIsPullingMembers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner with Store Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Google Sheets Real-Time Sync
                </h2>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1">
                  <Store className="w-3 h-3 text-emerald-400" />
                  Terminal Store: {effectiveStore}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                  Store-Isolated Sheets
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Every store terminal syncs to its own dedicated Google Sheet so data from different locations never conflict or overwrite each other.
              </p>
            </div>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-700" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                {user.email?.[0].toUpperCase() || 'G'}
              </div>
            )}
            <div className="text-xs">
              <p className="font-bold text-slate-200">{user.displayName || 'Connected Account'}</p>
              <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="ml-2 p-2 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="flex items-center gap-3 px-4 py-2.5 bg-white text-slate-800 hover:bg-slate-100 font-bold rounded-xl text-xs shadow-md transition-all border border-slate-300 disabled:opacity-50 cursor-pointer"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {isSigningIn ? 'Connecting...' : 'Sign in with Google'}
            </button>
          </div>
        )}
      </div>

      {/* Error & Success Messages */}
      {errorMsg && (
        <div className="space-y-3">
          <div className="p-4 bg-rose-950/40 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold">{errorMsg}</span>
              {(errorMsg.includes('authorized') || errorMsg.includes('domain') || errorMsg.includes('invalid')) && (
                <p className="text-[11px] text-rose-300/80">
                  Firebase Authentication requires any domain where your app is deployed (e.g. Vercel) to be listed under <strong>Authorized Domains</strong> in the Firebase Console.
                </p>
              )}
            </div>
          </div>

          {(errorMsg.includes('authorized') || errorMsg.includes('domain') || errorMsg.includes('invalid')) && (
            <div className="p-4 bg-slate-900 border border-amber-500/40 rounded-xl space-y-3 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-amber-400" /> Quick 2-Minute Fix for Vercel / Custom Domains:
                </span>
                <button
                  type="button"
                  onClick={handleCopyDomain}
                  className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg font-mono text-[11px] flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedDomain ? 'Copied!' : `Copy: ${currentHost || 'domain'}`}
                </button>
              </div>

              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                <li>
                  Open the <a href="https://console.firebase.google.com/project/gen-lang-client-0329117938/authentication/settings" target="_blank" rel="noreferrer" className="text-sky-400 underline hover:text-sky-300 font-bold inline-flex items-center gap-0.5">Firebase Console Auth Settings <ExternalLink className="w-3 h-3" /></a>.
                </li>
                <li>
                  Scroll down to the <strong>Authorized domains</strong> section.
                </li>
                <li>
                  Click <strong>Add domain</strong> and paste your Vercel domain: <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-300 font-mono font-bold">{currentHost || 'your-app.vercel.app'}</code> (and <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-300 font-mono font-bold">vercel.app</code>).
                </li>
                <li>
                  Ensure Google Sign-in provider is enabled under <a href="https://console.firebase.google.com/project/gen-lang-client-0329117938/authentication/providers" target="_blank" rel="noreferrer" className="text-sky-400 underline hover:text-sky-300 font-bold inline-flex items-center gap-0.5">Sign-in method <ExternalLink className="w-3 h-3" /></a>.
                </li>
                <li>
                  Refresh this page and click <strong>Sign in with Google</strong> again.
                </li>
              </ol>
            </div>
          )}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Connection Status Card */}
      {!user ? (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 max-w-xl mx-auto my-6">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Google Workspace Auth Required</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Connect your Google account to enable live synchronization with Google Sheets for <strong className="text-white">{effectiveStore}</strong>. Each store maintains its own separate Google Spreadsheet in your Google Drive.
          </p>
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2 mx-auto cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {isSigningIn ? 'Connecting to Google...' : 'Connect Google Workspace Account'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Target info & Quick stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Spreadsheet Target Info */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Active Spreadsheet for {effectiveStore}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-emerald-500/30">
                    Store-Specific
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowConfigOptions(!showConfigOptions)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                    {showConfigOptions ? 'Hide Sheet Settings' : 'Sheet Settings / Link Custom'}
                  </button>
                  {spreadsheet && (
                    <a
                      href={spreadsheet.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open in Google Sheets
                    </a>
                  )}
                </div>
              </div>

              {/* Collapsible Store Spreadsheet Settings / Custom Link */}
              {showConfigOptions && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Settings2 className="w-4 h-4 text-emerald-400" /> Store Spreadsheet Configuration ({effectiveStore})
                    </span>
                    <span className="text-[11px] text-slate-400">Terminal isolation control</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option 1: Create a brand new dedicated sheet */}
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between">
                      <div className="space-y-1">
                        <p className="font-bold text-white flex items-center gap-1.5">
                          <PlusCircle className="w-4 h-4 text-emerald-400" /> Create New Dedicated Sheet
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Generates a brand new sheet named <strong className="text-slate-300">"{effectiveStore} - Management & Sales Log"</strong> in your Google Drive.
                        </p>
                      </div>
                      <button
                        onClick={handleCreateDedicatedStoreSheet}
                        disabled={isCreatingNewSheet}
                        className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <PlusCircle className={`w-3.5 h-3.5 ${isCreatingNewSheet ? 'animate-spin' : ''}`} />
                        {isCreatingNewSheet ? 'Creating Sheet...' : `Create Dedicated Sheet for ${effectiveStore}`}
                      </button>
                    </div>

                    {/* Option 2: Link an existing custom sheet */}
                    <form onSubmit={handleLinkCustomSheet} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <div className="space-y-1">
                        <p className="font-bold text-white flex items-center gap-1.5">
                          <Link2 className="w-4 h-4 text-sky-400" /> Link Custom Google Sheet
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Paste your existing Google Sheet URL or Sheet ID to assign specifically to {effectiveStore}.
                        </p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="Paste Sheet URL or ID..."
                          value={customSheetInput}
                          onChange={(e) => setCustomSheetInput(e.target.value)}
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                        <button
                          type="submit"
                          disabled={isSavingCustomSheet || !customSheetInput.trim()}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Link
                        </button>
                      </div>
                    </form>
                  </div>

                  {spreadsheet && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Current Sheet ID: <code className="text-slate-300">{spreadsheet.spreadsheetId}</code></span>
                      <button
                        onClick={handleUnlinkStoreSheet}
                        className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Unlink className="w-3.5 h-3.5" /> Disconnect / Reset Link
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isLoadingSpreadsheet ? (
                <div className="p-6 bg-slate-950 rounded-xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" /> Fetching {effectiveStore}'s spreadsheet from Google Drive...
                </div>
              ) : spreadsheet ? (
                <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                          🏬 {effectiveStore}
                        </span>
                        <p className="text-xs text-slate-400">Connected Sheet Name</p>
                      </div>
                      <p className="text-sm font-bold text-white mt-1">{spreadsheet.title}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold rounded-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active & Synced
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Synced Tabs (Latest on Top)</span>
                      <span className="font-semibold text-slate-200">Daily Summary, Monthly Summary, Sales, Check-Ins, Members, Expenses</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Last Sync Status ({effectiveStore})</span>
                      <span className="font-semibold text-emerald-400">
                        {lastSynced ? `Synced at ${lastSynced}` : 'Never synced'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-300">
                  No active spreadsheet found for {effectiveStore}. Click "Push Data to Google Sheets" to generate a dedicated spreadsheet in your Google Drive.
                </div>
              )}

              {/* Sync & Two-Way Import Controls */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleTriggerSync}
                    disabled={isSyncing || !spreadsheet}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? `Pushing ${effectiveStore} Data...` : `📤 Push ${effectiveStore} Data to Sheets`}
                  </button>

                  <button
                    onClick={handlePullMembers}
                    disabled={isPullingMembers || !spreadsheet}
                    className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-sky-950/40 cursor-pointer"
                  >
                    <Users className={`w-4 h-4 ${isPullingMembers ? 'animate-spin' : ''}`} />
                    {isPullingMembers ? 'Importing from Sheet...' : `📥 Pull Members to ${effectiveStore}`}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  🔒 Dedicated sheet per store terminal
                </p>
              </div>

              {/* Two-way Member Sync Quick Guide */}
              <div className="p-3.5 bg-sky-950/30 border border-sky-500/20 rounded-xl space-y-1.5">
                <p className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  Two-Way Member Sync Supported!
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  You can type new members directly into your Google Sheet under the <strong className="text-white">"Members Directory"</strong> tab.
                  Columns: <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">Member ID</code> (optional), <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">Full Name</code>, <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">Phone</code>, <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">Plan</code>, <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">Start Date</code>, <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">End Date</code>.
                  Then click <strong className="text-sky-400">"📥 Pull Members to {effectiveStore}"</strong> to sync them into your app!
                </p>
              </div>
            </div>

            {/* Sync Content Payload Stats */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-400" /> Full Historical & Current Payload ({effectiveStore})
                </h3>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                  All-Time Sync Enabled
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Total Sales Records
                  </span>
                  <p className="text-base font-bold text-white">
                    {dashboardData.store?.sales?.length || dashboardData.todaySales.length}
                    <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                      ({dashboardData.todaySales.length} today)
                    </span>
                  </p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" /> Total Check-In Visits
                  </span>
                  <p className="text-base font-bold text-white">
                    {dashboardData.store?.attendance?.length || dashboardData.todayAttendance.length}
                    <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                      ({dashboardData.todayAttendance.length} today)
                    </span>
                  </p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Users className="w-3.5 h-3.5 text-purple-400" /> Total Members
                  </span>
                  <p className="text-base font-bold text-white">
                    {dashboardData.store?.members?.length || dashboardData.members.length}
                    <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                      (directory)
                    </span>
                  </p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <DollarSign className="w-3.5 h-3.5 text-rose-400" /> Total Expenses
                  </span>
                  <p className="text-base font-bold text-white">
                    {dashboardData.store?.expenses?.length || dashboardData.todayExpenses.length}
                    <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                      ({dashboardData.todayExpenses.length} today)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Daily Summary Report Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" /> Daily Summary Report ({effectiveStore})
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-600/30 px-2 py-0.5 rounded">
                Live Preview
              </span>
            </div>

            {/* Google Sheets Style Rendered Table */}
            <div className="border border-slate-700/80 rounded-xl overflow-hidden text-xs bg-slate-950 shadow-inner font-sans">
              {/* Header: REPORT FOR ... */}
              <div className="bg-slate-950 border-b border-slate-800 p-2.5 text-center font-bold text-white tracking-wide text-xs">
                {summaryMetrics.headerTitle}
              </div>

              {/* Counts */}
              <div className="divide-y divide-slate-800/60 bg-slate-900/40">
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>New Membership Sign-ups</span>
                  <span className="font-semibold text-white">{summaryMetrics.newMembershipCount}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Walk-In Entries</span>
                  <span className="font-semibold text-white">{summaryMetrics.walkInCount}</span>
                </div>
              </div>

              {/* INCOME BANNER */}
              <div className="bg-emerald-600 px-3 py-1.5 text-center font-bold text-white text-[11px] tracking-wider">
                --- INCOME (PAYMENT IN) ---
              </div>

              {/* Income Rows */}
              <div className="divide-y divide-slate-800/60 bg-slate-900/40">
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Cash In</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.cashIn)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Baiduri In</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.baiduriIn)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Bibd In</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.bibdIn)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Coupon In</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.couponIn)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 bg-emerald-950/60 text-emerald-400 font-bold border-t border-emerald-800/40">
                  <span>TOTAL INCOME IN</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.totalIncomeIn)}</span>
                </div>
              </div>

              {/* EXPENSES BANNER */}
              <div className="bg-rose-600 px-3 py-1.5 text-center font-bold text-white text-[11px] tracking-wider">
                --- EXPENSES (PAYMENT OUT) ---
              </div>

              {/* Expenses Rows */}
              <div className="divide-y divide-slate-800/60 bg-slate-900/40">
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Cash Out</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.cashOut)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Baiduri Out</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.baiduriOut)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Bibd Out</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.bibdOut)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Coupon Out</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.couponOut)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 bg-rose-950/60 text-rose-400 font-bold border-t border-rose-800/40">
                  <span>TOTAL EXPENSES OUT</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.totalExpensesOut)}</span>
                </div>
              </div>

              {/* SUMMARY BANNER */}
              <div className="bg-slate-950 px-3 py-1.5 text-center font-bold text-white text-[11px] tracking-wider border-t border-slate-800">
                --- SUMMARY ---
              </div>

              {/* Summary Rows */}
              <div className="divide-y divide-slate-800/60 bg-slate-900/40">
                <div className="flex justify-between px-3 py-1.5 font-bold text-sky-400">
                  <span>NET CASH BALANCE (Drawer Cash)</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.netCash)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 font-bold text-cyan-400">
                  <span>NET BAIDURI BALANCE</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.netBaiduri)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 font-bold text-purple-400">
                  <span>NET BIBD BALANCE</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.netBibd)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 font-bold bg-amber-500/20 text-amber-300 border-t border-amber-500/40 shadow-inner">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    NET DAILY BALANCE (All Methods)
                  </span>
                  <span className="font-mono text-amber-200">{fmtCurrency(summaryMetrics.netDaily)}</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              Synced to Google Sheets tab "Daily Summary" with newest reports at row 1.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal prior to data mutation */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Google Sheets Sync</h3>
                <p className="text-xs text-slate-400">Terminal: {effectiveStore}</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <p>
                This will push <strong>all past & current history</strong> for <strong>{effectiveStore}</strong> to your dedicated Google Spreadsheet (<strong>{spreadsheet?.title}</strong>):
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                <li><strong>Daily Summary:</strong> Complete executive daily reports for all recorded dates (latest on top).</li>
                <li><strong>Monthly Summary:</strong> Today, current month, all-time totals, and historical monthly breakdown.</li>
                <li><strong>Sales Log:</strong> All {dashboardData.store?.sales?.length || dashboardData.todaySales.length} historical sales records.</li>
                <li><strong>Check-In Log:</strong> All {dashboardData.store?.attendance?.length || dashboardData.todayAttendance.length} historical check-ins.</li>
                <li><strong>Members Directory:</strong> All {dashboardData.store?.members?.length || dashboardData.members.length} registered members.</li>
                <li><strong>Expenses Log:</strong> All {dashboardData.store?.expenses?.length || dashboardData.todayExpenses.length} historical expenses.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeSync}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-950/40 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Push All History to Google Sheets
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
