import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Map, User as UserIcon, Diamond, Ticket, Menu, X, LogOut, Shield, Moon, Sun, Building, Wallet, Mail, Headphones, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { useStore } from '../lib/store';
import PwaInstallPrompt from './PwaInstallPrompt';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import PricingPlansModal from './PricingPlansModal';
import CelebrationFX from './CelebrationFX';
import { soundEngine } from '../lib/audio';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('feetrust_theme') === 'dark');
  const [isMuted, setIsMuted] = useState(() => soundEngine.getIsMuted());
  const { appState, user, signOut } = useStore();
  const location = useLocation();

  const toggleTheme = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    localStorage.setItem('feetrust_theme', nextMode ? 'dark' : 'light');
    soundEngine.playClick();
  };

  const toggleSound = () => {
    const nextMuted = soundEngine.toggleMute();
    setIsMuted(nextMuted);
  };


  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const navItems = [
    { to: '/', icon: Map, label: 'Map' },
    { to: '/profile', icon: UserIcon, label: 'Profile' },
    { to: '/gems', icon: Diamond, label: 'My Gems' },
    ...(appState.profile.role === 'Business' ? [{ to: '/business', icon: Building, label: 'Business' }] : []),
    ...(appState.profile.role === 'Admin' ? [{ to: '/admin', icon: Shield, label: 'Admin Portal' }] : []),
  ];

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/profile': return 'My Profile';
      case '/gems': return 'My Gems & Level';
      case '/coupons': return 'Coupons & Rewards';
      default: return 'Merit Map';
    }
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row font-['Outfit',sans-serif] relative overflow-x-hidden transition-colors duration-300 ${
      darkMode ? 'dark bg-[#090a0f] text-slate-100' : 'bg-[#fdfdfd] text-slate-900'
    }`}>
      {/* Crystalline Grain/Frost Noise Texture Filter */}
      <svg className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-[0.03] z-100">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* Abstract Molecular Background & Glass Ambient Orbs */}
      <div className={`fixed inset-0 pointer-events-none z-0 ${
        darkMode 
          ? 'bg-[radial-gradient(circle_at_20%_20%,#151828_0%,transparent_45%),radial-gradient(circle_at_80%_80%,#0e101c_0%,transparent_45%)]'
          : 'bg-[radial-gradient(circle_at_20%_20%,#ffffff_0%,transparent_45%),radial-gradient(circle_at_80%_80%,#f1f5f9_0%,transparent_45%)]'
      }`} />
      <div className="fixed top-[-10%] left-[-5%] w-[45vw] h-[45vw] rounded-full bg-linear-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/5 blur-[100px] pointer-events-none z-0 animate-pulse duration-8000" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-linear-to-tr from-purple-500/10 via-pink-500/5 to-blue-500/10 blur-[100px] pointer-events-none z-0 animate-pulse duration-10000" />

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white/85 dark:bg-[#0c0e17]/90 border-b border-slate-200/80 dark:border-slate-800 backdrop-blur-xl sticky top-0 z-50 shadow-xs transition-colors">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          className="p-2 bg-white/90 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer text-slate-700 dark:text-slate-200"
          aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {sidebarOpen ? <X className="w-6 h-6 text-amber-600" /> : <Menu className="w-6 h-6 text-blue-600" />}
        </button>
        <div className="flex items-center space-x-2">
          <img 
            src="/logo.png" 
            alt="Feetrust Logo" 
            className="h-7.5 w-auto max-w-34 object-contain filter dark:drop-shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-transform hover:scale-105" 
          />
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 px-3 py-1 rounded-full text-xs font-bold text-amber-800 dark:text-amber-300 shadow-2xs font-mono">
            <Diamond className="w-3.5 h-3.5 text-amber-500" />
            <span>{appState.profile.gems?.toLocaleString() || 0}</span>
          </div>

          {/* Sound Toggle (Mobile) */}
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded-full border text-xs transition-all cursor-pointer ${
              isMuted 
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400' 
                : 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300'
            }`}
            title={isMuted ? "Audio Muted (Click to Unmute)" : "Audio Active (Click to Mute)"}
            aria-label="Toggle sound effects"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Sidebar (Responsive Mobile Drawer + Desktop Fixed) */}
      <aside 
        className={`fixed md:sticky top-0 left-0 h-screen w-72 p-6 flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#0c0e17]/95 backdrop-blur-2xl z-50 shadow-sm transition-all duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="mb-6 flex items-center justify-between relative">
          <div className="flex flex-col w-full">
            <div className="flex items-center justify-center py-1">
              <img 
                src="/logo.png" 
                alt="Feetrust Logo" 
                className="h-13.5 md:h-17 w-auto max-w-51 object-contain transition-transform hover:scale-105 filter dark:drop-shadow-[0_0_14px_rgba(59,130,246,0.35)]" 
              />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 block mt-2 font-bold pl-1">VERIFIED MERIT SYSTEM</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-2 focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg absolute top-0 right-0"
            aria-label="Close navigation sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                soundEngine.playClick();
                setSidebarOpen(false);
              }}
              className={({ isActive }) =>
                `flex items-center px-4 py-3.5 rounded-2xl font-semibold text-sm transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive
                    ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/20 scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`
              }
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer Profile & Sign In / Out */}
        <div className="mt-auto space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center mr-3 shrink-0 shadow-xs">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : 'FT'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user?.name || 'Guest User'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email || 'user@feetrust.com'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NavLink
              to="/auth"
              onClick={() => {
                soundEngine.playClick();
                setSidebarOpen(false);
              }}
              className="flex items-center justify-center px-3 py-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-xs font-bold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5 rotate-180" />
              Sign In
            </NavLink>

            <button
              onClick={() => {
                soundEngine.playClick();
                signOut();
                setSidebarOpen(false);
              }}
              className="flex items-center justify-center px-3 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors text-xs font-bold cursor-pointer"
              aria-label="Sign out of account"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign Out
            </button>
          </div>

          {/* Customer Service Tab at Sidebar Bottom */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">Customer Support</span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold">// 24/7 Live Assistance</span>
                </div>
              </div>

              <a
                href="mailto:jm@feetrust.com"
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 hover:bg-linear-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:border-transparent transition-all text-xs font-bold font-mono shadow-2xs group cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 group-hover:text-white transition-colors shrink-0" />
                <span className="truncate group-hover:text-white">jm@feetrust.com</span>
              </a>
            </div>

            {/* Business Pricing & Privacy Footer Links */}
            <div className="pt-2 flex flex-col items-center space-y-1.5 text-center">
              {appState.profile.role !== 'Worker' && appState.profile.role !== 'Customer' && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setShowPricingModal(true);
                  }}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold transition-colors cursor-pointer inline-flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  <span>Business Pricing Plans</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setShowPrivacyModal(true);
                }}
                className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer inline-flex items-center space-x-1"
              >
                <Shield className="w-3 h-3 text-slate-400" />
                <span>Privacy Policy & Terms</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
        {/* Top Right Desktop Controls */}
        <div className="hidden md:flex absolute top-6 right-8 z-40 items-center space-x-3">
          {/* Sound Synthesizer Toggle */}
          <button
            onClick={toggleSound}
            className={`px-3 py-2 rounded-full flex items-center space-x-1.5 text-xs font-mono font-bold transition-all hover:scale-105 shadow-md cursor-pointer border ${
              isMuted 
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400' 
                : 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300'
            }`}
            title={isMuted ? "Sound Effects Muted (Click to Turn On)" : "Sound Effects Active (Click to Mute)"}
            aria-label="Toggle audio effects"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-indigo-500 animate-pulse" />}
            <span>{isMuted ? 'MUTED' : 'AUDIO ON'}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto p-4 md:p-8 pb-20 md:pb-8 relative">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0c0e17]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-around items-center p-2.5 z-40 shadow-lg">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => soundEngine.playClick()}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? 'bg-linear-to-br from-blue-600 to-indigo-600 text-white font-bold shadow-md scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`
            }
          >
            <item.icon className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      {/* Global Particle & Confetti Canvas Engine */}
      <CelebrationFX />

      {/* PWA Install Prompt Banner */}
      <PwaInstallPrompt />

      {/* Mobile Drawer Overlay Backdrop */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Privacy Policy & Terms Modal */}
      <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />

      {/* Pricing Plans Modal */}
      <PricingPlansModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
    </div>
  );
}

