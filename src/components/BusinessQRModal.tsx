import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, BusinessProfile, WorkerProfile, isWorkerManagerAffiliated } from '../lib/store';
import { 
  QrCode, 
  Building, 
  Users, 
  Star, 
  X, 
  Copy, 
  Award, 
  Printer, 
  Search, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import PrintableQRPosterModal from './PrintableQRPosterModal';
import { soundEngine } from '../lib/audio';

interface Props {
  business?: BusinessProfile;
  isOpen: boolean;
  onClose: () => void;
  onSelectWorker: (worker: WorkerProfile) => void;
}

export default function BusinessQRModal({ business, isOpen, onClose, onSelectWorker }: Props) {
  const navigate = useNavigate();
  const { appState, user } = useStore();
  const [activeTab, setActiveTab] = useState<'team' | 'qr'>('team');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  if (!isOpen) return null;

  const userBizName = (appState.profile?.workplace || '').toLowerCase().trim();
  const matchedBiz = (appState.businesses || []).find(
    b => (userBizName && b.name && b.name.toLowerCase().trim() === userBizName) || ((b as any)?.user_id && (b as any).user_id === user?.uid)
  );

  const targetBusiness: BusinessProfile = business || matchedBiz || (appState.businesses && appState.businesses.length > 0 ? appState.businesses[0] : {
    id: 'biz_default',
    name: appState.profile?.workplace || 'FeetTrust Workplace',
    category: 'Service & Hospitality',
    address: '100 S State St, Chicago, IL',
    rating: 5.0,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=https://www.feetrust.com/business/feetrust`,
    workers: []
  });

  const targetBizName = (targetBusiness.name || '').toLowerCase().trim();

  const isOwner = Boolean(
    user && (
      (user.role === 'Business' || appState.profile?.role === 'Business') &&
      (
        Boolean((targetBusiness as any).user_id && (targetBusiness as any).user_id === user.uid) ||
        Boolean(userBizName && targetBizName && userBizName === targetBizName)
      )
    )
  );

  // 1. Direct matching workers from global store whose workplace equals this business
  const directMatching = (appState.workers || []).filter(
    w => w && w.role !== 'Business' && w.workplace && w.workplace.toLowerCase().trim() === targetBizName
  );

  // 2. Workers explicitly attached to targetBusiness.workers (if any), filtering out mismatch or business roles
  const attachedWorkers = (targetBusiness.workers || []).filter(
    w => w && w.role !== 'Business' && (!w.workplace || w.workplace.toLowerCase().trim() === targetBizName)
  );

  // Merge unique workers: global up-to-date worker data overrides stale attached copies
  const combinedMap = new Map<string, WorkerProfile>();
  attachedWorkers.forEach(w => {
    if (w && w.id) combinedMap.set(w.id, w);
  });
  directMatching.forEach(w => {
    if (w && w.id) {
      // Match existing by ID or matching name
      const existingKey = Array.from(combinedMap.keys()).find(k => {
        const ew = combinedMap.get(k);
        return k === w.id || (ew && ew.name && w.name && ew.name.toLowerCase().trim() === w.name.toLowerCase().trim());
      });
      if (existingKey) {
        const existing = combinedMap.get(existingKey)!;
        combinedMap.set(existingKey, { ...existing, ...w, avatar: w.avatar || existing.avatar });
      } else {
        combinedMap.set(w.id, w);
      }
    }
  });

  // Enrich any worker lacking avatar from global workers by name or ID
  combinedMap.forEach((w, key) => {
    if (!w.avatar) {
      const match = (appState.workers || []).find(gw => gw && gw.avatar && (
        gw.id === w.id || (gw.name && w.name && gw.name.toLowerCase().trim() === w.name.toLowerCase().trim())
      ));
      if (match?.avatar) {
        combinedMap.set(key, { ...w, avatar: match.avatar });
      }
    }
  });

  const rawWorkers: WorkerProfile[] = Array.from(combinedMap.values());

  const filteredWorkers = rawWorkers.filter(w => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      (w.position && w.position.toLowerCase().includes(q)) ||
      (w.workplace && w.workplace.toLowerCase().includes(q))
    );
  });

  const copyQrLink = () => {
    soundEngine.playClick();
    const link = `${window.location.origin}/business/${targetBusiness.id}`;
    navigator.clipboard.writeText(link);
    toast.success(`Copied Business QR Link: ${link}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3.5 sm:p-4 font-['Outfit',sans-serif] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-7 rounded-[2rem] max-w-lg sm:max-w-xl md:max-w-[620px] w-full shadow-2xl relative animate-in zoom-in-95 duration-250 max-h-[94vh] flex flex-col">
        
        {/* Top Close Button */}
        <button 
          onClick={() => {
            soundEngine.playClick();
            onClose();
          }} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-20 cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Header */}
        <div className="text-center mb-4 sm:mb-5 shrink-0">
          <div className="relative inline-block mb-2 sm:mb-2.5">
            <div className="w-13 h-13 sm:w-14 sm:h-14 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white rounded-2xl flex items-center justify-center mx-auto font-black text-2xl shadow-lg shadow-indigo-500/25 ring-3 ring-indigo-50 dark:ring-indigo-950/60 overflow-hidden">
              {targetBusiness.avatar ? (
                <img src={targetBusiness.avatar} alt={targetBusiness.name} className="w-full h-full object-cover" />
              ) : (
                <Building className="w-6 h-6 sm:w-7 sm:h-7" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-xs" title="Verified Business">
              <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {targetBusiness.name}
          </h3>

          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-[11px] sm:text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60 flex items-center">
              <Sparkles className="w-3 h-3 mr-1 text-indigo-500 shrink-0" />
              {targetBusiness.category || 'Retail & Service'}
            </span>

            {targetBusiness.rating && (
              <span className="text-[11px] sm:text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 flex items-center">
                <Star className="w-3 h-3 fill-current mr-1 text-amber-500" />
                {targetBusiness.rating.toFixed(1)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5">
            <MapPin className="w-3.5 h-3.5 mr-1 text-rose-500 shrink-0" />
            <span className="truncate max-w-xs">{targetBusiness.address}</span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-1 mb-3.5 sm:mb-4 shrink-0">
          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveTab('team');
            }}
            className={`flex-1 py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'team'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 mr-1.5 shrink-0" />
            <span>View Team</span>
            <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
              activeTab === 'team' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {rawWorkers.length}
            </span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveTab('qr');
            }}
            className={`flex-1 py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4 mr-1.5 shrink-0" />
            <span>Business QR Code</span>
          </button>
        </div>

        {/* TAB 1: STORE TEAM / FULL RESPONSIVE MOBILE + DESKTOP CARDS */}
        {activeTab === 'team' && (
          <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-200">
            {/* Search Filter for Team */}
            {rawWorkers.length > 3 && (
              <div className="relative mb-3 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team members..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Workers List - Full Names & Responsive Layout */}
            <div className="space-y-3 max-h-[360px] sm:max-h-[400px] overflow-y-auto pr-1 no-scrollbar">
              {rawWorkers.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center">
                  <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                    <Users className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                    No Team Members Yet
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs text-center mt-1.5 leading-relaxed font-medium">
                    No staff members are currently registered under <span className="font-bold text-slate-800 dark:text-slate-200">{targetBusiness.name}</span>.
                  </p>
                  {isOwner && (
                    <button
                      onClick={() => {
                        soundEngine.playClick();
                        onClose();
                        navigate('/business');
                      }}
                      className="mt-4 inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Building className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                      Manage Staff in Business Dashboard
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5 shrink-0" />
                    </button>
                  )}
                </div>
              ) : filteredWorkers.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No members match "{searchQuery}"</p>
                </div>
              ) : (
                filteredWorkers.map(worker => (
                  <div 
                    key={worker.id} 
                    className="bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => {
                      soundEngine.playMeritSuccess();
                      onSelectWorker(worker);
                      onClose();
                    }}
                  >
                    {/* Top Row on mobile / Left info on desktop */}
                    <div className="flex items-center space-x-3 sm:space-x-3.5 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white font-black flex items-center justify-center text-base sm:text-lg shadow-md group-hover:scale-105 group-hover:shadow-indigo-500/30 ring-2 ring-indigo-100 dark:ring-indigo-900/60 transition-transform overflow-hidden font-mono shrink-0">
                          {worker.avatar ? (
                            <img src={worker.avatar} alt={worker.name} className="w-full h-full object-cover" />
                          ) : (
                            worker.initials || (worker.name ? worker.name.substring(0, 2).toUpperCase() : 'FT')
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-xs" title="Verified Worker">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <h4 className="font-black text-slate-900 dark:text-slate-100 text-base sm:text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">
                            {worker.name}
                          </h4>
                          {isWorkerManagerAffiliated(worker, targetBusiness) ? (
                            <span className="inline-flex items-center text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-full" title="Manager-verified team member">
                              <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-full" title="Self-reported workplace staff">
                              <MapPin className="w-2.5 h-2.5 mr-0.5 text-slate-400" /> Staff
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 leading-tight truncate">
                          {worker.position}
                        </p>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-tight truncate">
                          {worker.workplace || targetBusiness.name}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Action Row on mobile / Right Buttons on desktop */}
                    <div className="flex items-center justify-between sm:justify-end space-x-2 pt-2 sm:pt-0 border-t border-slate-200/60 dark:border-slate-700/60 sm:border-0 shrink-0">
                      <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-black bg-amber-50 dark:bg-amber-950/80 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border-2 border-amber-200 dark:border-amber-700/80 flex items-center shadow-xs">
                        <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 text-amber-500 shrink-0" />
                        <span>Lvl {worker.level}</span>
                      </span>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEngine.playMeritSuccess();
                          onSelectWorker(worker);
                          onClose();
                        }}
                        className="flex-1 sm:flex-initial bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-indigo-600/30 group-hover:shadow-indigo-600/50 group-hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5 fill-current text-amber-300 mr-1 shrink-0" />
                        <span>Recognize</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: QR CODE */}
        {activeTab === 'qr' && (
          <div className="text-center space-y-4 flex-1 overflow-y-auto no-scrollbar animate-in fade-in duration-200 py-1">
            <div className="bg-slate-50 dark:bg-slate-800/90 p-4 rounded-2xl inline-block shadow-md border-2 border-indigo-100 dark:border-indigo-900/70 max-w-xs mx-auto">
              <img 
                src={targetBusiness.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${window.location.origin}/business/${targetBusiness.id}`} 
                alt={`${targetBusiness.name} QR Code`} 
                className="w-48 h-48 sm:w-52 sm:h-52 mx-auto rounded-xl bg-white p-2"
              />
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mx-auto font-medium leading-relaxed">
              Scan this QR code at <span className="text-indigo-600 dark:text-indigo-400 font-bold">{targetBusiness.name}</span> to view registered team members and give instant merit awards!
            </p>

            <div className="flex gap-2.5 pt-1 max-w-sm mx-auto">
              <button
                onClick={copyQrLink}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl flex items-center justify-center text-xs transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Copy Link</span>
              </button>

              <button
                onClick={() => {
                  soundEngine.playClick();
                  setShowPrintModal(true);
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl flex items-center justify-center text-xs shadow-md shadow-indigo-600/20 hover:opacity-95 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span>Print Poster</span>
              </button>
            </div>
          </div>
        )}

        {/* Printable Poster Modal */}
        <PrintableQRPosterModal
          business={targetBusiness}
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
        />
      </div>
    </div>
  );
}
