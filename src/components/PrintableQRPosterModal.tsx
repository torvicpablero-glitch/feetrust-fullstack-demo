import React, { useState } from 'react';
import { BusinessProfile, WorkerProfile, useStore } from '../lib/store';
import { Printer, Shield, Star, X, QrCode, Sparkles, Award, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  business?: BusinessProfile;
  isOpen: boolean;
  onClose: () => void;
}

export default function PrintableQRPosterModal({ business, isOpen, onClose }: Props) {
  const { appState } = useStore();

  const [theme, setTheme] = useState<'midnight' | 'obsidian' | 'indigo' | 'clean'>('midnight');
  const [headline, setHeadline] = useState('Scan to Recognize & Award Our Team!');
  const [showTeam, setShowTeam] = useState(true);

  if (!isOpen) return null;

  const userBizName = (appState.profile?.workplace || '').toLowerCase().trim();
  const matchedBiz = (appState.businesses || []).find(
    b => (userBizName && b.name && b.name.toLowerCase().trim() === userBizName)
  );

  const targetBusiness: BusinessProfile = business || matchedBiz || (appState.businesses && appState.businesses.length > 0 ? appState.businesses[0] : {
    id: 'biz_1',
    name: appState.profile?.workplace || 'FeeTrust Workplace',
    category: 'Service & Hospitality',
    address: '100 S State St, Chicago, IL',
    rating: 5.0,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://www.feetrust.com/business/biz_1',
    workers: []
  });

  const targetBizName = (targetBusiness.name || '').toLowerCase().trim();

  // 1. Direct matching workers from global store whose workplace equals this business
  const directMatching = (appState.workers || []).filter(
    w => w && w.role !== 'Business' && w.workplace && w.workplace.toLowerCase().trim() === targetBizName
  );

  // 2. Workers explicitly attached to targetBusiness.workers (if any)
  const attachedWorkers = (targetBusiness.workers || []).filter(
    w => w && w.role !== 'Business' && (!w.workplace || w.workplace.toLowerCase().trim() === targetBizName)
  );

  // Merge unique workers by ID
  const combinedMap = new Map<string, WorkerProfile>();
  [...attachedWorkers, ...directMatching].forEach(w => {
    if (w && w.id && !combinedMap.has(w.id)) {
      combinedMap.set(w.id, w);
    }
  });
  const teamList: WorkerProfile[] = Array.from(combinedMap.values());
  const qrUrl = targetBusiness.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${window.location.origin}/business/${targetBusiness.id}`;

  const handlePrint = () => {
    window.print();
  };

  const themeStyles = {
    midnight: { bg: '#140c30', cardBg: 'bg-[#1a103c]', border: 'border-cyan-400/40', text: 'text-white', accent: 'text-yellow-400', badgeBg: 'bg-cyan-400', badgeText: 'text-[#1a103c]' },
    obsidian: { bg: '#090a0f', cardBg: 'bg-[#0f111a]', border: 'border-amber-500/40', text: 'text-white', accent: 'text-amber-400', badgeBg: 'bg-amber-400', badgeText: 'text-slate-950' },
    indigo: { bg: '#1e1b4b', cardBg: 'bg-[#2e2a72]', border: 'border-indigo-400/40', text: 'text-white', accent: 'text-amber-300', badgeBg: 'bg-indigo-400', badgeText: 'text-[#1e1b4b]' },
    clean: { bg: '#ffffff', cardBg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-900', accent: 'text-indigo-600', badgeBg: 'bg-indigo-600', badgeText: 'text-white' },
  }[theme];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-['Outfit',sans-serif] overflow-y-auto">
      {/* Print Specific CSS Rules */}
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: ${themeStyles.bg} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            height: 100% !important;
            overflow: hidden !important;
          }
          /* Hide all app UI elements */
          header, aside, nav, main, footer, .no-print {
            display: none !important;
          }
          /* Show ONLY the printable poster */
          body * {
            visibility: hidden !important;
          }
          #printable-storefront-poster, #printable-storefront-poster * {
            visibility: visible !important;
          }
          #printable-storefront-poster {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100vh !important;
            max-height: 100vh !important;
            margin: 0 !important;
            padding: 1.5rem !important;
            background: ${themeStyles.bg} !important;
            color: ${theme === 'clean' ? '#0f172a' : '#ffffff'} !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            border: none !important;
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      <div className="bg-[#140c30] border border-white/20 p-6 md:p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative my-auto animate-in zoom-in duration-300">
        
        {/* Top Control Bar (Screen only) */}
        <div className="pb-4 border-b border-white/10 mb-6 space-y-4 no-print">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Printer className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-white text-lg">Custom Counter Poster Generator</h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrint}
                className="bg-gradient-to-r from-cyan-400 to-yellow-400 text-[#1a103c] font-extrabold px-4 py-2 rounded-xl text-xs flex items-center shadow-lg hover:opacity-90 transition-opacity cursor-pointer font-mono"
              >
                <Printer className="w-4 h-4 mr-1.5" /> Print Poster
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl border border-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Interactive Customizer Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 text-xs">
            {/* Palette Selection */}
            <div>
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase block mb-1">Color Palette</label>
              <div className="flex gap-1.5">
                {(['midnight', 'obsidian', 'indigo', 'clean'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold capitalize transition-all cursor-pointer ${
                      theme === t ? 'bg-cyan-400 text-[#1a103c] font-black' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Headline */}
            <div>
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase block mb-1">Headline Text</label>
              <input
                type="text"
                value={headline}
                onChange={e => setHeadline(e.target.value)}
                placeholder="Custom headline..."
                className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Staff Team Toggle */}
            <div className="flex items-center justify-between sm:justify-start sm:space-x-3 pt-4 sm:pt-0">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">Show Team:</label>
              <button
                onClick={() => setShowTeam(!showTeam)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  showTeam ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-white/10 text-slate-400'
                }`}
              >
                {showTeam ? 'Enabled' : 'Hidden'}
              </button>
            </div>
          </div>
        </div>

        {/* PRINTABLE STOREFRONT POSTER CONTAINER */}
        <div id="printable-storefront-poster" className={`${themeStyles.cardBg} border-2 ${themeStyles.border} rounded-3xl p-6 text-center relative overflow-hidden shadow-2xl ${themeStyles.text}`}>
          
          {/* Poster Brand Header */}
          <div className="flex items-center justify-center mb-1.5">
            <img src="/logo.png" alt="Feetrust Logo" className="h-11 w-auto max-w-[210px] object-contain filter drop-shadow-md" />
          </div>
          <p className="text-[11px] opacity-75 font-semibold tracking-wider uppercase mb-4 font-mono">
            Official Verified Merit Display
          </p>

          {/* Business Banner Card */}
          <div className="bg-white/5 border border-white/15 rounded-2xl p-3 mb-4 backdrop-blur-md">
            <h1 className="text-xl font-extrabold mb-0.5">{targetBusiness.name}</h1>
            <p className="text-xs opacity-90 font-bold">{targetBusiness.category} • {targetBusiness.address}</p>
          </div>

          {/* Center High-Res QR Code Card */}
          <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl border-4 border-amber-400 mb-4">
            <img
              src={qrUrl}
              alt={`${targetBusiness.name} Storefront QR Code`}
              className="w-44 h-44 md:w-52 md:h-52 mx-auto rounded-xl object-contain"
            />
          </div>

          <h2 className={`text-lg font-extrabold ${themeStyles.accent} mb-1 flex items-center justify-center`}>
            <Sparkles className="w-4 h-4 mr-1 text-amber-400" />
            {headline}
          </h2>
          <p className="text-xs opacity-80 mb-4 max-w-sm mx-auto">
            Point your smartphone camera at the QR code above to recognize exceptional service and award verified merits.
          </p>

          {/* How It Works Steps */}
          <div className="grid grid-cols-3 gap-2 bg-white/5 border border-white/10 rounded-2xl p-3 mb-4 text-left">
            <div className="flex items-start space-x-2">
              <div className={`w-5 h-5 rounded-full ${themeStyles.badgeBg} ${themeStyles.badgeText} font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5`}>1</div>
              <div>
                <p className="text-[10px] font-bold">Scan QR</p>
                <p className="text-[9px] opacity-75">Use phone camera</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className={`w-5 h-5 rounded-full ${themeStyles.badgeBg} ${themeStyles.badgeText} font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5`}>2</div>
              <div>
                <p className="text-[10px] font-bold">Select Staff</p>
                <p className="text-[9px] opacity-75">Pick your server</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className={`w-5 h-5 rounded-full ${themeStyles.badgeBg} ${themeStyles.badgeText} font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5`}>3</div>
              <div>
                <p className="text-[10px] font-bold">Give Merit</p>
                <p className="text-[9px] opacity-75">Earn customer gems</p>
              </div>
            </div>
          </div>

          {/* Featured Staff Team */}
          {showTeam && (
            <div className="text-left border-t border-white/10 pt-4">
              <p className="text-[11px] font-bold opacity-80 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Verified Store Team Members</span>
                <span className={themeStyles.accent}>{teamList.length} Active Staff</span>
              </p>
              {teamList.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-xs opacity-75">No staff members enrolled yet. Staff can scan the QR code to join this business.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {teamList.slice(0, 4).map(worker => (
                    <div key={worker.id} className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between">
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className={`w-8 h-8 rounded-lg ${themeStyles.badgeBg} ${themeStyles.badgeText} font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden`}>
                          {worker.avatar ? (
                            <img src={worker.avatar} alt={worker.name} className="w-full h-full object-cover" />
                          ) : (
                            worker.initials
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{worker.name}</p>
                          <p className="text-[10px] opacity-75 truncate">{worker.position}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-400/30 shrink-0">
                        Lvl {worker.level}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Watermark */}
          <div className="mt-6 pt-3 border-t border-white/10 flex justify-between items-center text-[10px] opacity-70">
            <span>Powered by FeeTrust Verified Merit Network</span>
            <span className="font-semibold flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Verified Business
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
