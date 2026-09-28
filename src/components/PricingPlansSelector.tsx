import React from 'react';
import { Check, Mail, Sparkles, Shield, Users, Building, ArrowRight } from 'lucide-react';

export interface PricingPlan {
  id: string;
  name: string;
  employeeRange: string;
  employeeLimit: number;
  price: number;
  priceFormatted: string;
  period: string;
  popular?: boolean;
  features: string[];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    employeeRange: '1 to 4 employees',
    employeeLimit: 4,
    price: 5,
    priceFormatted: '$5 USD',
    period: '/ year',
    features: [
      'Verified store map pin & listing',
      'Countertop QR code posters',
      'Up to 4 employee merit profiles',
      'Real-time merit recognition feed',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    employeeRange: '5 to 8 employees',
    employeeLimit: 8,
    price: 349,
    priceFormatted: '$349 USD',
    period: '/ year',
    popular: true,
    features: [
      'Everything in Starter Plan',
      'Up to 8 employee merit profiles',
      'Customer satisfaction metrics',
      'Direct staff SMS & WhatsApp invites',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    employeeRange: '9 to 15 employees',
    employeeLimit: 15,
    price: 499,
    priceFormatted: '$499 USD',
    period: '/ year',
    features: [
      'Everything in Growth Plan',
      'Up to 15 employee merit profiles',
      'Team leaderboard & CSV analytics export',
      'Priority business badge on map',
    ],
  },
];

interface PricingPlansSelectorProps {
  selectedPlanId: string;
  onSelectPlan: (plan: PricingPlan) => void;
  compact?: boolean;
}

export default function PricingPlansSelector({
  selectedPlanId,
  onSelectPlan,
  compact = false,
}: PricingPlansSelectorProps) {
  return (
    <div className="space-y-4 font-['Outfit',sans-serif] text-slate-900 dark:text-slate-100">
      {/* Header Banner matching Image */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="text-[12px] font-mono font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 flex items-center">
          04 / PRICING
        </div>
        <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Plans for dynamic teams
        </h3>
        <div className="w-12 h-1.5 bg-blue-600 rounded-full mt-2.5 mb-3" />
        <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
          Public pricing for teams of up to 15 employees.
        </p>
      </div>

      {/* Pricing Table / Card Grid matching the Image */}
      <div className="space-y-3">
        {/* Table Column Headers */}
        <div className="hidden sm:grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-blue-600 text-white font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl shadow-sm flex items-center justify-center">
            PLAN
          </div>
          <div className="bg-blue-600 text-white font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl shadow-sm flex items-center justify-center">
            EMPLOYEE RANGE
          </div>
          <div className="bg-blue-600 text-white font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl shadow-sm flex items-center justify-center">
            ANNUAL INVESTMENT
          </div>
        </div>

        {/* Pricing Rows / Interactive Plan Cards */}
        {PRICING_PLANS.map((plan) => {
          const isSelected = selectedPlanId === plan.id || (selectedPlanId === 'initial' && plan.id === 'starter');
          return (
            <div
              key={plan.id}
              onClick={() => onSelectPlan(plan)}
              className={`rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 shadow-md ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              {plan.popular && (
                <span className="absolute top-2 right-3 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs">
                  Most Popular
                </span>
              )}

              {/* Desktop 3-Column Row View */}
              <div className="hidden sm:grid grid-cols-3 gap-2.5 p-3 items-center text-center">
                <div className="bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 rounded-xl p-3.5 flex items-center justify-center space-x-2">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="font-extrabold text-base text-blue-600 dark:text-blue-400">
                    {plan.name}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 rounded-xl p-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {plan.employeeRange}
                </div>

                <div className="bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 rounded-xl p-3.5 text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {plan.priceFormatted} {plan.period}
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="font-black text-base text-blue-600 dark:text-blue-400">
                        {plan.name}
                      </div>
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {plan.employeeRange}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-slate-900 dark:text-slate-100 font-mono">
                      {plan.priceFormatted}
                    </div>
                    <div className="text-[11px] text-slate-500 font-semibold">
                      {plan.period}
                    </div>
                  </div>
                </div>
              </div>

              {/* Plan Feature Bullets */}
              {!compact && (
                <div className="px-5 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                      <span className="text-emerald-500 font-bold mr-1.5">✓</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Enterprise / 15+ Employees Box */}
        <div className="p-4 sm:p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/60 via-indigo-50/30 to-purple-50/40 dark:from-blue-950/30 dark:to-purple-950/20">
          <div className="text-[11px] font-mono font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
            15+ EMPLOYEES / LOCATION
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                Contact us for pricing
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Public pricing for teams of up to 15 employees. Contact us for larger teams.
              </p>
            </div>
            <a
              href="mailto:jm@feetrust.com?subject=FeeTrust%20Enterprise%20Plan%20Inquiry"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-all text-xs font-bold font-mono shadow-xs shrink-0 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 mr-1.5" />
              jm@feetrust.com
            </a>
          </div>
        </div>
      </div>

      {/* Footer Branding Tag */}
      <div className="pt-1 flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
        <span>FEETRUST™ • CHICAGO • PRE-SEED</span>
        <span>www.feetrust.com</span>
      </div>
    </div>
  );
}
