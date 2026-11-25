import React, { useState } from 'react';
import { CheckCircle2, LogOut, MailCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BrandLogo } from '../ui/BrandLogo';

export function VerifyEmailGate() {
  const { user, resendVerificationEmail, refreshUser, logout } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleResend = async () => {
    setBusy(true);
    try {
      await resendVerificationEmail();
      showToast('Verification email sent', {
        description: `Check ${user?.email || 'your inbox'} for the verification link.`,
        variant: 'success',
      });
    } catch (err) {
      showToast('Unable to send verification email', {
        description: err instanceof Error ? err.message : 'Please try again later.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    try {
      await refreshUser();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#101827] px-4">
      <div className="max-w-md w-full rounded-[20px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-7 shadow-2xl text-center">
        <div className="flex justify-center mb-5">
          <BrandLogo />
        </div>
        <div className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-500 dark:text-violet-400 flex items-center justify-center mx-auto mb-4">
          <MailCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Verify Your Email Address</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          To protect your financial records, PaisaTrack requires email verification before enabling cloud sync for{' '}
          <span className="font-medium text-slate-900 dark:text-slate-200">{user?.email}</span>.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleRefresh()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4" />
            I Have Verified — Continue
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleResend()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-60"
          >
            <RefreshCw className="w-4 h-4" />
            Resend Verification Email
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
