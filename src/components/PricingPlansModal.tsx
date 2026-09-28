import React from 'react';
import { X, Sparkles, CreditCard, ShieldCheck, ArrowRight } from 'lucide-react';
import PricingPlansSelector, { PRICING_PLANS, PricingPlan } from './PricingPlansSelector';
import { redirectToStripeCheckout } from '../lib/stripe';
import { useStore, BusinessProfile } from '../lib/store';

interface PricingPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlanId?: string;
  business?: BusinessProfile;
  onPlanSelected?: (plan: PricingPlan) => void;
}

export default function PricingPlansModal({
  isOpen,
  onClose,
  selectedPlanId = 'growth',
  business,
  onPlanSelected,
}: PricingPlansModalProps) {
  const { user, appState } = useStore();
  const [currentPlan, setCurrentPlan] = React.useState(selectedPlanId);

  React.useEffect(() => {
    if (selectedPlanId) {
      setCurrentPlan(selectedPlanId);
    }
  }, [selectedPlanId]);

  const activeBiz = business || (appState.businesses || []).find(
    b => b.user_id === user?.uid || (b as any).userId === user?.uid
  ) || appState.businesses?.[0];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-['Outfit',sans-serif]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">FeeTrust Business Plans</h3>
              <p className="text-xs text-slate-500">Annual investment by employee count</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <PricingPlansSelector
            selectedPlanId={currentPlan}
            onSelectPlan={(plan) => {
              setCurrentPlan(plan.id);
            }}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Encrypted Stripe Checkout • Annual billing</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const origin = window.location.origin;
                redirectToStripeCheckout({
                  planId: currentPlan,
                  businessId: activeBiz?.id,
                  businessName: activeBiz?.name,
                  customerEmail: user?.email,
                  successUrl: `${origin}/business?payment=success&plan=${currentPlan}`,
                  cancelUrl: `${origin}/business?payment=cancelled`,
                });
              }}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-xs sm:text-sm flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <CreditCard className="w-4 h-4" />
              <span>Checkout with Stripe</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
