import React, { useState } from 'react';
import {
  Dumbbell,
  Smartphone,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Users,
  Footprints,
  Keyboard,
  Delete,
  CreditCard,
  DollarSign,
  User,
  Phone,
  Check,
  X,
  Sparkles,
  Lock,
} from 'lucide-react';
import { CheckInResponse, MemberMatch, DashboardData } from '../types';

interface EntranceCheckInViewProps {
  onCheckinPhone: (phone: string) => Promise<CheckInResponse>;
  onCheckinId: (memberId: string) => Promise<CheckInResponse>;
  onRecordWalkIn?: (data: { name: string; phone?: string; amount: number; paymentMethod: string }) => Promise<DashboardData>;
  onBackToStaffPOS?: () => void;
  currentStore?: string;
  availableStores?: string[];
  currentBusinessPin?: string;
}

export const EntranceCheckInView: React.FC<EntranceCheckInViewProps> = ({
  onCheckinPhone,
  onCheckinId,
  onRecordWalkIn,
  onBackToStaffPOS,
  currentStore = 'Binti Gym',
  availableStores,
  currentBusinessPin = '',
}) => {
  // Mode: 'member' check-in vs 'walkin' guest registration
  const [terminalMode, setTerminalMode] = useState<'member' | 'walkin'>('member');

  // Staff POS 4-digit PIN lock modal state for exiting kiosk mode
  const [showExitPinModal, setShowExitPinModal] = useState<boolean>(false);
  const [exitPinInput, setExitPinInput] = useState<string>('');
  const [exitPinError, setExitPinError] = useState<string | null>(null);

  // Member check-in state
  const [memberPhone, setMemberPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [matches, setMatches] = useState<MemberMatch[]>([]);

  // Welcome Back Modal
  const [welcomeModal, setWelcomeModal] = useState<{
    name: string;
    memberId?: string;
    plan?: string;
    status?: string;
  } | null>(null);

  // Expired Membership Blocked Modal
  const [expiredModal, setExpiredModal] = useState<{
    name: string;
    memberId?: string;
    plan?: string;
    expirationDate?: string;
  } | null>(null);

  // Walk-in registration state
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinFee, setWalkinFee] = useState<number>(4.00);
  const [walkinPayment, setWalkinPayment] = useState<string>('Cash');
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  // Floating Keyboard State
  const [showKeypad, setShowKeypad] = useState<boolean>(true);
  const [activeTarget, setActiveTarget] = useState<'memberPhone' | 'walkinPhone'>('memberPhone');

  // Keypad Handlers
  const handleKeypadPress = (val: string) => {
    setStatusMessage(null);
    if (activeTarget === 'memberPhone') {
      setMemberPhone((prev) => prev + val);
    } else {
      setWalkinPhone((prev) => prev + val);
    }
  };

  const handleKeypadBackspace = () => {
    setStatusMessage(null);
    if (activeTarget === 'memberPhone') {
      setMemberPhone((prev) => prev.slice(0, -1));
    } else {
      setWalkinPhone((prev) => prev.slice(0, -1));
    }
  };

  const handleKeypadClear = () => {
    setStatusMessage(null);
    if (activeTarget === 'memberPhone') {
      setMemberPhone('');
    } else {
      setWalkinPhone('');
    }
  };

  // Submit Member Phone Check-in
  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberPhone.trim()) return;

    setLoading(true);
    setStatusMessage(null);
    setMatches([]);

    try {
      const res = await onCheckinPhone(memberPhone.trim());
      if (res.isExpired) {
        const member = res.members?.[0];
        const name = member?.fullName || 'Member';
        setExpiredModal({
          name,
          memberId: member?.memberId,
          plan: member?.plan,
          expirationDate: member?.expirationDate,
        });
        setStatusMessage({
          type: 'error',
          text: res.message || `Check-in blocked: Membership for ${name} is EXPIRED. Current status is Expired. Please renew at the front desk.`,
        });
        setMemberPhone('');
      } else if (res.multiple && res.members) {
        setMatches(res.members);
      } else if (res.success) {
        const member = res.members?.[0];
        const name = member?.fullName || 'Member';
        setWelcomeModal({
          name,
          memberId: member?.memberId,
          plan: member?.plan,
          status: member?.status,
        });
        setStatusMessage({ type: 'success', text: `Welcome back, ${name}!` });
        setMemberPhone('');

        // Auto-close welcome popup after 4.5 seconds
        setTimeout(() => {
          setWelcomeModal(null);
        }, 4500);
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Check-in failed. Please enter your exact registered phone number.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error communicating with check-in system.' });
    } finally {
      setLoading(false);
    }
  };

  // Confirm match selection
  const handleConfirmMatch = async (memberId: string) => {
    setLoading(true);
    try {
      const res = await onCheckinId(memberId);
      if (res.isExpired) {
        const member = res.members?.[0] || matches.find((m) => m.memberId === memberId);
        const name = member?.fullName || 'Member';
        setExpiredModal({
          name,
          memberId: member?.memberId,
          plan: member?.plan,
          expirationDate: member?.expirationDate,
        });
        setStatusMessage({
          type: 'error',
          text: res.message || `Check-in blocked: Membership for ${name} is EXPIRED. Current status is Expired.`,
        });
        setMatches([]);
        setMemberPhone('');
      } else if (res.success) {
        const member = res.members?.[0] || matches.find((m) => m.memberId === memberId);
        const name = member?.fullName || 'Member';
        setWelcomeModal({
          name,
          memberId: member?.memberId,
          plan: member?.plan,
          status: member?.status,
        });
        setStatusMessage({ type: 'success', text: `Welcome back, ${name}!` });
        setMatches([]);
        setMemberPhone('');

        setTimeout(() => {
          setWelcomeModal(null);
        }, 4500);
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Check-in failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Check-in error.' });
    } finally {
      setLoading(false);
    }
  };

  // Submit Walk-in Registration
  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRecordWalkIn) {
      setStatusMessage({ type: 'error', text: 'Walk-in registration handler not attached.' });
      return;
    }

    const trimmedName = walkinName.trim();
    const trimmedPhone = walkinPhone.trim();

    if (!trimmedName || !trimmedPhone) {
      setStatusMessage({
        type: 'error',
        text: '⚠️ Name and Phone Number are required. Please input both to proceed with Walk-In Pass.',
      });
      return;
    }

    if (trimmedName.length < 2) {
      setStatusMessage({
        type: 'error',
        text: '⚠️ Please enter a valid visitor name (at least 2 characters).',
      });
      return;
    }

    if (trimmedPhone.length < 4) {
      setStatusMessage({
        type: 'error',
        text: '⚠️ Please enter a valid contact phone number.',
      });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      await onRecordWalkIn({
        name: trimmedName,
        phone: trimmedPhone,
        amount: walkinFee,
        paymentMethod: walkinPayment,
      });

      setStatusMessage({
        type: 'success',
        text: `🎟️ Walk-In Pass Issued! Welcome, ${trimmedName} (${trimmedPhone}). Paid $${walkinFee.toFixed(2)} via ${walkinPayment}.`,
      });
      setWalkinName('');
      setWalkinPhone('');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to process walk-in registration.' });
    } finally {
      setLoading(false);
    }
  };

  const paymentOptions = [
    { id: 'Cash', label: 'Cash', icon: '💵', desc: 'Physical currency paid at counter' },
    { id: 'Baiduri', label: 'Baiduri', icon: '💳', desc: 'Baiduri card or QR transfer' },
    { id: 'Bibd', label: 'BIBD', icon: '🏦', desc: 'BIBD QuickPay / Online transfer' },
    { id: 'Coupon', label: 'Coupon', icon: '🎟️', desc: 'Prepaid voucher or coupon code' },
  ];

  return (
    <div
      className="min-h-screen min-h-dvh bg-slate-950 text-slate-100 flex flex-col justify-between p-3 sm:p-4 lg:p-6 font-sans overflow-y-auto sm:overflow-hidden select-none kiosk-viewport"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 12px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 12px)',
      }}
    >
      {/* Top Bar Header (Safe from iPhone Notch & Dynamic Island) */}
      <div className="flex items-center justify-between max-w-2xl mx-auto w-full mb-2 sm:mb-3 shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] sm:rounded-[14px] flex items-center justify-center text-emerald-400">
              <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-base md:text-lg font-black text-white tracking-tight flex items-center gap-1.5 truncate">
              <span className="truncate">{currentStore.toUpperCase()} SELF CHECK-IN</span>
              <span className="text-[9px] uppercase bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.2 rounded-full border border-emerald-500/30 shrink-0">
                Live
              </span>
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium hidden sm:block truncate">
              {currentStore} Touchscreen Entrance Kiosk
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Keypad Toggle Button */}
          <button
            type="button"
            onClick={() => setShowKeypad(!showKeypad)}
            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer ${
              showKeypad
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Toggle Keypad"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="text-[10px] sm:text-xs">{showKeypad ? 'Keypad ON' : 'Keypad OFF'}</span>
          </button>

          {onBackToStaffPOS && (
            <button
              type="button"
              onClick={() => {
                setExitPinInput('');
                setExitPinError(null);
                setShowExitPinModal(true);
              }}
              className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors shadow-sm cursor-pointer"
              title="Return to Staff Dashboard"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xs:inline">Exit Kiosk</span>
              <span className="xs:hidden">Exit</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-2xl w-full mx-auto my-auto flex-1 flex flex-col justify-center space-y-2 sm:space-y-3 min-h-0 overflow-hidden">
        {/* Mode Selector Tabs */}
        <div className="bg-slate-900 border border-slate-800/80 p-1 rounded-xl sm:rounded-2xl flex gap-1 shadow-md shrink-0">
          <button
            type="button"
            onClick={() => {
              setTerminalMode('member');
              setActiveTarget('memberPhone');
              setStatusMessage(null);
            }}
            className={`flex-1 py-1.5 sm:py-2.5 px-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all ${
              terminalMode === 'member'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/50 scale-[1.01]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Member
          </button>

          <button
            type="button"
            onClick={() => {
              setTerminalMode('walkin');
              setActiveTarget('walkinPhone');
              setStatusMessage(null);
            }}
            className={`flex-1 py-1.5 sm:py-2.5 px-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all ${
              terminalMode === 'walkin'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-950/50 scale-[1.01]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Footprints className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Walk-In Pass
          </button>
        </div>

        {/* Content Card */}
        <div className="bg-slate-900 border border-slate-800/90 p-3 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl relative overflow-hidden backdrop-blur-sm shrink-0">
          {/* Subtle Top Glow */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 ${
              terminalMode === 'member' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-sky-500 to-blue-500'
            }`}
          />

          {/* MODE 1: MEMBER PHONE CHECK-IN */}
          {terminalMode === 'member' && (
            <div className="space-y-2 sm:space-y-4">
              <div className="text-center space-y-0.5 sm:space-y-1">
                <div className="w-9 h-9 sm:w-12 sm:h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-400 mx-auto shadow-inner">
                  <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <h2 className="text-base sm:text-xl font-black text-white tracking-tight">Member Self Check-In</h2>
                <p className="text-[10px] sm:text-xs text-slate-400">
                  Enter your registered phone number to check in
                </p>
              </div>

              <form onSubmit={handleMemberSubmit} className="space-y-2 sm:space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-300 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-400" /> Registered Phone Number
                    </label>
                    <span className="text-[9px] sm:text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/50">
                      Target Input
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="none"
                    value={memberPhone}
                    onFocus={() => setActiveTarget('memberPhone')}
                    onChange={(e) => setMemberPhone(e.target.value)}
                    placeholder="Enter phone number..."
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    className="w-full bg-slate-950 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-xl px-4 py-3 sm:py-4 text-center text-xl sm:text-2xl font-black text-slate-100 placeholder-slate-600 focus:outline-none tracking-widest font-mono shadow-inner transition-all cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !memberPhone.trim()}
                  className="w-full py-2.5 sm:py-3.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-950/60 disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {loading ? 'Verifying Phone...' : '⚡ Confirm Check-In'}
                </button>
              </form>
            </div>
          )}

          {/* MODE 2: WALK-IN REGISTRATION */}
          {terminalMode === 'walkin' && (
            <div className="space-y-2 sm:space-y-3">
              <div className="text-center space-y-0.5 sm:space-y-1">
                <div className="w-8 h-8 sm:w-11 sm:h-11 bg-sky-500/10 border border-sky-500/30 rounded-xl sm:rounded-2xl flex items-center justify-center text-sky-400 mx-auto shadow-inner">
                  <Footprints className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h2 className="text-sm sm:text-lg font-black text-white tracking-tight">Walk-In Visitor Pass</h2>
              </div>

              <form onSubmit={handleWalkinSubmit} className="space-y-2 sm:space-y-3">
                {/* Visitor Name & Phone Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-300 mb-0.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-sky-400" /> Full Name <span className="text-rose-400">*</span>
                      </span>
                      <span className="text-[9px] text-sky-400 font-semibold uppercase tracking-wider">Required</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={walkinName}
                      onChange={(e) => setWalkinName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full h-10 sm:h-11 bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-lg sm:rounded-xl px-3 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-300 mb-0.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-sky-400" /> Phone Number <span className="text-rose-400">*</span>
                      </span>
                      <span className="text-[9px] text-sky-400 font-semibold uppercase tracking-wider">Required</span>
                    </label>
                    <input
                      type="text"
                      inputMode="none"
                      required
                      value={walkinPhone}
                      onFocus={() => setActiveTarget('walkinPhone')}
                      onChange={(e) => setWalkinPhone(e.target.value)}
                      placeholder="e.g. 8899001"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      className={`w-full h-10 sm:h-11 bg-slate-950 border rounded-lg sm:rounded-xl px-3 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none font-mono transition-all cursor-pointer ${
                        activeTarget === 'walkinPhone' ? 'border-sky-500 ring-1 ring-sky-500/30' : 'border-slate-800 focus:border-sky-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Entry Fee & Payment Type Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-300 mb-0.5 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-emerald-400" /> Fee ($)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      value={walkinFee}
                      onChange={(e) => setWalkinFee(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full h-10 sm:h-11 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg sm:rounded-xl px-3 text-xs sm:text-sm font-black text-emerald-400 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-300 mb-0.5 flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-sky-400" /> Payment
                    </label>
                    <select
                      value={walkinPayment}
                      onChange={(e) => setWalkinPayment(e.target.value)}
                      className="w-full h-10 sm:h-11 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg sm:rounded-xl px-3 text-xs sm:text-sm text-slate-100 font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="Cash">💵 Cash</option>
                      <option value="Baiduri">💳 Baiduri Card</option>
                      <option value="Bibd">🏦 BIBD QuickPay</option>
                      <option value="Coupon">🎟️ Coupon</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-sky-950/60 disabled:opacity-40 flex items-center justify-center gap-1.5 mt-1"
                >
                  {loading ? 'Processing...' : '🎟️ Issue Walk-In Pass'}
                </button>
              </form>
            </div>
          )}

          {/* Status Message Display Banner */}
          {statusMessage && (
            <div
              className={`p-2.5 rounded-xl border text-center font-extrabold text-xs flex items-center justify-between gap-1.5 mt-2 transition-all shadow-md ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/80'
                  : 'bg-rose-950/90 text-rose-300 border-rose-500/80'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {statusMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="line-clamp-2">{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Dismiss message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Multiple Matches Selection (for Member Check-In) */}
          {terminalMode === 'member' && matches.length > 0 && (
            <div className="border-t border-slate-800 pt-2 mt-2 space-y-2">
              <div className="flex items-center gap-1.5 text-sky-400 text-[11px] font-extrabold uppercase tracking-wider justify-center">
                <Users className="w-3.5 h-3.5" /> Multiple members matched:
              </div>

              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {matches.map((m) => (
                  <div
                    key={m.memberId}
                    className="bg-slate-950 border border-slate-800 p-2 rounded-lg flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="text-left">
                      <div className="font-bold text-slate-100 text-xs">{m.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Plan: {m.plan}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConfirmMatch(m.memberId)}
                      disabled={loading || m.status === 'Expired'}
                      className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-black text-[11px] rounded-md disabled:opacity-40"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FLOATING VIRTUAL TOUCH KEYPAD */}
        {showKeypad && (
          <div className="bg-slate-900/95 border border-slate-800/90 p-2 sm:p-3.5 rounded-2xl sm:rounded-3xl shadow-xl backdrop-blur-md space-y-1.5 sm:space-y-2.5 transition-all shrink-0">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>TOUCH KEYPAD</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                Target:
                <span
                  onClick={() =>
                    setActiveTarget(terminalMode === 'member' ? 'memberPhone' : 'walkinPhone')
                  }
                  className="bg-slate-800 text-emerald-400 px-1.5 py-0.2 rounded font-bold cursor-pointer"
                >
                  {activeTarget === 'memberPhone' ? 'Member' : 'Walk-In'}
                </span>
              </div>
            </div>

            {/* Keypad Grid (3x4 Layout) */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-11 sm:h-13 bg-slate-950 hover:bg-slate-800 active:bg-emerald-500 active:text-slate-950 border border-slate-800/80 rounded-xl text-lg sm:text-2xl font-black text-slate-100 shadow-sm transition-all flex items-center justify-center select-none"
                >
                  {digit}
                </button>
              ))}

              {/* Clear (C) */}
              <button
                type="button"
                onClick={handleKeypadClear}
                className="h-11 sm:h-13 bg-rose-950/40 hover:bg-rose-900/60 active:bg-rose-600 border border-rose-800/50 rounded-xl text-xs sm:text-sm font-extrabold text-rose-300 shadow-sm transition-all flex items-center justify-center select-none"
              >
                CLR
              </button>

              {/* Zero (0) */}
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-11 sm:h-13 bg-slate-950 hover:bg-slate-800 active:bg-emerald-500 active:text-slate-950 border border-slate-800/80 rounded-xl text-lg sm:text-2xl font-black text-slate-100 shadow-sm transition-all flex items-center justify-center select-none"
              >
                0
              </button>

              {/* Backspace (⌫) */}
              <button
                type="button"
                onClick={() => handleKeypadBackspace()}
                className="h-11 sm:h-13 bg-amber-950/40 hover:bg-amber-900/60 active:bg-amber-500 active:text-slate-950 border border-amber-800/50 rounded-xl text-xs sm:text-sm font-bold text-amber-300 shadow-sm transition-all flex items-center justify-center gap-1 select-none"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* POP-UP PAYMENT METHOD SELECTION MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-sky-400 font-extrabold">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm text-white">Select Walk-In Payment Type</span>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setWalkinPayment(opt.id);
                    setShowPaymentModal(false);
                  }}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    walkinPayment === opt.id
                      ? 'bg-sky-500/10 border-sky-500 text-white ring-2 ring-sky-500/30'
                      : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{opt.icon}</span>
                    <div>
                      <div className="font-extrabold text-xs">{opt.label}</div>
                      <div className="text-[10px] text-slate-400">{opt.desc}</div>
                    </div>
                  </div>
                  {walkinPayment === opt.id && (
                    <div className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center font-bold">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg"
            >
              Apply Selection
            </button>
          </div>
        </div>
      )}

      {/* 4-DIGIT EXIT KIOSK PIN MODAL */}
      {showExitPinModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Exit Kiosk Mode</h3>
              <p className="text-xs text-slate-400">Enter 4-digit Business PIN to unlock Staff POS</p>
            </div>

            {exitPinError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl text-center font-medium animate-shake">
                {exitPinError}
              </div>
            )}

            {/* PIN Dots */}
            <div className="flex justify-center items-center gap-3 py-1">
              {[0, 1, 2, 3].map((idx) => {
                const filled = exitPinInput.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-11 h-13 rounded-xl border flex items-center justify-center text-xl font-bold transition-all ${
                      filled
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm'
                        : 'border-slate-800 bg-slate-950 text-slate-600'
                    }`}
                  >
                    {filled ? '●' : ''}
                  </div>
                );
              })}
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => {
                    if (exitPinInput.length < 4) {
                      const nextPin = exitPinInput + digit;
                      setExitPinInput(nextPin);
                      setExitPinError(null);
                      if (nextPin.length === 4) {
                        if (nextPin === currentBusinessPin) {
                          setShowExitPinModal(false);
                          if (onBackToStaffPOS) onBackToStaffPOS();
                        } else {
                          setExitPinError('Incorrect 4-digit PIN code.');
                          setExitPinInput('');
                        }
                      }
                    }
                  }}
                  className="py-3 bg-slate-800/80 hover:bg-slate-700/80 active:bg-emerald-500 active:text-slate-950 text-white font-bold text-lg rounded-xl transition shadow-sm border border-slate-700/50"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setExitPinInput('');
                  setExitPinError(null);
                }}
                className="py-3 bg-slate-800/40 hover:bg-slate-800 text-slate-400 text-xs font-semibold rounded-xl transition"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  if (exitPinInput.length < 4) {
                    const nextPin = exitPinInput + '0';
                    setExitPinInput(nextPin);
                    setExitPinError(null);
                    if (nextPin.length === 4) {
                      if (nextPin === currentBusinessPin) {
                        setShowExitPinModal(false);
                        if (onBackToStaffPOS) onBackToStaffPOS();
                      } else {
                        setExitPinError('Incorrect 4-digit PIN code.');
                        setExitPinInput('');
                      }
                    }
                  }
                }}
                className="py-3 bg-slate-800/80 hover:bg-slate-700/80 active:bg-emerald-500 active:text-slate-950 text-white font-bold text-lg rounded-xl transition shadow-sm border border-slate-700/50"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => {
                  setExitPinInput((prev) => prev.slice(0, -1));
                  setExitPinError(null);
                }}
                className="py-3 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center justify-center"
              >
                ⌫
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowExitPinModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
            >
              Cancel & Stay in Kiosk Mode
            </button>
          </div>
        </div>
      )}

      {/* WELCOME BACK CELEBRATION MODAL */}
      {welcomeModal && (
        <div
          onClick={() => setWelcomeModal(null)}
          className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-emerald-950/80 text-center space-y-5 animate-in zoom-in-95 relative overflow-hidden"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-1 shadow-xl shadow-emerald-950/60 animate-bounce duration-1000">
                <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-emerald-400">
                  <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-full inline-block">
                  CHECK-IN VERIFIED
                </span>
                <p className="text-sm sm:text-base font-semibold text-slate-300 pt-1">
                  Welcome back,
                </p>
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  {welcomeModal.name}
                </h2>
              </div>

              {/* Member Details Pill */}
              <div className="mt-4 bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between text-left">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Membership Plan</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-200 font-mono">
                    {welcomeModal.plan || 'Standard Member'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 uppercase">
                    {welcomeModal.status || 'Active'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 pt-2 flex items-center justify-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Have a great workout today at {currentStore}!
              </p>

              <button
                type="button"
                onClick={() => setWelcomeModal(null)}
                className="mt-5 w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-sm rounded-xl transition shadow-lg shadow-emerald-950/60 cursor-pointer"
              >
                Done (Tap to Continue)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPIRED MEMBERSHIP BLOCKED MODAL */}
      {expiredModal && (
        <div
          onClick={() => setExpiredModal(null)}
          className="fixed inset-0 z-[130] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-rose-500/90 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-rose-950/80 text-center space-y-5 animate-in zoom-in-95 relative overflow-hidden"
          >
            {/* Ambient Background Warning Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/25 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-tr from-rose-500 to-amber-500 p-1 shadow-xl shadow-rose-950/60 animate-pulse">
                <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-rose-300 bg-rose-950/90 border border-rose-500/60 px-3.5 py-1 rounded-full inline-block">
                  🚫 CHECK-IN BLOCKED • STATUS: EXPIRED
                </span>
                <p className="text-xs sm:text-sm font-medium text-slate-300 pt-1">
                  Membership Expired for
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  {expiredModal.name}
                </h2>
                {expiredModal.memberId && (
                  <span className="text-xs text-slate-400 font-mono block">
                    Member #{expiredModal.memberId}
                  </span>
                )}
              </div>

              {/* Expiration Details Card */}
              <div className="mt-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Current Status:</span>
                  <span className="font-extrabold text-rose-400 bg-rose-950 border border-rose-700/60 px-2 py-0.5 rounded text-[11px] uppercase">
                    Expired
                  </span>
                </div>
                {expiredModal.expirationDate && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Expired On:</span>
                    <span className="font-bold text-slate-200 font-mono">{expiredModal.expirationDate}</span>
                  </div>
                )}
                {expiredModal.plan && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Previous Plan:</span>
                    <span className="font-bold text-slate-300">{expiredModal.plan}</span>
                  </div>
                )}
              </div>

              {/* Action notice */}
              <div className="mt-4 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 space-y-1 text-center">
                <p className="font-bold text-amber-300">Front Desk Renewal Required</p>
                <p className="text-[11px] text-slate-400">
                  Please speak with our front desk staff to renew your membership and resume access.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setExpiredModal(null)}
                className="mt-5 w-full py-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black text-sm rounded-xl transition shadow-lg shadow-rose-950/60 cursor-pointer"
              >
                Understood / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-600 max-w-md mx-auto w-full mt-1 shrink-0">
        Self Check-In Terminal
      </div>
    </div>
  );
};
