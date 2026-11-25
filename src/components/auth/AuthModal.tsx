import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BrandLogo } from '../ui/BrandLogo';

export type AuthModalMode = 'login' | 'register' | 'forgot' | 'reset';

interface AuthModalProps {
  open: boolean;
  initialMode?: AuthModalMode;
  oobCode?: string | null;
  onClose: () => void;
  onEnterDemo: () => void;
}

export function AuthModal({
  open,
  initialMode = 'login',
  oobCode = null,
  onClose,
  onEnterDemo,
}: AuthModalProps) {
  const {
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    confirmPasswordResetCode,
  } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(oobCode ? 'reset' : initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [open, initialMode, oobCode]);

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      showToast('Welcome to PaisaTrack', { variant: 'success' });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (mode === 'forgot') {
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      setBusy(true);
      try {
        await sendPasswordReset(email);
        setSuccessMsg('Password reset instructions have been sent to your email.');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to send reset email.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'reset') {
      if (!oobCode) {
        setErrorMsg('Missing password reset verification code.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('New password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
      setBusy(true);
      try {
        await confirmPasswordResetCode(oobCode, password);
        setSuccessMsg('Your password has been updated. You can sign in now.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to reset password.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setErrorMsg('Please enter your full name.');
          setBusy(false);
          return;
        }
        await registerWithEmail(name, email, password);
        showToast('Account created', {
          description: 'Please check your inbox to verify your email.',
          variant: 'success',
        });
        onClose();
      } else {
        await signInWithEmail(email, password);
        showToast('Signed in successfully', { variant: 'success' });
        onClose();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-[22px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-7 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <BrandLogo size="sm" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close authentication modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {mode === 'login' && 'Sign in to your account'}
                {mode === 'register' && 'Create your PaisaTrack account'}
                {mode === 'forgot' && 'Reset your password'}
                {mode === 'reset' && 'Set a new password'}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {mode === 'login' && 'Access your encrypted personal ledger, budgets, and AI insights.'}
                {mode === 'register' && 'Start tracking your finances with per-user cloud persistence.'}
                {mode === 'forgot' && 'Enter your account email and we will send a reset link.'}
                {mode === 'reset' && 'Choose a strong password for your PaisaTrack account.'}
              </p>
            </div>

            {(mode === 'login' || mode === 'register') && (
              <div className="mt-5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleGoogleAuth()}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#101827] hover:bg-slate-100 dark:hover:bg-white/5 text-sm font-medium text-slate-900 dark:text-white transition-colors disabled:opacity-60"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  Continue with Google
                </button>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                  <span className="text-xs text-slate-400">or with email</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300 leading-relaxed">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3.5">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Priya Sharma"
                      maxLength={80}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                </div>
              )}

              {mode !== 'reset' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      maxLength={160}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                </div>
              )}

              {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {mode === 'reset' ? 'New Password' : 'Password'}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'reset' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-violet-600/20 transition-all disabled:opacity-60"
              >
                {busy
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                  ? 'Create Free Account'
                  : mode === 'forgot'
                  ? 'Send Reset Link'
                  : 'Update Password'}
                {!busy && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col gap-2 text-center text-xs text-slate-500 dark:text-slate-400">
              {mode === 'login' ? (
                <p>
                  New to PaisaTrack?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEnterDemo();
                }}
                className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
              >
                Or explore the interactive Demo Dashboard first
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
