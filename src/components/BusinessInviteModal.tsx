import React, { useState } from 'react';
import { X, Copy, Check, Share2, Mail, Users, Building, Sparkles, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authHeaders } from '../lib/api';

export interface BusinessInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  businessAddress?: string;
  businessLat?: number;
  businessLng?: number;
  businessCategory?: string;
  businessId?: string;
  employeeLimit: number;
  currentStaffCount: number;
  planName?: string;
  isInitialPostSignup?: boolean;
  onNavigateToDashboard?: () => void;
  onOpenPricingModal?: () => void;
}

export default function BusinessInviteModal({
  isOpen,
  onClose,
  businessName,
  businessAddress,
  businessLat,
  businessLng,
  businessCategory,
  businessId,
  employeeLimit,
  currentStaffCount,
  planName = 'Starter',
  isInitialPostSignup = false,
  onNavigateToDashboard,
  onOpenPricingModal,
}: BusinessInviteModalProps) {
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  if (!isOpen) return null;

  const cleanBizName = businessName.trim() || 'Your Workplace';
  const bizPayload = {
    id: businessId || ('biz_' + Math.random().toString(36).substring(2, 9)),
    name: cleanBizName,
    address: businessAddress?.trim() || '',
    lat: businessLat,
    lng: businessLng,
    category: businessCategory || 'Food & Beverage',
    plan: planName || 'Starter',
    employeeLimit: employeeLimit || 4,
    managerInvite: true,
    inviteToken: `ft_inv_${businessId || 'biz'}_${Date.now()}`,
  };
  let bizDataParam = '';
  try {
    bizDataParam = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(bizPayload)))));
  } catch (e) {
    bizDataParam = encodeURIComponent(JSON.stringify(bizPayload));
  }
  const inviteUrl = `${window.location.origin}/auth?joinWorkplace=${encodeURIComponent(cleanBizName)}&bizData=${bizDataParam}`;
  const remainingSlots = Math.max(0, employeeLimit - currentStaffCount);
  const isAtCapacity = currentStaffCount >= employeeLimit;
  const capacityPercent = Math.min(100, Math.round((currentStaffCount / (employeeLimit || 1)) * 100));

  const handleCopyLink = () => {
    if (isAtCapacity) {
      toast.error(`Staff limit reached (${currentStaffCount}/${employeeLimit}). Please upgrade your plan to invite more employees.`);
      return;
    }
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success('Staff invitation link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (isAtCapacity) {
      toast.error(`Staff limit reached (${currentStaffCount}/${employeeLimit}). Please upgrade your plan to invite more employees.`);
      return;
    }
    const text = `Join the ${cleanBizName} team on FeeTrust! Claim your merit profile & verified passport here:`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${cleanBizName} on FeeTrust`,
          text: text,
          url: inviteUrl,
        });
        toast.success('Shared staff invitation link!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          navigator.clipboard.writeText(`${text} ${inviteUrl}`);
          toast.success('Invite message & link copied to clipboard!');
        }
      }
    } else {
      navigator.clipboard.writeText(`${text} ${inviteUrl}`);
      toast.success('Invite message & link copied! Ready to paste into Messages, Instagram, or WhatsApp.');
    }
  };

  const handleShareApp = (platform: 'whatsapp' | 'sms' | 'facebook') => {
    if (isAtCapacity) {
      toast.error(`Staff limit reached (${currentStaffCount}/${employeeLimit}). Please upgrade your plan to invite more employees.`);
      return;
    }
    const text = `Join the ${cleanBizName} team on FeeTrust! Claim your merit profile here: ${inviteUrl}`;
    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'sms') {
      window.open(`sms:?&body=${encodeURIComponent(text)}`, '_self');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`, '_blank');
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAtCapacity) {
      toast.error(`Staff limit reached (${currentStaffCount}/${employeeLimit}). Please upgrade your plan to invite more employees.`);
      return;
    }
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid employee email address.');
      return;
    }

    setIsSendingEmail(true);
    try {
      const bizTargetId = businessId || 'current';
      const res = await fetch(`/api/businesses/${bizTargetId}/invite`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          email: inviteEmail.trim(),
          businessName: cleanBizName,
          inviteUrl,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.emailSent) {
          toast.success(`Official invite email sent to ${inviteEmail.trim()}!`);
        } else {
          toast.success(`Invite recorded! (Notice: ${data.message})`);
        }
        setInviteEmail('');
      } else {
        throw new Error(data.error || 'Failed to dispatch email');
      }
    } catch (err: any) {
      console.warn("Direct email send notice, falling back to mail client:", err.message);
      handleOpenMailClient();
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleOpenMailClient = () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an employee email address first.');
      return;
    }
    const subject = encodeURIComponent(`You're invited to join ${cleanBizName} on FeeTrust`);
    const body = encodeURIComponent(
      `Hi there,\n\nYou have been invited to join the team at ${cleanBizName} on FeeTrust.\n\nClick the link below to set up your merit profile and begin earning customer merit endorsements:\n${inviteUrl}\n\nBest,\n${cleanBizName} Management`
    );
    window.location.href = `mailto:${inviteEmail.trim()}?subject=${subject}&body=${body}`;
    toast.success(`Opening your email app to send the invite to ${inviteEmail.trim()}!`);
    setInviteEmail('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 font-['Outfit',sans-serif]"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-linear-to-r from-blue-50/70 via-indigo-50/40 to-purple-50/40 dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {isInitialPostSignup ? '🎉 Business Registered!' : 'Invite Staff Team'}
                </h3>
                <span className="text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded-full uppercase">
                  {planName} Plan
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {cleanBizName} • {businessAddress || 'Map Pin Active'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          
          {/* Employee Limit & Capacity Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Plan Staff Capacity Limit
                </span>
              </div>
              <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-full ${
                isAtCapacity 
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' 
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}>
                {currentStaffCount} / {employeeLimit} Seats Used
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isAtCapacity ? 'bg-rose-500' : 'bg-linear-to-r from-blue-600 to-indigo-600'
                }`}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span>{isAtCapacity ? 'Capacity reached (0 slots remaining)' : `${remainingSlots} employee invite slot${remainingSlots === 1 ? '' : 's'} remaining`}</span>
              {onOpenPricingModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPricingModal();
                  }}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer flex items-center"
                >
                  <Sparkles className="w-3 h-3 mr-0.5" /> Upgrade Plan
                </button>
              )}
            </div>
          </div>

          {/* Warning if at capacity */}
          {isAtCapacity && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start space-x-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <strong className="block font-bold">Staff Limit Reached ({employeeLimit}/{employeeLimit})</strong>
                You have reached the employee maximum for your <strong>{planName} Plan</strong>. New staff invitations are paused until you upgrade your plan level.
              </div>
            </div>
          )}

          {/* Shareable Link Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Shareable Employee Invite Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 truncate focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={isAtCapacity}
                className="px-4 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-xs flex items-center shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              When an employee opens this link, they will be registered directly onto <strong>{cleanBizName}</strong>'s team (up to {employeeLimit} total employees).
            </p>
          </div>

          {/* 1-Click Native Phone & App Sharing */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Quick Share via Messaging & Apps
            </label>
            
            <button
              type="button"
              onClick={handleNativeShare}
              disabled={isAtCapacity}
              className="w-full py-3 bg-linear-to-r from-emerald-500 via-teal-600 to-indigo-600 text-white font-black rounded-2xl text-xs flex items-center justify-center shadow-md hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer space-x-2"
            >
              <Share2 className="w-4 h-4" />
              <span>Share via Phone Apps (Messages, WhatsApp, Instagram, AirDrop...)</span>
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleShareApp('whatsapp')}
                disabled={isAtCapacity}
                className="py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl text-xs flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span className="mr-1.5 text-sm">💬</span> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => handleShareApp('sms')}
                disabled={isAtCapacity}
                className="py-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 font-bold rounded-xl text-xs flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span className="mr-1.5 text-sm">📱</span> SMS
              </button>
              <button
                type="button"
                onClick={() => handleShareApp('facebook')}
                disabled={isAtCapacity}
                className="py-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span className="mr-1.5 text-sm">📘</span> Facebook
              </button>
            </div>
          </div>

          {/* Direct Email Invite Form */}
          <form onSubmit={handleSendEmail} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Email Staff Invitation
              </label>
              <span className="text-[10px] text-slate-400">Sent directly via FeeTrust</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  disabled={isAtCapacity || isSendingEmail}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={isAtCapacity || isSendingEmail}
                className="px-5 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-xs shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center space-x-1.5"
              >
                {isSendingEmail ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                    <span>Sending Invite...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5 mr-1" />
                    <span>Send Invite Email</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleOpenMailClient}
                className="text-[11px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                Prefer your own mail client? Click to open mailto:
              </button>
            </div>
          </form>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          {onNavigateToDashboard ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToDashboard();
              }}
              className="px-4 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-xs shadow-sm hover:opacity-95 transition-opacity flex items-center cursor-pointer"
            >
              <Building className="w-3.5 h-3.5 mr-1.5" /> Go to Business Dashboard
            </button>
          ) : (
            <div className="text-[11px] text-slate-400 font-medium">
              Manage team members anytime in Dashboard
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {isInitialPostSignup ? 'Continue to App' : 'Done'}
          </button>
        </div>

      </div>
    </div>
  );
}
