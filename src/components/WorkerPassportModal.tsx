import React, { useState } from 'react';
import { WorkerProfile, useStore } from '../lib/store';
import { Award, Star, Building, ShieldCheck, X, ThumbsUp, Heart, CheckCircle, QrCode, Sparkles, Flame } from 'lucide-react';
import WorkerQRModal from './WorkerQRModal';
import { soundEngine } from '../lib/audio';
import RadialMeritHalo from './RadialMeritHalo';

interface Props {
  worker: WorkerProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onGiveMerit: () => void;
}

export default function WorkerPassportModal({ worker, isOpen, onClose, onGiveMerit }: Props) {
  const { appState } = useStore();
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  if (!isOpen || !worker) return null;

  const workerReviews = (appState.reviews || []).filter(r => r.toUserId === worker.id);
  const tierName = worker.level >= 10 ? 'Mythic Star' : worker.level >= 7 ? 'Diamond Level' : worker.level >= 4 ? 'Gold Master' : 'Verified Pro';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 font-['Outfit',sans-serif]">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl relative animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
        <button 
          onClick={() => {
            soundEngine.playClick();
            onClose();
          }} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-2 cursor-pointer z-30"
          aria-label="Close passport"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 3D Radial Orbiting Glass Bubble Halo */}
        <div className="flex flex-col items-center justify-center mb-2">
          <RadialMeritHalo
            avatar={worker.avatar}
            initials={worker.initials}
            name={worker.name}
            selectedTier={selectedTier}
            onSelectTier={(tier) => {
              setSelectedTier(tier);
              onGiveMerit();
              onClose();
            }}
          />

          <div className="text-center mt-1">
            <div className="flex items-center justify-center space-x-1.5 mb-1">
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{worker.name}</h3>
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Verified Merit Passport</p>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{worker.position}</p>
            {worker.workplace && (
              <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                  <Building className="w-3.5 h-3.5 mr-1" /> {worker.workplace}
                </p>
                {worker.registeredViaInvite || worker.isVerifiedStaff ? (
                  <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-full flex items-center">
                    <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Verified Staff
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>


        {/* Merit Vault Badges */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3 text-center">
            <Award className="w-6 h-6 text-amber-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">Lvl {worker.level}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Level</div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3 text-center">
            <Star className="w-6 h-6 text-rose-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">{worker.level * 6 + 10}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Merits</div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3 text-center">
            <Flame className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">99.8%</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Positive</div>
          </div>
        </div>

        {/* Merit Reviews History */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono">Verified Merit Endorsements</h4>
          <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar pr-1">
            {workerReviews.length > 0 ? (
              workerReviews.map(r => (
                <div key={r.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">{r.fromUserName}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">+{r.meritType}</span>
                  </div>
                  {r.reviewText && <p className="text-slate-600 dark:text-slate-300 italic">"{r.reviewText}"</p>}
                </div>
              ))
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                Verified high-level service specialist. Be the first to give an endorsement!
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              soundEngine.playClick();
              setShowQrModal(true);
            }}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-2xl flex items-center justify-center text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer font-mono"
          >
            <QrCode className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400" /> PASSPORT QR
          </button>

          {worker.role !== 'Business' && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onGiveMerit();
                onClose();
              }}
              className="flex-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-2xl flex items-center justify-center text-sm shadow-md hover:opacity-95 transition-opacity cursor-pointer font-mono hover:scale-[1.02] active:scale-[0.98]"
            >
              <Star className="w-4 h-4 mr-1.5 text-amber-300 fill-amber-300" /> GIVE MERIT
            </button>
          )}
        </div>
      </div>

      <WorkerQRModal
        worker={worker}
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
      />
    </div>
  );
}

