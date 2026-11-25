import React, { useEffect, useState } from 'react';
import { Download, KeyRound, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { useToast } from '../../context/ToastContext';
import {
  CURRENCY_META,
  FIELD_LIMITS,
  type CurrencyCode,
  type DateFormatOption,
  type ThemeMode,
} from '../../types/finance';
import { escapeCsvCell } from '../../lib/formatters';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ProfileAvatar } from '../ui/ProfileAvatar';

export function SettingsView() {
  const { user, isDemoMode, sendPasswordReset } = useAuth();
  const {
    profile,
    settings,
    transactions,
    budgets,
    goals,
    emiPlans,
    updateProfileInfo,
    updateSettings,
    deleteAllUserAccountData,
  } = useFinance();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    setDisplayName(
      profile?.displayName || (isDemoMode ? 'Prince Kumar' : user?.displayName || '')
    );
    setPhotoURL(isDemoMode ? '' : profile?.photoURL || user?.photoURL || '');
    setPhone(settings.phone || '');
  }, [profile, settings, user, isDemoMode]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast('Display name cannot be empty', { variant: 'error' });
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfileInfo(displayName, photoURL);
      await updateSettings({ phone: phone.trim().slice(0, FIELD_LIMITS.PHONE_MAX) });
    } catch (err) {
      showToast('Failed to update profile', {
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleExportJsonBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'PaisaTrack',
      profile,
      settings,
      transactions,
      budgets,
      goals,
      emiPlans,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `paisatrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Full JSON data backup downloaded', { variant: 'success' });
  };

  const handleExportCsvTransactions = () => {
    const lines = [
      ['Title', 'Amount', 'Type', 'Category', 'Date', 'PaymentMethod', 'Notes'].join(','),
      ...transactions.map((t) =>
        [
          escapeCsvCell(t.title),
          escapeCsvCell(t.amount),
          escapeCsvCell(t.type),
          escapeCsvCell(t.category),
          escapeCsvCell(t.date),
          escapeCsvCell(t.paymentMethod),
          escapeCsvCell(t.notes || ''),
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `paisatrack-all-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Transactions CSV downloaded', { variant: 'success' });
  };

  const handlePasswordResetTrigger = async () => {
    const targetEmail = settings.email || user?.email;
    if (!targetEmail || isDemoMode) {
      showToast('Sign in with your account email to reset your password', { variant: 'info' });
      return;
    }
    try {
      await sendPasswordReset(targetEmail);
      showToast('Password reset email sent', {
        description: `Instructions sent to ${targetEmail}.`,
        variant: 'success',
      });
    } catch (err) {
      showToast('Unable to send reset email', {
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Personal Information & Photo */}
      <form
        onSubmit={(e) => void handleSaveProfile(e)}
        className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Personal Information
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage your profile name, avatar, and contact preferences
            </p>
          </div>
          <UserCheck className="w-5 h-5 text-violet-500" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <ProfileAvatar
            name={displayName || (isDemoMode ? 'Prince Kumar' : 'PaisaTrack User')}
            photoURL={isDemoMode ? '' : photoURL}
            size="lg"
          />
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {displayName || (isDemoMode ? 'Prince Kumar' : 'PaisaTrack User')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isDemoMode
                ? 'Initials-based avatar is active for the Prince Kumar demo profile.'
                : 'Uses your circular initials avatar by default or a custom profile image URL below.'}
            </p>
            {!isDemoMode && photoURL && (
              <button
                type="button"
                onClick={() => setPhotoURL('')}
                className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
              >
                Switch back to initials avatar
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.DISPLAY_NAME_MAX}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              disabled
              value={settings.email || user?.email || 'demo.preview@paisatrack.app'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#101827]/60 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Phone (Optional)
            </label>
            <input
              type="tel"
              maxLength={FIELD_LIMITS.PHONE_MAX}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98200 00000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
            />
          </div>
          {!isDemoMode && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Profile Photo URL (Optional)
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.PHOTO_URL_MAX}
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-60"
          >
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* Currency, Date Format & Theme Preferences */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Display &amp; Regional Preferences
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Changes sync immediately across all dashboards and exports
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Currency
            </label>
            <select
              value={settings.currency}
              onChange={(e) => void updateSettings({ currency: e.target.value as CurrencyCode })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
            >
              {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_META[code].label} — {CURRENCY_META[code].name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Date Format
            </label>
            <select
              value={settings.dateFormat}
              onChange={(e) => void updateSettings({ dateFormat: e.target.value as DateFormatOption })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
            >
              <option value="DD MMM YYYY">25 Nov 2026 (DD MMM YYYY)</option>
              <option value="MM/DD/YYYY">11/25/2026 (MM/DD/YYYY)</option>
              <option value="YYYY-MM-DD">2026-11-25 (YYYY-MM-DD)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Appearance Theme
            </label>
            <select
              value={settings.theme}
              onChange={(e) => void updateSettings({ theme: e.target.value as ThemeMode })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
            >
              <option value="dark">Deep Navy Dark (Default)</option>
              <option value="light">Crisp Light</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Notification &amp; Alert Preferences
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control automated budget, goal, unusual spend, and EMI reminders
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {[
            {
              key: 'notificationsEnabled' as const,
              title: 'Enable Smart Financial Alerts',
              desc: 'Master toggle for all automated alerts in your notification center',
            },
            {
              key: 'budgetAlertsEnabled' as const,
              title: 'Budget Threshold Alerts',
              desc: 'Notify when spending reaches 50%, 75%, 90%, or 100% of a category limit',
            },
            {
              key: 'unusualSpendingEnabled' as const,
              title: 'Unusual Spending Alerts',
              desc: 'Flag categories jumping over 35% compared to the previous month',
            },
            {
              key: 'goalRemindersEnabled' as const,
              title: 'Savings Goal Reminders',
              desc: 'Highlight approaching target dates for underfunded savings goals',
            },
            {
              key: 'emiRemindersEnabled' as const,
              title: 'Upcoming EMI Reminders',
              desc: 'Remind before monthly due dates for saved loan EMI plans',
            },
            {
              key: 'monthlySummaryEnabled' as const,
              title: 'Monthly Financial Summary',
              desc: 'Surface end-of-month savings rate and cash-flow wrap-ups',
            },
          ].map((item) => (
            <label
              key={item.key}
              className="py-3 flex items-center justify-between gap-4 cursor-pointer"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings[item.key])}
                onChange={(e) => void updateSettings({ [item.key]: e.target.checked })}
                className="w-4.5 h-4.5 accent-violet-600 rounded"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Security, Export & Account Deletion */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Security, Data Export &amp; Account Control
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified account isolation and full data portability
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handlePasswordResetTrigger()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Send Password Reset Email
          </button>

          <button
            type="button"
            onClick={handleExportCsvTransactions}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            Export All Transactions (CSV)
          </button>

          <button
            type="button"
            onClick={handleExportJsonBackup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            Full Archive Backup (JSON)
          </button>
        </div>

        {!isDemoMode && user && (
          <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                Delete Account &amp; Financial Data
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Permanently removes your profile, transactions, budgets, goals, and authentication record.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Account
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Permanently Delete Account"
        description="All transactions, budgets, savings goals, notifications, and your user profile will be permanently erased. Export a backup first if needed."
        confirmLabel="Delete Everything"
        busy={deletingAccount}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={async () => {
          setDeletingAccount(true);
          try {
            await deleteAllUserAccountData();
            setDeleteDialogOpen(false);
          } catch (err) {
            showToast('Unable to delete account', {
              description: err instanceof Error ? err.message : 'Please try again.',
              variant: 'error',
            });
          } finally {
            setDeletingAccount(false);
          }
        }}
      />
    </div>
  );
}
