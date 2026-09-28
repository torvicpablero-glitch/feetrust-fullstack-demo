import React, { useState, useEffect } from 'react';
import { useStore, BusinessProfile } from '../lib/store';
import { Briefcase, User, Store, ChevronRight, Check, MapPin, Building, Award, Sparkles, Loader2, LogOut, ShieldCheck, Users, CreditCard } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isUserOnboarded, markUserOnboarded } from '../lib/auth';
import { authHeaders } from '../lib/api';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import PricingPlansSelector, { PRICING_PLANS, PricingPlan } from '../components/PricingPlansSelector';
import BusinessInviteModal from '../components/BusinessInviteModal';
import { geocodeStreetAddress } from '../lib/geocoding';
import { playMeritSuccess } from '../lib/audio';
import { redirectToStripeCheckout } from '../lib/stripe';
import toast from 'react-hot-toast';

export default function OnboardingPage() {
  const { user, appState, updateState, signOut, switchRole } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'Business' | 'Worker' | 'Customer' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Specific states for different roles
  const [fullName, setFullName] = useState(user?.name || appState?.profile?.displayName || appState?.profile?.name || '');

  // Worker & Business Address/Location fields
  const [avatar, setAvatar] = useState(user?.photoURL || '');
  const [invitedWorkplace, setInvitedWorkplace] = useState('');

  const handleDismissInvite = () => {
    try {
      sessionStorage.removeItem('feetrust_pending_invite');
    } catch (e) {}
    setInvitedWorkplace('');
    setWorkplace('');
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    setStep(1);
    toast.success('Workplace invitation declined. You can continue standard setup.');
  };
  const [position, setPosition] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [address, setAddress] = useState('');
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | undefined>(undefined);

  // Business specific
  const [industry, setIndustry] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>(PRICING_PLANS[0]);

  // Business Post-Signup Invite Modal state
  const [showBusinessInviteModal, setShowBusinessInviteModal] = useState(false);
  const [createdBusiness, setCreatedBusiness] = useState<{
    name: string;
    address: string;
    planName: string;
    employeeLimit: number;
    staffCount: number;
  } | null>(null);

  // Read URL query params & sessionStorage for worker invitations
  const [matchedBusiness, setMatchedBusiness] = useState<BusinessProfile | null>(null);

  // Sync user's name into fullName when user authenticates
  useEffect(() => {
    if (user?.name && (!fullName || fullName === 'User')) {
      setFullName(user.name);
    }
  }, [user?.name, fullName]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let joinWp = params.get('joinWorkplace') || params.get('workplace');
    const bizDataParam = params.get('bizData');
    let bizMeta: any = null;

    if (bizDataParam) {
      try {
        bizMeta = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(bizDataParam)))));
      } catch (e) {
        try {
          bizMeta = JSON.parse(decodeURIComponent(bizDataParam));
        } catch (e2) { }
      }
    }

    if (!bizMeta) {
      try {
        const saved = sessionStorage.getItem('feetrust_pending_invite');
        if (saved) {
          const parsed = JSON.parse(saved);
          joinWp = parsed.workplace || parsed.name || joinWp;
          if (parsed.name || parsed.address) {
            bizMeta = parsed;
          }
        }
      } catch (e) { }
    }

    if (bizMeta && bizMeta.name) {
      joinWp = bizMeta.name;
    }

    const isCurrentUserBusiness = user?.role === 'Business' || appState?.profile?.role === 'Business';
    if (isCurrentUserBusiness) {
      try {
        sessionStorage.removeItem('feetrust_pending_invite');
      } catch (e) { }
      return;
    }

    if (joinWp) {
      const cleanWp = decodeURIComponent(joinWp).trim();
      setInvitedWorkplace(cleanWp);
      setRole('Worker');
      setStep(2);
      setWorkplace(cleanWp);

      const found = (appState.businesses || []).find(
        b => b && b.name && b.name.toLowerCase().trim() === cleanWp.toLowerCase()
      );

      const resolvedAddress = bizMeta?.address || found?.address || '';
      const resolvedLat = bizMeta?.lat || found?.lat || found?.location?.lat;
      const resolvedLng = bizMeta?.lng || found?.lng || found?.location?.lng;

      if (found) {
        setMatchedBusiness(found);
      } else if (bizMeta) {
        const generatedBiz: BusinessProfile = {
          id: bizMeta.id || ('biz_' + Math.random().toString(36).substring(2, 9)),
          name: cleanWp,
          category: bizMeta.category || 'Food & Beverage',
          address: resolvedAddress,
          rating: Number(bizMeta.rating || 5.0),
          lat: resolvedLat,
          lng: resolvedLng,
          location: (resolvedLat && resolvedLng) ? { lat: resolvedLat, lng: resolvedLng } : undefined,
          plan: bizMeta.plan || 'Starter',
          employeeLimit: Number(bizMeta.employeeLimit || 4),
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/${bizMeta.id}`,
          workers: [],
        };
        setMatchedBusiness(generatedBiz);
      }

      if (resolvedAddress) {
        setAddress(resolvedAddress);
      }
      if (resolvedLat && resolvedLng) {
        setLatLng({ lat: resolvedLat, lng: resolvedLng });
      } else if (resolvedAddress) {
        geocodeStreetAddress(resolvedAddress).then(geo => {
          if (geo && geo.lat && geo.lng) {
            setLatLng(geo);
          }
        }).catch(() => { });
      }
    }
  }, [appState.businesses]);

  const currentUserEmail = (user?.email || appState?.profile?.email || '').trim().toLowerCase();
  const isCurrentUserBusiness = user?.role === 'Business' || appState?.profile?.role === 'Business';

  // Only redirect if onboarded
  if (!submitting && !showBusinessInviteModal && currentUserEmail && isUserOnboarded(currentUserEmail)) {
    if (isCurrentUserBusiness) {
      return <Navigate to="/business" replace />;
    }
    if (!invitedWorkplace) {
      return <Navigate to="/" replace />;
    }
  }

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      toast.error('Please select an account type.');
      setStep(1);
      return;
    }

    const cleanFullName = (fullName.trim() || user?.name || appState?.profile?.displayName || '').trim();
    if (!cleanFullName) {
      toast.error('Please enter your full name at the top of the form.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (role === 'Business') {
      if (!workplace.trim()) {
        toast.error('Please enter your business / company name.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (!address.trim()) {
        toast.error('Please enter your business street address.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    if (role === 'Worker' && !invitedWorkplace) {
      if (!workplace.trim()) {
        toast.error('Please enter your workplace name.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (!address.trim()) {
        toast.error('Please enter your workplace street address.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const userEmail = (user?.email || appState?.profile?.email || '').trim().toLowerCase();
      const cleanDisplayName = cleanFullName || 'User';

      let registeredBizId = '';
      let registeredBizName = '';

      let profileUpdates: any = {
        role,
        displayName: cleanDisplayName,
        name: cleanDisplayName,
        email: userEmail,
      };

      if (role === 'Worker') {
        let workerLat = latLng?.lat;
        let workerLng = latLng?.lng;

        if ((!workerLat || !workerLng) && address.trim()) {
          try {
            const geoPromise = geocodeStreetAddress(address.trim());
            const timeoutPromise = new Promise<{ lat: number; lng: number }>((resolve) =>
              setTimeout(() => resolve({ lat: 41.8781, lng: -87.6298 }), 2000)
            );
            const geo = await Promise.race([geoPromise, timeoutPromise]);
            workerLat = geo.lat;
            workerLng = geo.lng;
          } catch (geoErr) {
            workerLat = 41.8781;
            workerLng = -87.6298;
          }
        }

        profileUpdates.position = position.trim() || 'Staff Member';
        profileUpdates.workplace = workplace.trim() || 'Workplace';
        profileUpdates.address = address.trim();
        if (workerLat && workerLng) {
          profileUpdates.location = { lat: workerLat, lng: workerLng };
        }

        const wpName = workplace.trim() || 'Workplace';
        const isInviteSignup = Boolean(
          invitedWorkplace && invitedWorkplace.toLowerCase().trim() === wpName.toLowerCase()
        );
        const existingBiz = (appState?.businesses || []).find(
          b => b && b.name && b.name.toLowerCase().trim() === wpName.toLowerCase()
        ) || matchedBusiness;

        const targetBizId = existingBiz?.id || matchedBusiness?.id || undefined;

        const newWorkerPin = {
          id: 'worker_' + Math.random().toString(36).substring(2, 9),
          name: cleanDisplayName,
          position: position.trim() || 'Staff Member',
          workplace: wpName,
          address: address.trim(),
          avatar: user?.photoURL || undefined,
          level: 1,
          initials: (cleanDisplayName || 'WK').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase(),
          lat: workerLat || 41.8781,
          lng: workerLng || -87.6298,
          role: 'Worker' as const,
          isAvailable: true,
          registeredViaInvite: isInviteSignup,
          isVerifiedStaff: isInviteSignup,
          invitedByBusinessId: isInviteSignup ? targetBizId : undefined,
          businessId: isInviteSignup ? targetBizId : undefined,
        };

        // Only manager-invited staff are checked against the business plan's staff seat limit
        if (isInviteSignup && existingBiz) {
          const limit = existingBiz.employeeLimit || 4;
          const currentCount = existingBiz.workers?.length || 0;
          if (currentCount >= limit) {
            toast.error(`Staff Limit Reached: "${existingBiz.name}" has reached its maximum staff capacity of ${limit} employees under its current plan. Please ask the business owner to upgrade their plan.`);
            setSubmitting(false);
            return;
          }
        }

        let updatedBusinesses = [...(appState?.businesses || [])];

        if (!existingBiz) {
          const bizId = 'biz_' + Math.random().toString(36).substring(2, 9);
          const autoBusiness: BusinessProfile = {
            id: bizId,
            name: wpName,
            category: position.trim() || 'Service & Hospitality',
            address: address.trim() || 'Workplace Address',
            rating: 5.0,
            lat: workerLat,
            lng: workerLng,
            location: (workerLat && workerLng) ? { lat: workerLat, lng: workerLng } : undefined,
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/${bizId}`,
            workers: isInviteSignup ? [newWorkerPin] : [],
          };
          updatedBusinesses.unshift(autoBusiness);

          // Persist to REST API
          try {
            await fetch('/api/businesses', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(autoBusiness),
            });
          } catch (e) { }
        } else if (isInviteSignup) {
          // ONLY if registered via official manager invite link, enroll into business management roster
          const bizExistsInList = updatedBusinesses.some(b => b.id === existingBiz.id || b.name.toLowerCase().trim() === existingBiz.name.toLowerCase().trim());
          if (!bizExistsInList) {
            const fullBiz = {
              ...existingBiz,
              lat: workerLat || existingBiz.lat,
              lng: workerLng || existingBiz.lng,
              location: (workerLat && workerLng) ? { lat: workerLat, lng: workerLng } : existingBiz.location,
              workers: [newWorkerPin, ...(existingBiz.workers || [])]
            };
            updatedBusinesses.unshift(fullBiz);
            try {
              await fetch('/api/businesses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullBiz),
              });
            } catch (e) { }
          } else {
            let bizToSave: any = null;
            updatedBusinesses = updatedBusinesses.map(b => {
              if (b && (b.id === existingBiz.id || (b.name && b.name.toLowerCase().trim() === wpName.toLowerCase()))) {
                const existingWorkers = b.workers || [];
                const mergedWorkers = existingWorkers.some(w => w && w.name && w.name.toLowerCase().trim() === newWorkerPin.name.toLowerCase().trim())
                  ? existingWorkers
                  : [...existingWorkers, newWorkerPin];
                const updatedBiz = {
                  ...b,
                  lat: workerLat || b.lat,
                  lng: workerLng || b.lng,
                  location: (workerLat && workerLng) ? { lat: workerLat, lng: workerLng } : b.location,
                  workers: mergedWorkers
                };
                bizToSave = updatedBiz;
                return updatedBiz;
              }
              return b;
            });
            if (bizToSave) {
              try {
                await fetch('/api/businesses', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(bizToSave),
                });
              } catch (e) { }
            }
          }
        }

        // Persist worker directly to /api/workers
        try {
          await fetch('/api/workers', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(newWorkerPin),
          });
        } catch (e) { }

        await updateState({
          profile: { ...(appState?.profile || {}), ...profileUpdates },
          workers: [newWorkerPin, ...(appState?.workers || [])],
          businesses: updatedBusinesses
        });
      } else if (role === 'Business') {
        const targetBizName = workplace.trim();
        const cleanIndustry = industry.trim() || 'Business';
        const existingBiz = (appState?.businesses || []).find(
          b => b && b.name && b.name.toLowerCase().trim() === targetBizName.toLowerCase()
        );

        let bizId = existingBiz?.id || ('biz_' + Math.random().toString(36).substring(2, 9));
        registeredBizId = bizId;
        registeredBizName = targetBizName;
        let bizLat = latLng?.lat || existingBiz?.lat;
        let bizLng = latLng?.lng || existingBiz?.lng;

        if ((!bizLat || !bizLng) && address.trim()) {
          try {
            const geoPromise = geocodeStreetAddress(address.trim());
            const timeoutPromise = new Promise<{ lat: number; lng: number }>((resolve) =>
              setTimeout(() => resolve({ lat: 41.8781, lng: -87.6298 }), 2000)
            );
            const geo = await Promise.race([geoPromise, timeoutPromise]);
            bizLat = geo.lat;
            bizLng = geo.lng;
          } catch (geoErr) {
            bizLat = 41.8781;
            bizLng = -87.6298;
          }
        }

        profileUpdates.workplace = targetBizName;
        profileUpdates.position = cleanIndustry;
        profileUpdates.address = address.trim();
        profileUpdates.plan = selectedPlan.name;
        profileUpdates.planPrice = `${selectedPlan.priceFormatted} ${selectedPlan.period}`;
        profileUpdates.employeeLimit = selectedPlan.employeeLimit;
        profileUpdates.hasPaid = false;
        profileUpdates.paymentStatus = 'pending';

        if (bizLat && bizLng) {
          profileUpdates.lat = bizLat;
          profileUpdates.lng = bizLng;
          profileUpdates.location = { lat: bizLat, lng: bizLng };
        }

        const newBusiness: BusinessProfile = {
          ...(existingBiz || {}),
          id: bizId,
          name: targetBizName,
          category: cleanIndustry,
          address: address.trim() || existingBiz?.address || 'Workplace Address',
          rating: existingBiz?.rating || 5.0,
          lat: bizLat,
          lng: bizLng,
          location: (bizLat && bizLng) ? { lat: bizLat, lng: bizLng } : undefined,
          plan: selectedPlan.name,
          planPrice: `${selectedPlan.priceFormatted} ${selectedPlan.period}`,
          employeeLimit: selectedPlan.employeeLimit,
          qrCodeUrl: existingBiz?.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/${bizId}`,
          workers: existingBiz?.workers || [],
          user_id: user?.uid,
          ownerEmail: userEmail,
          hasPaid: false,
          paymentStatus: 'pending',
        };

        const newBusinessPin = {
          id: bizId,
          name: targetBizName,
          position: cleanIndustry,
          workplace: targetBizName,
          address: address.trim(),
          level: 5,
          initials: targetBizName.substring(0, 2).toUpperCase() || 'BZ',
          lat: bizLat || 41.8781,
          lng: bizLng || -87.6298,
          role: 'Business' as const,
          isAvailable: true,
        };

        const otherBusinesses = (appState?.businesses || []).filter(b => b && b.id !== bizId && b.name.toLowerCase().trim() !== targetBizName.toLowerCase());
        const otherWorkers = (appState?.workers || []).filter(w => w && w.id !== bizId && w.name.toLowerCase().trim() !== targetBizName.toLowerCase());

        await updateState({
          profile: { ...(appState?.profile || {}), ...profileUpdates },
          businesses: [newBusiness, ...otherBusinesses],
          workers: [newBusinessPin, ...otherWorkers],
        });

        // Persist to REST API
        fetch('/api/businesses', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(newBusiness),
        }).catch(() => { });

      } else if (role === 'Customer') {
        profileUpdates.position = 'Customer';
        await updateState({
          profile: { ...(appState?.profile || {}), ...profileUpdates }
        });
      }

      // Persist role to backend database so role is authoritative
      if (role) {
        switchRole(role);
        try {
          await fetch('/api/auth/role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ role }),
          });
        } catch (roleErr) {
          console.warn('[ONBOARDING] Failed to persist role to /api/auth/role:', roleErr);
        }

        try {
          await fetch('/api/auth/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              id: user?.uid,
              email: userEmail,
              name: cleanDisplayName,
              role,
              position: profileUpdates.position || '',
              workplace: profileUpdates.workplace || '',
              avatar: user?.photoURL || null,
              hasPaid: profileUpdates.hasPaid,
              paymentStatus: profileUpdates.paymentStatus,
            }),
          });
        } catch (profErr) {
          console.warn('[ONBOARDING] Failed to persist profile to /api/auth/profile:', profErr);
        }
      }

      // Clear pending invite from session storage
      try {
        sessionStorage.removeItem('feetrust_pending_invite');
      } catch (e) { }

      markUserOnboarded(userEmail);

      if (role === 'Business') {
        const planId = selectedPlan.id || 'starter';
        toast.success(`🎉 Business registered! Redirecting to secure Stripe Checkout for your ${selectedPlan.name}...`, { duration: 6000 });

        const origin = window.location.origin;
        await redirectToStripeCheckout({
          planId,
          businessId: registeredBizId,
          businessName: registeredBizName || workplace.trim(),
          customerEmail: userEmail,
          successUrl: `${origin}/business?payment=success&plan=${planId}&registered=true`,
          cancelUrl: `${origin}/business?payment=cancelled&plan=${planId}&registered=true`,
        });
        return;
      } else if (role === 'Worker' && invitedWorkplace) {
        playMeritSuccess();
        toast.success(`🎉 You've joined ${workplace.trim()} team! Welcome to the team.`);
        navigate('/');
      } else {
        toast.success(`Welcome to FeeTrust, ${cleanDisplayName}!`);
        navigate('/');
      }
    } catch (err) {
      console.error("Onboarding error:", err);
      navigate('/');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStaffCount = (matchedBusiness?.workers || []).filter(
    w => w && w.role !== 'Business' && w.id !== matchedBusiness?.id && (w.name || '').toLowerCase().trim() !== (matchedBusiness?.name || '').toLowerCase().trim()
  ).length;
  const staffLimit = matchedBusiness?.employeeLimit || 4;
  const isBizFull = currentStaffCount >= staffLimit;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-900 dark:text-slate-100 font-sans relative">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Header Logo */}
      <div className="mb-6 flex flex-col items-center">
        <div className="p-2 rounded-2xl bg-white/95 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-center">
          <img
            src="/logo.png"
            alt="FeeTrust"
            className="h-12 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.src = '/feetrust-logo.png';
            }}
          />
        </div>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-300 relative z-10">
        {step === 1 && !invitedWorkplace && (
          <div className="space-y-6 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl backdrop-blur-md">
            <div className="text-center mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 mb-3">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> First-Time Account Setup
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">Welcome to FeeTrust</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Please choose how you want to use your account:</p>
            </div>

            <button
              onClick={() => { setRole('Worker'); setStep(2); }}
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500 dark:hover:border-indigo-500 p-5 rounded-2xl flex items-center transition-all group shadow-sm hover:shadow-md cursor-pointer text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform border border-indigo-100 dark:border-indigo-800/60">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base md:text-lg text-slate-900 dark:text-slate-100">I'm a Worker</h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Receive merits, earn gems, build your merit profile.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
            </button>

            <button
              onClick={() => { setRole('Customer'); setStep(2); }}
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 hover:border-amber-500 dark:hover:border-amber-500 p-5 rounded-2xl flex items-center transition-all group shadow-sm hover:shadow-md cursor-pointer text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform border border-amber-200 dark:border-amber-800/60">
                <Store className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base md:text-lg text-slate-900 dark:text-slate-100">I'm a Customer</h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Discover workers, award merits & earn redeemable gems.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors" />
            </button>

            <button
              onClick={() => { setRole('Business'); setStep(2); }}
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 hover:border-rose-500 dark:hover:border-rose-500 p-5 rounded-2xl flex items-center transition-all group shadow-sm hover:shadow-md cursor-pointer text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform border border-rose-200 dark:border-rose-800/60">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base md:text-lg text-slate-900 dark:text-slate-100">I'm a Business Owner</h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Manage store team & counter QR posters.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors" />
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => signOut()}
                className="text-xs text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 flex items-center justify-center mx-auto transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" /> Sign out and use a different account
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 (OR DIRECT INVITE ACCEPTANCE) */}
        {(step === 2 || invitedWorkplace) && (
          <form onSubmit={handleComplete} noValidate className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl backdrop-blur-md">

            {invitedWorkplace ? (
              /* DEDICATED 10-STAR WORKPLACE INVITATION HERO */
              <div className="mb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Team Invitation
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isBizFull
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                        : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                      }`}>
                      {isBizFull ? 'Seat Limit Reached' : `Seat ${currentStaffCount + 1} of ${staffLimit}`}
                    </span>
                    <button
                      type="button"
                      onClick={handleDismissInvite}
                      className="text-xs font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-0.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-linear-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-200/80 dark:border-indigo-800/80 flex items-start space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Building className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 truncate">
                      Join {matchedBusiness?.name || invitedWorkplace}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center mt-0.5 truncate">
                      <MapPin className="w-3 h-3 mr-1 text-indigo-500 shrink-0" />
                      {matchedBusiness?.address || address || 'Workplace'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      You will be added directly into the verified team on FeeTrust.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <button type="button" onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6 flex items-center text-sm font-semibold cursor-pointer">
                  <span className="mr-1">←</span> Back to Role Selection
                </button>

                <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                  {role === 'Worker' ? 'Your Details' : role === 'Business' ? 'Business Details' : 'Almost There!'}
                </h2>
              </div>
            )}

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2 font-medium">Your Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 transition-colors"
                  placeholder="e.g. Jordan Chen"
                />
              </div>

              {role === 'Worker' && (
                <>
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2 font-medium">Your Job Title / Position</label>
                    <input
                      type="text"
                      required
                      value={position}
                      onChange={e => setPosition(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 transition-colors"
                      placeholder="e.g. Lead Barista, Customer Support, Server"
                    />

                    {/* Quick Suggestion Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['Customer Support Lead', 'Head Barista', 'Service Specialist', 'Hair Stylist', 'Shift Supervisor'].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setPosition(chip)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!invitedWorkplace ? (
                    <>
                      <div>
                        <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2 font-medium">Current Workplace / Business</label>
                        <input
                          type="text"
                          required
                          value={workplace}
                          onChange={e => setWorkplace(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 transition-colors"
                          placeholder="e.g. Blue Bottle Coffee, Target, Marriott"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2 font-medium">Workplace Street Address / Precise Location</label>
                        <AddressAutocompleteInput
                          value={address}
                          onChange={(val, coords) => {
                            setAddress(val);
                            if (coords) setLatLng(coords);
                          }}
                          placeholder="Start typing street address (e.g. 100 S State St...)"
                          required
                        />
                        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 flex items-center">
                          <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400" /> Autocompletes address & pinpoints your workplace on the map!
                        </p>
                      </div>
                    </>
                  ) : null}
                </>
              )}

              {role === 'Business' && (
                <>
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2 font-medium">Business / Company Name</label>
                    <input
                      type="text"
                      required
                      value={workplace}
                      onChange={e => setWorkplace(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 transition-colors"
                      placeholder="e.g. Apex Coffee Roasters LLC"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2 font-medium">Industry Category</label>
                    <input
                      type="text"
                      required
                      value={industry}
                      onChange={e => setIndustry(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 transition-colors"
                      placeholder="e.g. Food & Beverage, Hospitality, Retail"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2 font-medium">Precise Business Workplace Address / Location</label>
                    <AddressAutocompleteInput
                      value={address}
                      onChange={(val, coords) => {
                        setAddress(val);
                        if (coords) setLatLng(coords);
                      }}
                      placeholder="Start typing business address (e.g. 540 N Michigan Ave...)"
                      required
                    />
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1 flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-rose-600 dark:text-rose-400" /> Autocompletes address & places your business pin on the map!
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    <PricingPlansSelector
                      selectedPlanId={selectedPlan.id}
                      onSelectPlan={setSelectedPlan}
                    />
                  </div>
                </>
              )}

              {role === 'Customer' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200 dark:border-emerald-800/60">
                    <Check className="w-8 h-8" />
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">You're all set to start giving merits and earning gems!</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || (Boolean(invitedWorkplace) && isBizFull)}
              className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-md hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center cursor-pointer text-sm space-x-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {role === 'Business' ? 'Redirecting to Stripe...' : invitedWorkplace ? 'Joining Team...' : 'Completing Setup...'}
                </>
              ) : role === 'Business' ? (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  <span>Proceed to Stripe Checkout ({selectedPlan.priceFormatted}{selectedPlan.period})</span>
                </>
              ) : invitedWorkplace ? (
                '🎉 Accept & Join Team'
              ) : (
                'Complete Setup'
              )}
            </button>

            {invitedWorkplace && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setInvitedWorkplace(null);
                    setStep(1);
                    setRole(null);
                    try {
                      sessionStorage.removeItem('feetrust_pending_invite');
                    } catch (e) { }
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  Not part of this business? Set up a different account type
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Post-Signup Business Invite Modal */}
      {showBusinessInviteModal && createdBusiness && (
        <BusinessInviteModal
          isOpen={showBusinessInviteModal}
          onClose={() => {
            setShowBusinessInviteModal(false);
            navigate('/');
          }}
          businessName={createdBusiness.name}
          businessAddress={createdBusiness.address}
          employeeLimit={createdBusiness.employeeLimit}
          currentStaffCount={createdBusiness.staffCount}
          planName={createdBusiness.planName}
          isInitialPostSignup={true}
          onNavigateToDashboard={() => {
            setShowBusinessInviteModal(false);
            navigate('/dashboard');
          }}
        />
      )}
    </div>
  );
}
