import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Home, ArrowLeft, LogIn, ShieldAlert } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-6 text-center font-['Outfit',sans-serif] relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Visual Badge */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-linear-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xl shadow-indigo-500/25">
          <Compass className="w-10 h-10 animate-spin-slow" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-black tracking-widest text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800/60">
            Error 404 • Destination Not Found
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight pt-1">
            Lost in the Network?
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            The page or establishment you are looking for has moved, expired, or does not exist on the FeeTrust merit ledger.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-md hover:opacity-95 transition-all text-xs flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Go to Home Page</span>
          </button>

          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs flex items-center justify-center space-x-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>

        {/* Helpful Shortcuts */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-left">
          <button
            onClick={() => navigate('/auth')}
            className="p-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-blue-500" />
            <span>Sign In / Register</span>
          </button>

          <button
            onClick={() => navigate('/terms')}
            className="p-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-2 cursor-pointer"
          >
            <Compass className="w-4 h-4 text-indigo-500" />
            <span>Terms & Privacy</span>
          </button>
        </div>
      </div>
    </div>
  );
}
