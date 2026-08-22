import React, { useState } from 'react';
import { Smartphone, CheckCircle, AlertCircle, Users, X } from 'lucide-react';
import { CheckInResponse, MemberMatch } from '../../types';

interface PhoneCheckinTabProps {
  onCheckinPhone: (phone: string) => Promise<CheckInResponse>;
  onCheckinId: (memberId: string) => Promise<CheckInResponse>;
}

export const PhoneCheckinTab: React.FC<PhoneCheckinTabProps> = ({
  onCheckinPhone,
  onCheckinId,
}) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [matches, setMatches] = useState<MemberMatch[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setStatusMessage(null);
    setMatches([]);

    try {
      const res = await onCheckinPhone(phone.trim());
      if (res.isExpired) {
        const member = res.members?.[0];
        const name = member?.fullName || 'Member';
        setStatusMessage({
          type: 'error',
          text: res.message || `🚫 Check-In Blocked: ${name} is EXPIRED. Current status is Expired. Please renew membership.`,
        });
      } else if (res.multiple && res.members) {
        setMatches(res.members);
      } else if (res.success) {
        const memberName = res.members?.[0]?.fullName;
        setStatusMessage({
          type: 'success',
          text: memberName ? `Welcome back, ${memberName}! Check-in verified.` : (res.message || 'Check-in verified successfully!'),
        });
        setPhone('');
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Member check-in failed. Please enter the exact registered phone number.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Network error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMatch = async (memberId: string) => {
    setLoading(true);
    try {
      const res = await onCheckinId(memberId);
      if (res.isExpired) {
        const matchedName = res.members?.[0]?.fullName || matches.find((m) => m.memberId === memberId)?.fullName || `Member #${memberId}`;
        setStatusMessage({
          type: 'error',
          text: res.message || `🚫 Check-In Blocked: ${matchedName} is EXPIRED. Current status is Expired. Please renew membership.`,
        });
      } else if (res.success) {
        const matchedName = res.members?.[0]?.fullName || matches.find((m) => m.memberId === memberId)?.fullName;
        setStatusMessage({
          type: 'success',
          text: matchedName ? `Welcome back, ${matchedName}! Check-in verified.` : (res.message || 'Check-in verified successfully!'),
        });
        setMatches([]);
        setPhone('');
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Check-in failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Network error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">Manual Phone Number Check-In</h3>
          <p className="text-xs text-slate-400">
            Enter the member's registered phone number to recognize and log check-in.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Registered Phone Number
          </label>
          <div className="relative">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number..."
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 text-base placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono tracking-wider"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !phone.trim()}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Processing Check-In...' : 'Check-In Member'}
        </button>
      </form>

      {/* Alert Status */}
      {statusMessage && (
        <div
          className={`mt-4 p-4 rounded-xl flex items-center justify-between gap-3 border text-sm font-semibold animate-in fade-in duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
              : 'bg-rose-950/80 text-rose-300 border-rose-600/60'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="leading-snug">{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Multiple Matches Modal or Card selection */}
      {matches.length > 0 && (
        <div className="mt-5 border-t border-slate-800 pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
            <Users className="w-4 h-4" />
            Multiple members match this phone number. Select one:
          </div>

          <div className="space-y-2">
            {matches.map((m) => (
              <div
                key={m.memberId}
                className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-slate-100 text-sm">{m.fullName}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    ID: {m.memberId} | {m.phone} | {m.plan}
                  </div>
                  <div className="mt-1">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        m.status === 'Active'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleConfirmMatch(m.memberId)}
                  disabled={loading || m.status === 'Expired'}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  Check In
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
