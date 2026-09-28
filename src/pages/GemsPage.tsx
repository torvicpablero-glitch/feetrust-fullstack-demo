import React from 'react';
import { useStore } from '../lib/store';
import { Diamond, TrendingUp, Star, Gift, Sparkles, Award, Flame, ShieldCheck, Zap, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { soundEngine } from '../lib/audio';

export default function GemsPage() {
  const { appState } = useStore();
  const { profile } = appState;

  const meritsForNextLevel = 5;
  const currentMeritProgress = (profile.meritsGiven || 0) % meritsForNextLevel;
  const progressPercent = Math.min(100, (currentMeritProgress / meritsForNextLevel) * 100);

  // Daily streak calculation simulation based on merits
  const streakDays = Math.max(1, (profile.meritsGiven || 0) > 0 ? ((profile.meritsGiven || 1) % 7) + 1 : 1);

  const achievements = [
    { title: 'Merit Pioneer', desc: 'Gave first verified merit', unlocked: (profile.meritsGiven || 0) >= 1, icon: '🌟' },
    { title: 'Merit Champion', desc: 'Awarded 3+ verified merits', unlocked: (profile.meritsGiven || 0) >= 3, icon: '💎' },
    { title: 'Community Pillar', desc: 'Reached Level 5 merit level', unlocked: (profile.level || 1) >= 5, icon: '🏆' },
    { title: 'Legendary Patron', desc: 'Accumulated 5,000+ total gems', unlocked: (profile.gems || 0) >= 5000, icon: '👑' },
  ];

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-['Outfit',sans-serif]">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">My Gems & Level</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Recognize excellence. Earn gems and redeem them for partner rewards</p>
        </div>
      </div>

      {/* Main Gems Card */}
      <div className="bg-gradient-to-br from-amber-50 via-white to-indigo-50 dark:from-slate-900/90 dark:via-[#0f111a] dark:to-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-md relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-200/40 dark:bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-blue-200/40 dark:bg-blue-500/10 rounded-full blur-2xl -ml-12 -mb-12 pointer-events-none" />
        
        <div className="flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3 relative z-10 space-x-2">
          <Diamond className="w-7 h-7 animate-pulse text-amber-500" />
          <span className="font-bold text-slate-700 dark:text-slate-300 tracking-wide uppercase text-sm font-mono">Total Balance</span>
        </div>

        <div className="text-6xl font-extrabold text-amber-600 dark:text-amber-400 relative z-10 tracking-tight my-2 font-mono">
          {profile.gems?.toLocaleString() || 0}
        </div>

        <div className="mt-5 relative z-10 flex items-center justify-center space-x-3">
          <Link 
            to="/coupons" 
            onClick={() => soundEngine.playClick()}
            className="inline-flex items-center bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-extrabold px-6 py-2.5 rounded-full text-sm hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer font-mono"
          >
            <Gift className="w-4 h-4 mr-2" />
            REDEEM REWARDS
          </Link>
        </div>
      </div>

      {/* Daily Streak Banner */}
      <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-rose-500/10 border border-orange-200 dark:border-orange-900/40 rounded-3xl p-5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-sm shrink-0 text-xl">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-black text-slate-900 dark:text-slate-100 text-base">{streakDays}-Day Merit Streak!</h4>
              <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                +{(streakDays * 5)}% BONUS
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Recognize daily to keep your gem multiplier.</p>
          </div>
        </div>
      </div>

      {/* Level & Merits Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center shadow-sm backdrop-blur-md">
          <TrendingUp className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-1 font-mono">{profile.level || 1}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">Current Level</div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center shadow-sm backdrop-blur-md">
          <Star className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto mb-2" />
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-1 font-mono">{profile.meritsGiven || 0}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">Recognition Given</div>
        </div>
      </div>

      {/* Level Progress Bar */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm backdrop-blur-md">
        <div className="flex justify-between items-end mb-3">
          <div>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-base">Progress to Level {(profile.level || 1) + 1}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Give {meritsForNextLevel - currentMeritProgress} more merit(s) to level up</p>
          </div>
          <div className="text-amber-600 dark:text-amber-400 font-extrabold text-sm font-mono">{currentMeritProgress} / {meritsForNextLevel}</div>
        </div>

        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-full transition-all duration-500 shadow-xs" 
            style={{ width: `${progressPercent}%` }} 
          />
        </div>
      </div>

      {/* Gamified Achievements Gallery */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm backdrop-blur-md">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center text-lg">
          <Trophy className="w-5 h-5 text-amber-500 mr-2" /> Merit Milestones
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {achievements.map((item) => (
            <div 
              key={item.title} 
              className={`p-3.5 rounded-2xl border transition-all ${
                item.unlocked 
                  ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50' 
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h5 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">{item.title}</h5>
                    {item.unlocked && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How to Earn Gems */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm backdrop-blur-md">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center text-lg">
          <Sparkles className="w-5 h-5 text-amber-500 mr-2" /> How to Earn Gems
        </h3>
        <div className="space-y-3">
          {[
            { label: 'Good Recognition', gems: '+50', color: 'bg-blue-500' },
            { label: 'Very Good Recognition', gems: '+50', color: 'bg-indigo-500' },
            { label: 'Excellent Recognition', gems: '+50', color: 'bg-purple-500' },
            { label: 'Super Star Recognition', gems: '+50', color: 'bg-pink-500' },
            { label: 'Legend Recognition', gems: '+50', color: 'bg-amber-500' },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <div className="flex items-center text-slate-700 dark:text-slate-200 font-medium text-sm">
                <span className={`w-3 h-3 rounded-full mr-3 ${item.color}`} />
                {item.label}
              </div>
              <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center text-sm font-mono">
                <Diamond className="w-3.5 h-3.5 mr-1 text-amber-500" /> {item.gems}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
