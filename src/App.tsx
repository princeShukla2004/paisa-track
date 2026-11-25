import React, { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider } from './context/FinanceContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './components/landing/LandingPage';
import { AuthModal, type AuthModalMode } from './components/auth/AuthModal';
import { VerifyEmailGate } from './components/auth/VerifyEmailGate';
import { DashboardWorkspace } from './components/dashboard/DashboardWorkspace';
import { BrandLogo } from './components/ui/BrandLogo';

function AppRouter() {
  const { user, authReady, isDemoMode, enterDemoMode } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>('login');
  const [resetOobCode, setResetOobCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const code = params.get('oobCode');
    if (mode === 'resetPassword' && code) {
      setResetOobCode(code);
      setAuthMode('reset');
      setAuthModalOpen(true);
    }
  }, []);

  const openAuth = (mode: AuthModalMode = 'login') => {
    setResetOobCode(null);
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#101827] text-slate-200 gap-4">
        <BrandLogo size="lg" />
        <p className="text-xs text-slate-400">Initializing secure workspace...</p>
      </div>
    );
  }

  const isVerifiedSignedIn = Boolean(user && user.emailVerified);
  const needsEmailVerification = Boolean(user && !user.emailVerified);

  return (
    <>
      {needsEmailVerification ? (
        <VerifyEmailGate />
      ) : isVerifiedSignedIn || isDemoMode ? (
        <DashboardWorkspace onOpenAuth={() => openAuth('login')} />
      ) : (
        <LandingPage onOpenAuth={openAuth} onExploreDemo={enterDemoMode} />
      )}

      <AuthModal
        open={authModalOpen}
        initialMode={authMode}
        oobCode={resetOobCode}
        onClose={() => setAuthModalOpen(false)}
        onEnterDemo={enterDemoMode}
      />
    </>
  );
}

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => {
      setMapsQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        {mapsQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        <ToastProvider>
          <AuthProvider>
            <FinanceProvider>
              <AppRouter />
            </FinanceProvider>
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}
