/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import MapPage from './pages/MapPage';
import ProfilePage from './pages/ProfilePage';
import GemsPage from './pages/GemsPage';
import CouponsPage from './pages/CouponsPage';
import BusinessDashboardPage from './pages/BusinessDashboardPage';
import AdminPortalPage from './pages/AdminPortalPage';

import OnboardingPage from './pages/OnboardingPage';
import LegalPage from './pages/LegalPage';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import { isUserOnboarded, getSavedUser } from './lib/auth';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[CRITICAL] Uncaught application error:", error, errorInfo);
  }

  handleClearCacheAndReset = () => {
    try {
      localStorage.removeItem('feetrust_user');
      localStorage.removeItem('feetrust_token');
      localStorage.removeItem('feetrust_app_state');
      localStorage.removeItem('feetrust_onboarded_emails');
      localStorage.removeItem('cached_workers');
      localStorage.removeItem('cached_businesses');
      sessionStorage.clear();
    } catch (e) {}
    window.location.href = '/auth';
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Unexpected application state error.';
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-6 text-center font-['Outfit',sans-serif]">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 rounded-3xl flex items-center justify-center mb-4 text-rose-600 dark:text-rose-400 font-black text-2xl border border-rose-200 dark:border-rose-800/60 shadow-xs">
            !
          </div>
          <h1 className="text-2xl md:text-3xl font-black mb-2 text-slate-900 dark:text-slate-100">Something went wrong</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md text-sm leading-relaxed">
            We encountered an unexpected error while loading this page. You can reload or reset the session cache.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
            <button 
              onClick={() => window.location.reload()} 
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:opacity-95 transition-opacity shadow-md cursor-pointer text-sm"
            >
              Reload Page
            </button>
            <button 
              onClick={this.handleClearCacheAndReset} 
              className="w-full sm:w-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer text-sm"
            >
              Clear Cache & Sign In Again
            </button>
          </div>

          <details className="text-left max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-600 dark:text-slate-400 overflow-x-auto">
            <summary className="cursor-pointer font-bold text-slate-700 dark:text-slate-300 select-none">
              View Technical Diagnostic Info
            </summary>
            <p className="mt-2 text-rose-600 dark:text-rose-400 break-words font-semibold">{errorMsg}</p>
            {this.state.error?.stack && (
              <pre className="mt-2 text-[10px] text-slate-400 whitespace-pre-wrap leading-tight">
                {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
              </pre>
            )}
          </details>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { needsAuth, user, appState } = useStore();
  const savedUser = getSavedUser();
  const effectiveUser = user || savedUser;
  const isAuthenticated = !needsAuth || Boolean(effectiveUser);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const userEmail = effectiveUser?.email || appState?.profile?.email;
  const isSetupDone = isUserOnboarded(userEmail);

  if (!isSetupDone) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const { needsAuth, user, appState } = useStore();
  const navigate = useNavigate();

  const savedUser = getSavedUser();
  const effectiveUser = user || savedUser;
  const userEmail = effectiveUser?.email || appState?.profile?.email;
  const isSetupDone = isUserOnboarded(userEmail);
  const isAuthenticated = !needsAuth || Boolean(effectiveUser);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      
      if (e.key === 'm' || e.key === 'M') {
        navigate('/');
      } else if (e.key === 'p' || e.key === 'P') {
        navigate('/profile');
      } else if (e.key === 'g' || e.key === 'G') {
        navigate('/gems');
      } else if (e.key === 'c' || e.key === 'C') {
        navigate('/coupons');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <Routes>
      {/* Public Routes */}
      {/* Private/Hidden preview route for internal stakeholder review prior to public launch */}
      <Route path="/_preview-landing" element={<LandingPage />} />
      <Route path="/terms" element={<LegalPage />} />
      <Route path="/privacy" element={<LegalPage />} />
      <Route path="/auth" element={
        !isAuthenticated ? <AuthPage /> : (isSetupDone ? <Navigate to="/" replace /> : <Navigate to="/onboarding" replace />)
      } />
      <Route path="/onboarding" element={
        !isAuthenticated ? <Navigate to="/auth" replace /> : <OnboardingPage />
      } />

      {/* Main App Routes (Protected: unauthenticated visitors redirect to /auth) */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<MapPage />} />
      </Route>

      {/* Protected App Sub-routes */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/map" element={<MapPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/gems" element={<GemsPage />} />
        <Route path="/coupons" element={<CouponsPage />} />
        <Route path="/business" element={<BusinessDashboardPage />} />
        <Route path="/dashboard" element={<BusinessDashboardPage />} />
        <Route path="/admin" element={<AdminPortalPage />} />
      </Route>

      {/* 404 Fallback Catch-All Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </StoreProvider>
    </ErrorBoundary>
  );
}

