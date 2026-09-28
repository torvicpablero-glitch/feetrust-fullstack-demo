import React, { useState } from 'react';
import { X, Shield, Lock, Eye, Database, Trash2, Globe, FileText, CheckCircle2 } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-['Outfit',sans-serif]">

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800/60">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 id="legal-modal-title" className="text-xl font-black text-slate-900 dark:text-slate-100">
                {activeTab === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">FeeTrust Verified Merit System • Effective 2026</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/30 dark:bg-slate-900/30">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${activeTab === 'privacy'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${activeTab === 'terms'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
          >
            Terms of Service
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {activeTab === 'privacy' ? (
            <>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center mb-2">
                  <Database className="w-4 h-4 mr-2 text-blue-500" /> 1. Information We Collect
                </h3>
                <p className="mb-2">We collect only information necessary to provide the FeeTrust verified merit, digital vault, and rewards platform:</p>
                <ul className="list-disc pl-5 space-y-1 text-xs md:text-sm">
                  <li><strong>Account Details:</strong> Full name, email address, password hash, and selected account role (Worker, Customer, Business).</li>
                  <li><strong>Workplace & Profile Details:</strong> Job title/position, workplace name, profile avatar, and public workplace coordinates for map discovery.</li>
                  <li><strong>Merit Data:</strong> Recognition given or received, merit categories, thank-you notes, and redeemable gems earned.</li>
                  <li><strong>Location Data:</strong> Public workplace coordinates submitted during registration or geocoded via street address to render workforce pins on the map.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center mb-2">
                  <Globe className="w-4 h-4 mr-2 text-indigo-500" /> 2. Third-Party Service Providers
                </h3>
                <p className="mb-2">FeeTrust integrates with trusted industry-standard infrastructure providers to deliver our services:</p>
                <div className="space-y-2 text-xs md:text-sm">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-slate-100">Supabase Inc.</strong> — Database hosting, authentication services, and Row Level Security (RLS) data isolation.
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-slate-100">Google Maps Platform</strong> — Map tiles, map rendering, and address geocoding.
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-slate-100">Resend Inc.</strong> — Transactional email verification and security PIN delivery.
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-slate-100">Vercel Inc.</strong> — Edge web application delivery and serverless API execution.
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center mb-2">
                  <Lock className="w-4 h-4 mr-2 text-emerald-500" /> 3. Data Protection & Row Level Security
                </h3>
                <p>
                  All database tables are protected by PostgreSQL Row Level Security (RLS). User credentials and password hashes are never exposed publicly or queryable by anonymous clients. Only verified account owners or administrators have access to modify their own data.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center mb-2">
                  <Trash2 className="w-4 h-4 mr-2 text-rose-500" /> 4. Your Rights & Account Deletion (GDPR & CCPA)
                </h3>
                <p>
                  You have the right to access, update, or permanently delete your account and associated personal data at any time. You can trigger complete account erasure directly from your <strong>Settings & Privacy</strong> panel.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center mb-2">
                  <Eye className="w-4 h-4 mr-2 text-amber-500" /> 5. No Third-Party Ad Tracking
                </h3>
                <p>
                  FeeTrust does not sell, rent, or monetize your personal information to third-party data brokers or advertising networks. Local storage is strictly used for secure session authentication tokens and UI preferences.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-2">
                  1. Acceptance of Terms
                </h3>
                <p>
                  By accessing or using FeeTrust (accessible via feetrust.com or mobile web app), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the service.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-2">
                  2. Honest Merit Recognitions & Anti-Fraud Rules
                </h3>
                <p className="mb-2">To preserve trust and authenticity in the FeeTrust ecosystem:</p>
                <ul className="list-disc pl-5 space-y-1 text-xs md:text-sm">
                  <li>Users may not recognize or award merit points to themselves.</li>
                  <li>Recognitions are limited to 1 review per week per individual worker to eliminate manipulation.</li>
                  <li>Fake reviews, extortion, automated bot recognition, and fraudulent feedback are strictly prohibited.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-2">
                  3. Worker & Business Accounts
                </h3>
                <p>
                  Workers and Business owners are responsible for maintaining accurate workplace details. FeeTrust reserves the right to suspend accounts that misrepresent identity or post unauthorized commercial workplaces.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-2">
                  4. Gems & Reward Vouchers
                </h3>
                <p>
                  Gems and coupons earned through authentic reviews are promotional rewards and do not constitute legal tender or banking deposits. Vouchers are subject to individual merchant redemption rules.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-sm hover:opacity-95 transition-opacity text-sm cursor-pointer"
          >
            I Understand & Accept
          </button>
        </div>
      </div>
    </div>
  );
}
