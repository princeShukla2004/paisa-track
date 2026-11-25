import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isDemoMode: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  confirmPasswordResetCode: (oobCode: string, newPassword: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserDisplay: (displayName: string, photoURL?: string) => Promise<void>;
  deleteAuthAccount: () => Promise<void>;
  logout: () => Promise<void>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapFirebaseAuthError(err: unknown): Error {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return new Error(
        'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). You can use Google Sign-In immediately or enable Email/Password in Firebase Console.'
      );
    case 'auth/email-already-in-use':
      return new Error('An account with this email already exists. Try signing in instead.');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('Invalid email or password. Please check your credentials.');
    case 'auth/weak-password':
      return new Error('Password should be at least 6 characters long.');
    case 'auth/popup-closed-by-user':
      return new Error('Sign-in popup was closed before completing.');
    case 'auth/too-many-requests':
      return new Error('Too many attempts. Please wait a few minutes and try again.');
    case 'auth/requires-recent-login':
      return new Error('For security, please sign out and sign back in before deleting your account.');
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return new Error('This password reset link is invalid or has expired. Request a new one.');
    default:
      return err instanceof Error ? err : new Error('Authentication failed. Please try again.');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setIsDemoMode(false);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setIsDemoMode(false);
    } catch (err) {
      throw mapFirebaseAuthError(err);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setIsDemoMode(false);
    } catch (err) {
      throw mapFirebaseAuthError(err);
    }
  }, []);

  const registerWithEmail = useCallback(async (name: string, email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim().slice(0, 80) });
      }
      await sendEmailVerification(cred.user);
      setIsDemoMode(false);
    } catch (err) {
      throw mapFirebaseAuthError(err);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      throw mapFirebaseAuthError(err);
    }
  }, []);

  const confirmPasswordResetCode = useCallback(async (oobCode: string, newPassword: string) => {
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
    } catch (err) {
      throw mapFirebaseAuthError(err);
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      throw mapFirebaseAuthError(err);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser(auth.currentUser ? ({ ...auth.currentUser } as User) : null);
  }, []);

  const updateUserDisplay = useCallback(async (displayName: string, photoURL?: string) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, {
      displayName: displayName.trim().slice(0, 80),
      ...(photoURL !== undefined ? { photoURL: photoURL.trim().slice(0, 500) } : {}),
    });
  }, []);

  const deleteAuthAccount = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      await deleteUser(auth.currentUser);
    } catch (err) {
      throw mapFirebaseAuthError(err);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsDemoMode(false);
    if (auth.currentUser) {
      await signOut(auth);
    }
  }, []);

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
  }, []);

  const exitDemoMode = useCallback(() => {
    setIsDemoMode(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isDemoMode,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        sendPasswordReset,
        confirmPasswordResetCode,
        resendVerificationEmail,
        refreshUser,
        updateUserDisplay,
        deleteAuthAccount,
        logout,
        enterDemoMode,
        exitDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
