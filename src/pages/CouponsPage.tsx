import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { 
  Diamond, Tag, Gift, Star, CheckCircle, Copy, X, 
  Coffee, Utensils, Scissors, ShoppingBag, Sparkles, QrCode, Clock, ShieldCheck
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { soundEngine } from '../lib/audio';
import { triggerCelebration } from '../components/CelebrationFX';

const STORAGE_KEY_CLAIMED = 'feetrust_claimed_coupons';

interface PartnerPerk {
  id: string;
  title: string;
  category: string;
  partnerName: string;
  discountValue: string;
  description: string;
  gemCost: number;
  icon: any;
  color: string;
  badge: string;
}

const PARTNER_PERKS: PartnerPerk[] = [
  {
    id: 'perk_coffee_5',
    title: '$5 Artisan Coffee & Pastry Credit',
    category: 'Cafes & Roasters',
    partnerName: 'Local Craft Cafes',
    discountValue: '$5.00 USD',
    description: 'Enjoy $5 towards any specialty espresso, pour-over, or fresh pastry at partner craft cafes.',
    gemCost: 500,
    icon: Coffee,
    color: 'from-amber-500 to-orange-500',
    badge: 'Coming Soon',
  },
  {
    id: 'perk_wellness_20',
    title: '20% Off Salon, Spa & Hair Styling',
    category: 'Beauty & Personal Care',
    partnerName: 'Salon & Spa Network',
    discountValue: '20% OFF',
    description: 'Get 20% off any hair styling, deep conditioning, facial, or massage appointment.',
    gemCost: 750,
    icon: Scissors,
    color: 'from-pink-500 to-rose-500',
    badge: 'Coming Soon',
  },
  {
    id: 'perk_dining_10',
    title: '$10 Neighborhood Bistro & Dining Perk',
    category: 'Restaurants & Dining',
    partnerName: 'Local Bistro Partners',
    discountValue: '$10.00 USD',
    description: 'Valid towards lunch or dinner orders over $25 at participating neighborhood bistro establishments.',
    gemCost: 1000,
    icon: Utensils,
    color: 'from-emerald-500 to-teal-600',
    badge: 'Coming Soon',
  },
  {
    id: 'perk_retail_15',
    title: '$15 Metro Retail & Market Voucher',
    category: 'Retail & Grocery',
    partnerName: 'Metro Hubs & Local Markets',
    discountValue: '$15.00 USD',
    description: 'Save $15 on your grocery basket or retail purchase when checking out with verified partner voucher.',
    gemCost: 1500,
    icon: ShoppingBag,
    color: 'from-blue-600 to-indigo-600',
    badge: 'Coming Soon',
  },
];

export default function CouponsPage() {
  const { appState, updateState, user } = useStore();
  const [activeTab, setActiveTab] = useState<'rewards' | 'bonuses'>('rewards');

  // Claimed free bonus IDs
  const [claimedBonuses, setClaimedBonuses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLAIMED);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [activeModal, setActiveModal] = useState<{
    title: string;
    code: string;
    discountValue?: string;
    partnerName?: string;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLAIMED, JSON.stringify(claimedBonuses));
    } catch (e) {}
  }, [claimedBonuses]);

  const userGems = appState.profile?.gems || 0;

  // Claim Free Community Bonus Gems (Beta / Founding user gifts)
  const handleClaimFreeBonus = (bonusId: string, gemReward: number, code: string, title: string) => {
    if (claimedBonuses.includes(bonusId)) {
      toast.error('You have already claimed this free bonus!');
      return;
    }

    const newGems = userGems + gemReward;
    updateState({
      profile: {
        ...appState.profile,
        gems: newGems,
      },
    });

    setClaimedBonuses(prev => [...prev, bonusId]);
    soundEngine.playLevelUp();
    triggerCelebration({ count: 90 });

    fetch('/api/coupons/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user?.uid || appState.profile?.email || 'usr_guest',
        couponId: bonusId,
        code,
        gemsAwarded: gemReward,
      }),
    }).catch(err => console.warn('API coupon claim error:', err));

    setActiveModal({
      title,
      code,
      discountValue: `+${gemReward.toLocaleString()} Free Gems Added`,
      partnerName: 'FeeTrust Founding Gift',
    });

    toast.success(`Claimed +${gemReward.toLocaleString()} Gems!`, {
      style: { background: '#0f172a', color: '#fff', border: '1px solid #334155' },
    });
  };

  const handleNotifyPerk = (perk: PartnerPerk) => {
    soundEngine.playClick();
    toast(`Partner rewards are coming soon! Keep earning gems so you're ready when merchant redemption launches.`, {
      icon: '💎',
      style: { background: '#0f172a', color: '#fff', border: '1px solid #334155' },
      duration: 4000,
    });
  };

  const copyCodeToClipboard = (code: string) => {
    soundEngine.playClick();
    navigator.clipboard.writeText(code);
    toast.success(`Copied code: ${code}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-['Outfit',sans-serif]">
      <Toaster position="top-center" />

      {/* Redemption Success Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 rounded-3xl max-w-sm w-full shadow-2xl text-center relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 bg-linear-to-tr from-amber-400 to-amber-600 text-slate-950 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
              <Gift className="w-8 h-8 text-white" />
            </div>

            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              {activeModal.partnerName || 'FeeTrust Partner Perk'}
            </span>

            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-2 mb-1">
              {activeModal.title}
            </h3>

            {activeModal.discountValue && (
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mb-3">
                {activeModal.discountValue}
              </p>
            )}

            {/* Voucher Card Container */}
            <div className="bg-slate-50 dark:bg-slate-800/80 border-2 border-dashed border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-black text-slate-900 dark:text-slate-100 tracking-wider">
                  {activeModal.code}
                </span>
                <button
                  onClick={() => copyCodeToClipboard(activeModal.code)}
                  className="p-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-bold transition-colors cursor-pointer"
                  aria-label="Copy code"
                  title="Copy code"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">Founding member appreciation voucher</p>
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md hover:opacity-95 transition-opacity cursor-pointer text-xs"
            >
              Done & Keep Earning Gems
            </button>
          </div>
        </div>
      )}

      {/* Header & Balance Bar */}
      <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Community Bonuses & Perks
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
              Claim launch bonuses and preview upcoming local merchant perks
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-4 py-2 rounded-2xl self-start sm:self-auto shadow-2xs">
            <Diamond className="w-5 h-5 text-amber-500" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Gems</div>
              <div className="text-lg font-black text-amber-900 dark:text-amber-300 font-mono leading-none">
                {userGems.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800/70 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('rewards')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'rewards'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Partner Perks (Preview)</span>
          </button>

          <button
            onClick={() => setActiveTab('bonuses')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'bonuses'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Free Launch Bonuses</span>
          </button>
        </div>
      </div>

      {/* TAB 1: UPCOMING PARTNER PERKS PREVIEW */}
      {activeTab === 'rewards' && (
        <div className="space-y-4">
          {/* Onboarding Notice Banner */}
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5">
                Partner Rewards Network — In Development
              </span>
              We are actively onboarding local cafes, salons, restaurants, and retail venues across Chicago. Earn and save your gems through verified service recognition so you are ready to redeem as soon as merchant integrations go live!
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PARTNER_PERKS.map((perk) => {
              const IconComponent = perk.icon;

              return (
                <div
                  key={perk.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className={`w-12 h-12 rounded-2xl bg-linear-to-tr ${perk.color} text-white flex items-center justify-center shadow-md`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full uppercase">
                        {perk.badge}
                      </span>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{perk.category}</div>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {perk.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {perk.description}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Estimated Value:</span>
                      <span className="font-mono font-black text-amber-600 dark:text-amber-400 flex items-center">
                        <Diamond className="w-3.5 h-3.5 mr-1" />
                        ~{perk.gemCost.toLocaleString()} Gems
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleNotifyPerk(perk)}
                      className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition-all bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                      Coming Soon • Save Gems
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Business Invitation Box */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">Are you a local business owner?</span>
              <p className="text-slate-500 dark:text-slate-400">Join our founding merchant network to accept FeeTrust perks and welcome verified customers.</p>
            </div>
            <a
              href="mailto:contact@feetrust.com?subject=Merchant%20Rewards%20Partnership"
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shrink-0 transition-colors cursor-pointer text-[11px]"
            >
              Partner With Us
            </a>
          </div>
        </div>
      )}

      {/* TAB 2: FREE FOUNDER BONUSES */}
      {activeTab === 'bonuses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Special Promotional Bonuses</span>
            <span className="text-emerald-600 font-bold">100% Free Claims</span>
          </div>

          <div className="space-y-4">
            {/* Beta Welcome Gift */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden group shadow-sm backdrop-blur-md">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mr-4 shrink-0 border border-amber-200 dark:border-amber-800/60">
                    <Gift className="w-7 h-7 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Beta Welcome Gift</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Exclusive appreciation bonus for early beta testers</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-bold mt-1 font-mono">+ 10,000 Free Gems</p>
                  </div>
                </div>
                <div className="border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-xs font-bold flex items-center font-mono">
                  <Diamond className="w-3 h-3 mr-1 text-amber-500" /> FREE
                </div>
              </div>
              <button
                onClick={() => handleClaimFreeBonus('beta_gift', 10000, 'FEETRUST-BETA10K', 'Beta Welcome Gift')}
                disabled={claimedBonuses.includes('beta_gift')}
                className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center transition-all relative z-10 cursor-pointer ${
                  claimedBonuses.includes('beta_gift')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                    : 'bg-linear-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white shadow-md hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                {claimedBonuses.includes('beta_gift') ? (
                  <><CheckCircle className="w-4 h-4 mr-2 text-emerald-500" /> Already Claimed</>
                ) : (
                  <><Gift className="w-4 h-4 mr-2" /> Claim 10,000 Gems</>
                )}
              </button>
            </div>

            {/* First 5,000 Users Bonus */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden group shadow-sm backdrop-blur-md">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mr-4 shrink-0 border border-amber-200 dark:border-amber-800/60">
                    <Star className="w-7 h-7 text-amber-500 fill-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">First 5,000 Users Bonus</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Founding member appreciation gift</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-bold mt-1 font-mono">+ 5,000 Free Gems</p>
                  </div>
                </div>
                <div className="border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-xs font-bold flex items-center font-mono">
                  <Diamond className="w-3 h-3 mr-1 text-amber-500" /> FREE
                </div>
              </div>
              <button
                onClick={() => handleClaimFreeBonus('first_5000', 5000, 'FEETRUST-FOUNDER5K', 'First 5,000 Users Bonus')}
                disabled={claimedBonuses.includes('first_5000')}
                className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center transition-all relative z-10 cursor-pointer ${
                  claimedBonuses.includes('first_5000')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                    : 'bg-linear-to-r from-amber-400 to-yellow-500 hover:opacity-95 text-slate-950 shadow-md hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                {claimedBonuses.includes('first_5000') ? (
                  <><CheckCircle className="w-4 h-4 mr-2 text-emerald-500" /> Already Claimed</>
                ) : (
                  <><Gift className="w-4 h-4 mr-2" /> Claim 5,000 Gems</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security & Partner Verification Guarantee */}
      <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span>
          FeeTrust Partner Perks are being developed in collaboration with participating local businesses across the Chicago metropolitan area.
        </span>
      </div>
    </div>
  );
}
