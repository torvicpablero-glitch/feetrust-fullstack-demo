import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, ShieldCheck, QrCode, Sparkles, ArrowRight, CheckCircle2,
  Users, Building, Coffee, Star, MapPin, ChevronRight, Zap,
  TrendingUp, Gift, Lock, Smartphone, Quote, BadgeCheck, Check, X
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface PricingTier {
  name: string;
  priceAnnual: string;
  priceMonthly: string;
  description: string;
  capacity: string;
  popular?: boolean;
  features: string[];
  cta: string;
  planKey: string;
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter Workplace',
    priceAnnual: '$219',
    priceMonthly: '$24',
    description: 'Independent coffee shops, boutique salons and neighborhood craft businesses.',
    capacity: 'Up to 4 Staff Specialists',
    features: [
      'Official FeeTrust Counter QR Code & Poster Kit',
      '4 Verified Staff Digital Merit Passports',
      'Real-Time Customer Recognitions & Tips Ledger',
      'Public Establishment Map Pin & Directory Listing',
      'Customer Gem Rewards Loyalty Integration',
    ],
    cta: 'Get Started with Starter',
    planKey: 'Starter',
  },
  {
    name: 'Growth Establishment',
    priceAnnual: '$499',
    priceMonthly: '$49',
    description: 'High-traffic restaurants, busy salons and expanding hospitality venues.',
    capacity: 'Up to 12 Staff Specialists',
    popular: true,
    features: [
      'Everything in Starter Plan',
      'Up to 12 Verified Staff Members on Roster',
      'Advanced Performance Analytics & Trend Reports',
      'Custom Branded Counter QR Poster Generator',
      'Priority Support & Staff Invitation Email Dispatch',
      'Featured Placement on Public City Map',
    ],
    cta: 'Launch Growth Workplace',
    planKey: 'Growth',
  },
  {
    name: 'Enterprise Network',
    priceAnnual: '$999',
    priceMonthly: '$99',
    description: 'Multi-location retail chains, hotel groups and enterprise service organizations.',
    capacity: 'Unlimited Staff Members',
    features: [
      'Unlimited Staff Specialists across all locations',
      'Multi-Location Dashboard & Centralized Management',
      'Custom Domain & Private API Integrations',
      'Dedicated Account Manager & Training Kit',
      'Custom Enterprise Analytics Export (CSV/JSON)',
    ],
    cta: 'Contact Enterprise Sales',
    planKey: 'Enterprise',
  },
];

const FEATURED_ESTABLISHMENTS = [
  {
    name: 'Target Metro Hub',
    category: 'Retail & Grocery',
    address: '1 S State St, Chicago, IL',
    rating: 4.8,
    merits: 142,
    staffCount: 4,
    image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Glamour Salon & Spa',
    category: 'Personal Care & Beauty',
    address: '540 N Michigan Ave, Chicago, IL',
    rating: 5.0,
    merits: 98,
    staffCount: 3,
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Marriott Downtown Service Hub',
    category: 'Hospitality & Dining',
    address: '540 N Michigan Ave, Chicago, IL',
    rating: 4.9,
    merits: 215,
    staffCount: 6,
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80',
  },
];

const PILLARS = [
  {
    id: 'customers',
    step: 'Step 1 • For Customers',
    title: 'Scan & Acknowledge',
    body:
      'Scan the counter QR code at your favorite coffee shop or salon. Rate your server, stylist, or specialist with verified merits (Good, Excellent, Legend) and earn instant redeemable gems.',
    points: ['1-click counter QR recognition', 'Earn gems on every verified merit', 'Direct employee recognition'],
    icon: QrCode,
    tile: 'from-amber-400 to-orange-500',
    label: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'specialists',
    step: 'Step 2 • For Specialists',
    title: 'Own Your Merit Passport',
    body:
      'Your hard-earned customer commendations stay with you forever. Build a verified digital track record, level up your badge, and take your professional reputation wherever your career leads.',
    points: ['Portable reputation across jobs', 'Level 1–10 Merit Progression', 'Customer commendations & thank-yous'],
    icon: Award,
    tile: 'from-blue-600 to-indigo-600',
    label: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'workplaces',
    step: 'Step 3 • For Workplaces',
    title: 'Attract & Retain Talent',
    body:
      'Businesses display counter QR codes to boost employee morale and showcase customer loyalty. Access real-time staff recognition analytics and gain an official verified city map presence.',
    points: ['Official establishment counter poster', 'Real-time staff performance dashboard', 'Boost customer repeat visits'],
    icon: Building,
    tile: 'from-emerald-500 to-teal-600',
    label: 'text-emerald-600 dark:text-emerald-400',
  },
];

const PASSPORT_FEATURES = [
  { icon: TrendingUp, title: 'Level 1 → 10', desc: 'Progress from Verified Pro to Mythic Star' },
  { icon: ShieldCheck, title: 'Employer-Verified', desc: 'Only manager-invited staff carry the badge' },
  { icon: Quote, title: 'Thank-You Notes', desc: 'Workers reply to the customers who recognised them' },
  { icon: Lock, title: 'You Own It', desc: 'Your record, your account — revocable by you' },
];

/* ------------------------------------------------------------------ */
/*  Passport credential card (matches app design language)             */
/* ------------------------------------------------------------------ */

function PassportCard() {
  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-900/5 dark:shadow-black/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Award className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Merit Passport
            </span>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <ShieldCheck className="w-3 h-3 mr-1" /> Verified
          </span>
        </div>

        <div className="mt-5 flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-lg shadow-md">
            AR
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate">Alex Rivera</p>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate">Head Barista</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center mt-0.5 truncate">
              <MapPin className="w-3 h-3 mr-1 shrink-0 text-rose-500" /> Glamour Salon &amp; Spa
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=https://www.feetrust.com/worker/alex"
            alt="Merit passport QR code"
            className="w-16 h-16 rounded-lg bg-white p-1 shrink-0"
            loading="lazy"
          />
          <div className="grid grid-cols-3 gap-2 flex-1 text-center">
            <div>
              <p className="font-mono text-lg font-black text-amber-600 dark:text-amber-400">9</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Level</p>
            </div>
            <div>
              <p className="font-mono text-lg font-black text-slate-900 dark:text-slate-100">218</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Merits</p>
            </div>
            <div>
              <p className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">4.9</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Rating</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {['👑 Legend ×12', '💎 Excellent ×47', '🌟 Very Good ×89'].map((s) => (
            <span
              key={s}
              className="rounded-full border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const primaryCta =
    'w-full sm:w-auto px-8 py-4 bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-500/25 hover:opacity-95 transition-all text-sm flex items-center justify-center space-x-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]';
  const secondaryCta =
    'w-full sm:w-auto px-7 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition-colors text-sm flex items-center justify-center space-x-2 cursor-pointer';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-['Outfit',sans-serif] selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background Ambient Gradient Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/15 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-500/15 dark:bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-500/15 dark:bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. PUBLIC TOP NAVIGATION */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div
            onClick={() => navigate('/')}
            className="flex items-center space-x-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div className="flex items-center">
              <span className="text-xl font-black tracking-tight bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                FeeTrust
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 ml-2 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                Merit Passport
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-6 text-xs font-bold text-slate-600 dark:text-slate-300">
            {[
              { id: 'how-it-works', label: 'How It Works' },
              { id: 'specialists', label: 'For Specialists' },
              { id: 'workplaces', label: 'For Workplaces' },
              { id: 'directory', label: 'Directory' },
              { id: 'pricing', label: 'Pricing' },
            ].map((n) => (
              <button
                key={n.id}
                onClick={() => scrollToSection(n.id)}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/auth')}
              className="text-xs font-bold text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="text-xs font-bold bg-linear-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl shadow-sm hover:opacity-95 transition-opacity cursor-pointer flex items-center space-x-1"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          <div className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-4 py-1.5 rounded-full text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              <span>The New Standard in Service Worker Merit &amp; Reputation</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-[1.08]">
                The Portable Merit Passport for{' '}
                <span className="bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Service Specialists
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Eliminate anonymous reviews. FeeTrust lets verified customers recognize baristas, stylists,
                and hospitality specialists via counter QR codes—giving workers a permanent digital
                reputation they truly own.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <button onClick={() => navigate('/auth')} className={primaryCta}>
                <ShieldCheck className="w-5 h-5" />
                <span>Claim Your Merit Passport</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
              <button onClick={() => scrollToSection('directory')} className={secondaryCta}>
                <MapPin className="w-4 h-4 text-rose-500" />
                <span>Explore City Directory</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center"><ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> 100% In-Person Verified Scans</span>
              <span className="flex items-center"><X className="w-3.5 h-3.5 mr-1.5 text-rose-500" /> Zero Anonymous Smear Reviews</span>
              <span className="flex items-center"><Gift className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Earn Customer Gem Rewards</span>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <PassportCard />
          </div>
        </div>
      </section>

      {/* 3. OLD WAY vs FEETRUST WAY */}
      <section className="pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-7 space-y-4">
            <div className="flex items-center text-rose-600 dark:text-rose-400">
              <X className="w-5 h-5 mr-2" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider">The Old Way</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Anonymous reviews are a lottery
            </h3>
            <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
              {[
                'Anyone can post anything — no visit required',
                'One bad-faith review outweighs a year of good shifts',
                'Reputation is trapped inside one employer',
                'Great service earns nothing but a nod',
              ].map((t) => (
                <li key={t} className="flex items-start">
                  <X className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0 text-rose-500" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-3xl p-7 space-y-4">
            <div className="flex items-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider">The FeeTrust Way</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Verified, in-person, portable
            </h3>
            <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
              {[
                'Recognition only from a scanned counter QR — you had to be there',
                'Merits stack into a level, not a takedown',
                'Your passport follows you to any employer, for life',
                'Every merit earns customers real, spendable gems',
              ].map((t) => (
                <li key={t} className="flex items-start">
                  <Check className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0 text-emerald-500" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS — THREE PILLARS */}
      <section
        id="how-it-works"
        className="py-20 bg-slate-100/70 dark:bg-slate-900/70 border-y border-slate-200 dark:border-slate-800"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Complete Transparency
            </h2>
            <p className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              How the FeeTrust Network Operates
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A 3-way ecosystem that rewards stellar service, empowers workers, and boosts business retention.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PILLARS.map((p) => (
              <div
                key={p.id}
                id={p.id}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-7 space-y-4 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <div className={`w-14 h-14 rounded-2xl bg-linear-to-tr ${p.tile} text-white flex items-center justify-center shadow-md`}>
                  <p.icon className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <div className={`text-[11px] font-mono font-bold ${p.label} uppercase`}>{p.step}</div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{p.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{p.body}</p>
                </div>
                <ul className="text-xs space-y-1.5 text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-center">✓ {pt}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. MERIT PASSPORT SHOWCASE */}
      <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                The Merit Passport
              </h2>
              <p className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                A résumé that writes itself
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Every verified scan adds a stamp. Levels rise. Customer thank-you notes stack up. By the time
                you walk into your next interview, your track record is already there — and it was written by
                the people you actually served.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PASSPORT_FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2"
                >
                  <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <BadgeCheck className="w-4 h-4 mr-1.5" />
              Build my passport
              <ChevronRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>

          <div className="flex justify-center lg:justify-end">
            <PassportCard />
          </div>
        </div>
      </section>

      {/* 6. PUBLIC WORKPLACE SPOTLIGHT DIRECTORY */}
      <section
        id="directory"
        className="py-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-10 border-t border-slate-200 dark:border-slate-800"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Verified Establishments
            </h2>
            <p className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100 mt-1">
              Top Rated Chicago Workplaces
            </p>
          </div>
          <button
            onClick={() => navigate('/explore')}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center self-start sm:self-auto cursor-pointer"
          >
            <span>View Full Interactive Map</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURED_ESTABLISHMENTS.map((biz) => (
            <div
              key={biz.name}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                <div className="h-44 w-full relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={biz.image}
                    alt={biz.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-amber-400 px-2.5 py-1 rounded-full text-xs font-mono font-black flex items-center shadow-xs">
                    <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                    {biz.rating}
                  </div>
                  <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-900 dark:text-slate-100 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {biz.category}
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">{biz.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                    {biz.address}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800/60 mt-3 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 font-mono text-slate-500 dark:text-slate-400">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>{biz.staffCount} Staff Members</span>
                </div>
                <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {biz.merits} Merits
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. PRICING SECTION */}
      <section
        id="pricing"
        className="py-20 bg-slate-100/70 dark:bg-slate-900/70 border-t border-slate-200 dark:border-slate-800 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Workplace Plans
            </h2>
            <p className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Simple, Transparent Pricing
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Claim your counter QR poster, invite your staff, and turn customer commendations into workplace
              retention.
            </p>

            {/* Annual vs Monthly Toggle */}
            <div className="flex items-center justify-center space-x-3 pt-2">
              <span className={`text-xs font-bold ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle((prev) => (prev === 'annual' ? 'monthly' : 'annual'))}
                className="w-12 h-6 bg-slate-300 dark:bg-slate-700 rounded-full p-0.5 transition-colors relative cursor-pointer"
                aria-label="Toggle annual or monthly billing"
              >
                <span
                  className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
                    }`}
                />
              </button>
              <span className={`text-xs font-bold ${billingCycle === 'annual' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}>
                Annual
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                Save 25%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PRICING_TIERS.map((tier) => {
              const price = billingCycle === 'annual' ? tier.priceAnnual : tier.priceMonthly;
              const period = billingCycle === 'annual' ? '/ year' : '/ month';
              return (
                <div
                  key={tier.name}
                  className={`relative bg-white dark:bg-slate-900 border rounded-3xl p-7 flex flex-col h-full shadow-sm transition-all ${tier.popular
                    ? 'border-indigo-300 dark:border-indigo-700 shadow-xl shadow-indigo-500/10'
                    : 'border-slate-200 dark:border-slate-800'
                    }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-linear-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-mono font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                      Most Popular Choice
                    </div>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{tier.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed min-h-[3rem]">
                      {tier.description}
                    </p>
                  </div>

                  <div className="mt-5 flex items-end space-x-1">
                    <span className="text-4xl sm:text-5xl font-black font-mono text-slate-900 dark:text-slate-100">
                      {price}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 pb-1.5">
                      {period}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    {tier.capacity}
                  </p>

                  <ul className="mt-6 space-y-2.5 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start text-xs text-slate-600 dark:text-slate-300">
                        <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => navigate('/auth')}
                    className={`mt-7 w-full py-3.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${tier.popular
                      ? 'bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:opacity-95'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                  >
                    {tier.cta}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Plans are billed per workplace. Larger teams and multi-location groups —{' '}
            <a
              href="mailto:jm@feetrust.com"
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              talk to us
            </a>
            .
          </p>
        </div>
      </section>

      {/* 8. FINAL CTA */}
      <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="relative bg-linear-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl px-8 py-14 sm:px-14 text-center shadow-xl shadow-indigo-500/20 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative space-y-6">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Ready to claim your merit passport?
            </h2>
            <p className="text-sm sm:text-base text-indigo-100 max-w-xl mx-auto leading-relaxed">
              Join verified service specialists and workplaces across Chicago. Set up your profile in under
              two minutes — no credit card, no anonymous reviews.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => navigate('/auth')}
                className="w-full sm:w-auto px-8 py-3.5 bg-white text-slate-900 font-black rounded-xl text-xs hover:bg-slate-100 shadow-md transition-all cursor-pointer flex items-center justify-center"
              >
                Sign Up for Free
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </button>
              <button
                onClick={() => navigate('/auth')}
                className="w-full sm:w-auto px-8 py-3.5 bg-white/10 border border-white/25 text-white font-bold rounded-xl text-xs hover:bg-white/20 transition-colors cursor-pointer flex items-center justify-center"
              >
                <Building className="w-3.5 h-3.5 mr-1.5" />
                Register a Business Workplace
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-bold text-indigo-100/90 pt-2">
              <span className="flex items-center"><Smartphone className="w-3.5 h-3.5 mr-1.5" /> Works on any phone</span>
              <span className="flex items-center"><Zap className="w-3.5 h-3.5 mr-1.5" /> Live in under 2 minutes</span>
              <span className="flex items-center"><Coffee className="w-3.5 h-3.5 mr-1.5" /> Built for service teams</span>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <Award className="w-4 h-4" />
            </div>
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">FeeTrust</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Verified Merit Network
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            <button onClick={() => scrollToSection('pricing')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Pricing</button>
            <button onClick={() => navigate('/terms')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Terms</button>
            <button onClick={() => navigate('/privacy')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Privacy</button>
            <a href="mailto:jm@feetrust.com" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">jm@feetrust.com</a>
          </div>
        </div>
        <p className="mt-6 text-center text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
          FeeTrust™ • Chicago • Pre-Seed
        </p>
      </footer>
    </div>
  );
}
