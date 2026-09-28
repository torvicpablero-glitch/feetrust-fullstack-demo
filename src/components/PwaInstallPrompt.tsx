import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    // Check if user already dismissed or installed app
    const dismissed = localStorage.getItem('feetrust_pwa_dismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    if (dismissed || isStandalone) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(iosDevice);

    if (iosDevice && !(navigator as any).standalone) {
      setShowPrompt(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      toast.success("Tap 'Add to Home Screen' in your mobile browser menu!", {
        icon: '📱',
      });
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success("FeeTrust installed on your home screen!");
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('feetrust_pwa_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300 font-['Outfit',sans-serif]">
      {/* iOS Step-by-Step Instructions Modal */}
      {showIosInstructions ? (
        <div className="space-y-3 py-1">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center">
              <Share className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" /> Install on iPhone / iPad
            </h4>
            <button onClick={() => setShowIosInstructions(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Close instructions">
              <X className="w-4 h-4" />
            </button>
          </div>
          <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pl-4 list-decimal font-medium">
            <li>Tap the <span className="font-bold text-indigo-600 dark:text-indigo-400">Share</span> button at bottom of Safari.</li>
            <li>Scroll down and select <span className="font-bold text-slate-900 dark:text-slate-100 flex-inline items-center"><PlusSquare className="w-3.5 h-3.5 inline mx-1" /> Add to Home Screen</span>.</li>
            <li>Tap <span className="font-bold text-indigo-600 dark:text-indigo-400">Add</span> in top right corner.</li>
          </ol>
          <button
            onClick={handleDismiss}
            className="w-full py-2 bg-indigo-600 dark:bg-indigo-500 text-white font-bold rounded-xl text-xs hover:opacity-90 transition-opacity cursor-pointer mt-2"
          >
            Got It!
          </button>
        </div>
      ) : (
        /* Regular Mobile Banner */
        <>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="Feetrust Logo" className="h-9 w-auto max-w-[130px] object-contain shrink-0 filter dark:drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Install FeeTrust App</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Fast 1-tap home screen access & offline maps!</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              aria-label="Close install banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-xl text-xs flex items-center justify-center shadow-md hover:opacity-95 transition-opacity cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Install Mobile App
            </button>
            <button
              onClick={handleDismiss}
              className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Not Now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
