import React, { useState, useEffect, useRef } from 'react';
import { useStore, BusinessProfile, WorkerProfile } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, Lock, User as UserIcon, Loader2, LogIn, UserPlus, Store, Briefcase, 
  MapPin, Building, Award, Eye, EyeOff, Sparkles, Headphones, Clock,
  QrCode, ShieldCheck, CheckCircle2, ChevronDown, ArrowRight, Star, TrendingUp, Check,
  CreditCard
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import PricingPlansSelector, { PRICING_PLANS, PricingPlan } from '../components/PricingPlansSelector';
import BusinessInviteModal from '../components/BusinessInviteModal';
import { geocodeStreetAddress } from '../lib/geocoding';
import { isUserOnboarded, markUserOnboarded, getSavedUser } from '../lib/auth';
import { authHeaders } from '../lib/api';
import { redirectToStripeCheckout } from '../lib/stripe';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';

export default function AuthPage() {
  const { user, loginEmail, signupEmail, loginGoogle, updateState, appState } = useStore();
  const navigate = useNavigate();

  // Business Post-Signup Invite Modal state
  const [showBusinessInviteModal, setShowBusinessInviteModal] = useState(false);
  const [createdBusiness, setCreatedBusiness] = useState<{
    name: string;
    address: string;
    planName: string;
    employeeLimit: number;
    staffCount: number;
  } | null>(null);

  // URL Invitee State (when worker arrives via shared invite link)
  const [invitedBusiness, setInvitedBusiness] = useState<{
    name: string;
    id?: string;
    address?: string;
    limit: number;
    currentCount: number;
    isFull: boolean;
  } | null>(null);

  useEffect(() => {
    if (user?.email && !showBusinessInviteModal) {
      let pendingWp = '';
      let pendingBizData = '';
      try {
        const savedInvite = sessionStorage.getItem('feetrust_pending_invite');
        if (savedInvite) {
          const parsed = JSON.parse(savedInvite);
          pendingWp = parsed.workplace || parsed.name || '';
          if (parsed.bizData) pendingBizData = parsed.bizData;
        }
      } catch (e) {}

      const isBusiness = user.role === 'Business' || appState.profile?.role === 'Business';
      if (isBusiness) {
        try {
          sessionStorage.removeItem('feetrust_pending_invite');
        } catch (e) {}
        navigate('/business', { replace: true });
        return;
      }

      const onboarded = isUserOnboarded(user.email);
      if (onboarded && !pendingWp) {
        navigate('/', { replace: true });
      } else if (onboarded && pendingWp && user.role !== 'Customer') {
        navigate('/', { replace: true });
      } else {
        const params = new URLSearchParams();
        if (pendingWp) params.set('joinWorkplace', pendingWp);
        if (pendingBizData) params.set('bizData', pendingBizData);
        const targetUrl = params.toString() ? `/onboarding?${params.toString()}` : '/onboarding';
        navigate(targetUrl, { replace: true });
      }
    }
  }, [user, navigate, showBusinessInviteModal, appState.profile?.role]);

  // Read ?joinWorkplace= and ?bizData= from URL query parameters, hash state, or sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let joinWorkplace = params.get('joinWorkplace') || params.get('workplace');
    const bizDataParam = params.get('bizData');
    let bizMeta: any = null;

    if (bizDataParam) {
      try {
        bizMeta = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(bizDataParam)))));
      } catch (e) {
        try {
          bizMeta = JSON.parse(decodeURIComponent(bizDataParam));
        } catch (e2) {}
      }
    }

    if (!joinWorkplace && window.location.hash) {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
        const stateParam = hashParams.get('state');
        if (stateParam) {
          const parsedState = JSON.parse(decodeURIComponent(stateParam));
          if (parsedState.joinWorkplace) {
            joinWorkplace = parsedState.joinWorkplace;
          }
          if (parsedState.bizData && !bizMeta) {
            try {
              bizMeta = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(parsedState.bizData)))));
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    if (!joinWorkplace && !bizMeta) {
      try {
        const saved = sessionStorage.getItem('feetrust_pending_invite');
        if (saved) {
          const parsed = JSON.parse(saved);
          joinWorkplace = parsed.workplace || parsed.name || null;
          if (parsed.name || parsed.address) {
            bizMeta = parsed;
          }
        }
      } catch (e) {}
    }

    if (bizMeta && bizMeta.name) {
      joinWorkplace = bizMeta.name;
    }

    if (joinWorkplace) {
      const cleanWp = decodeURIComponent(joinWorkplace).trim();
      try {
        sessionStorage.setItem('feetrust_pending_invite', JSON.stringify({ 
          workplace: cleanWp,
          name: cleanWp,
          ...(bizMeta || {}),
          bizData: bizDataParam || ''
        }));
      } catch (e) {}

      setTab('signup');
      setSignUpRole('Worker');
      setSignUpWorkplace(cleanWp);

      const matchedBiz = (appState.businesses || []).find(
        b => b && b.name && b.name.toLowerCase().trim() === cleanWp.toLowerCase()
      );

      const resolvedAddress = bizMeta?.address || matchedBiz?.address || '';
      const resolvedLimit = bizMeta?.employeeLimit || matchedBiz?.employeeLimit || 4;
      const currentCount = matchedBiz?.workers?.length || 0;
      const isFull = currentCount >= resolvedLimit;

      if (resolvedAddress) setSignUpAddress(resolvedAddress);

      setInvitedBusiness({
        name: cleanWp,
        id: bizMeta?.id || matchedBiz?.id,
        address: resolvedAddress,
        limit: resolvedLimit,
        currentCount,
        isFull,
      });

      // Hydrate business into appState.businesses if not present
      if (bizMeta && !matchedBiz) {
        const newBiz: any = {
          id: bizMeta.id || ('biz_' + Math.random().toString(36).substring(2, 9)),
          name: cleanWp,
          category: bizMeta.category || 'Workplace',
          address: resolvedAddress,
          rating: Number(bizMeta.rating || 5.0),
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/${bizMeta.id}`,
          lat: bizMeta.lat,
          lng: bizMeta.lng,
          location: (bizMeta.lat && bizMeta.lng) ? { lat: bizMeta.lat, lng: bizMeta.lng } : undefined,
          plan: bizMeta.plan || 'Starter',
          employeeLimit: resolvedLimit,
          workers: [],
        };
        updateState({ businesses: [newBiz, ...(appState.businesses || [])] });
      }
    }
  }, [appState.businesses]);
  
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign Up Form State
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpRole, setSignUpRole] = useState<'Customer' | 'Worker' | 'Business'>('Customer');
  
  const authCardRef = useRef<HTMLDivElement>(null);

  const scrollToSignUp = (targetRole?: 'Customer' | 'Worker' | 'Business') => {
    if (targetRole) {
      setSignUpRole(targetRole);
    }
    setTab('signup');
    setError('');
    authCardRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Role-specific fields
  const [signUpPosition, setSignUpPosition] = useState('');
  const [signUpWorkplace, setSignUpWorkplace] = useState('');
  const [signUpAddress, setSignUpAddress] = useState('');
  const [signUpLatLng, setSignUpLatLng] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [signUpPlan, setSignUpPlan] = useState<PricingPlan>(PRICING_PLANS[0]);

  // Email Verification Modal State & Cooldown Timer
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Password reset flow
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send reset code.');
      setResetToken(json.verificationToken || '');
      setResetStep('confirm');
      toast.success(json.message || 'Reset code sent.');
      if (json.devCode) toast(`Dev code: ${json.devCode}`, { duration: 8000 });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset code.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), code: resetCode.trim(), token: resetToken || undefined, newPassword: resetNewPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reset password.');
      toast.success('Password updated. You can now sign in.');
      setShowResetModal(false);
      setResetStep('request');
      setResetCode('');
      setResetNewPassword('');
      setSignInEmail(resetEmail.trim());
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };
  const [generatedCode, setGeneratedCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [serverDevCode, setServerDevCode] = useState('');
  const [verificationToken, setVerificationToken] = useState(() => {
    try {
      return sessionStorage.getItem('feetrust_otp_token') || '';
    } catch {
      return '';
    }
  });
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const updateVerificationToken = (token: string) => {
    setVerificationToken(token);
    try {
      if (token) {
        sessionStorage.setItem('feetrust_otp_token', token);
      } else {
        sessionStorage.removeItem('feetrust_otp_token');
      }
    } catch {}
  };

  // 60-Second Resend Cooldown Timer Effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const validateEmailFormat = (email: string): boolean => {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) return false;

    const parts = cleanEmail.split('@');
    if (parts.length !== 2) return false;

    const domain = parts[1];
    const domainParts = domain.split('.');
    if (domainParts.length < 2) return false;

    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2) return false;

    const invalidDomains = ['fake', 'test', 'invalid', 'dummy', 'none', 'noemail', 'localhost'];
    if (invalidDomains.includes(domainParts[0])) return false;

    return true;
  };

  const handleDismissInvitation = () => {
    sessionStorage.removeItem('feetrust_pending_invite');
    setInvitedBusiness(null);
    toast('Staff invitation dismissed', { icon: 'ℹ️' });
  };

  const handleInitiateSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPassword.trim()) {
      setError('All fields are required for registration.');
      return;
    }

    if (!validateEmailFormat(signUpEmail)) {
      setError('Invalid Email: Please enter a valid, active email address (e.g. name@gmail.com).');
      return;
    }

    if (signUpPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (signUpRole === 'Worker' && (!signUpPosition.trim() || !signUpWorkplace.trim() || !signUpAddress.trim())) {
      setError('Position, Workplace, and Workplace Address are required for Worker registration.');
      return;
    }

    if (signUpRole === 'Worker') {
      const targetWp = signUpWorkplace.trim().toLowerCase();
      const existingBiz = (appState.businesses || []).find(
        b => b && b.name && b.name.toLowerCase().trim() === targetWp
      );
      if (existingBiz) {
        const limit = existingBiz.employeeLimit || 4;
        const currentCount = existingBiz.workers?.length || 0;
        if (currentCount >= limit) {
          setError(`Staff Limit Reached: "${existingBiz.name}" has reached its maximum staff capacity of ${limit} employees under its current plan. The business owner must upgrade their plan to invite more staff.`);
          return;
        }
      }
    }

    if (signUpRole === 'Business' && (!signUpPosition.trim() || !signUpWorkplace.trim() || !signUpAddress.trim())) {
      setError('Company Name, Category, and Workplace Address are required for Business registration.');
      return;
    }

    if (signUpRole === 'Business') {
      const targetBizName = signUpWorkplace.trim();
      const existingBiz = (appState.businesses || []).find(
        b => b && b.name && b.name.toLowerCase().trim() === targetBizName.toLowerCase()
      );

      // Only block if this business is already registered AND already claimed by another business administrator
      const isAlreadyClaimed = existingBiz && Boolean((existingBiz as any).user_id || (existingBiz as any).userId);

      if (isAlreadyClaimed) {
        setError(`Business Registration Error: "${targetBizName}" is already registered and claimed by a business administrator on FeeTrust. Please sign in to your existing account or contact support.`);
        return;
      }
    }

    const cleanSignUpEmail = signUpEmail.trim().toLowerCase();

    if (resendCooldown > 0) {
      setShowVerifyModal(true);
      toast.error(`Please wait ${resendCooldown}s before requesting another verification code.`);
      return;
    }

    setEnteredCode('');
    setVerifyError('');
    setServerDevCode('');
    updateVerificationToken('');
    setResendCooldown(60);

    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanSignUpEmail, mode: 'signup' }),
      });
const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send verification code.');
        return;
      }

      // If email delivery service is not configured on this server, register account directly
      if (data.emailDeliveryConfigured === false) {
        setLoading(true);
        try {
          await executeSignUpRegistration();
        } catch (regErr: any) {
          setError(regErr.message || 'Registration failed.');
        } finally {
          setLoading(false);
        }
        return;
      }

      if (data.verificationToken) {
        updateVerificationToken(data.verificationToken);
      }
      if (data.devCode) {
        setServerDevCode(data.devCode);
      }
      setShowVerifyModal(true);
      toast.success(`6-digit verification code sent to ${signUpEmail.trim()}!`);
    } catch (err: any) {
      // In case of offline/network failure, perform direct client registration
      setLoading(true);
      try {
        await executeSignUpRegistration();
      } catch (regErr: any) {
        setError(regErr.message || 'Registration failed.');
      } finally {
        setLoading(false);
      }
    }
  };

  const executeSignUpRegistration = async () => {
    await signupEmail(signUpEmail, signUpPassword, signUpName, signUpRole);

    let registeredBizId = '';
    let registeredBizName = '';

    if (signUpRole === 'Worker') {
      const initials = signUpName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
      let workerLat = signUpLatLng?.lat;
      let workerLng = signUpLatLng?.lng;

      if (!workerLat || !workerLng) {
        const geoPoint = await geocodeStreetAddress(signUpAddress.trim());
        workerLat = geoPoint.lat;
        workerLng = geoPoint.lng;
      }

      const workerAvatar = appState.profile.avatar || user?.photoURL || undefined;

      const wpName = signUpWorkplace.trim() || 'Workplace';
      const existingBiz = (appState.businesses || []).find(
        b => b && b.name && b.name.toLowerCase().trim() === wpName.toLowerCase()
      );

      // Exception check: did the worker register via the business manager's official invite link?
      const isInviteSignup = Boolean(
        invitedBusiness && invitedBusiness.name.toLowerCase().trim() === wpName.toLowerCase()
      );
      const targetBizId = existingBiz?.id || invitedBusiness?.id || undefined;

      const newWorkerPin = {
        id: 'worker_' + Math.random().toString(36).substring(2, 9),
        name: signUpName.trim(),
        position: signUpPosition.trim(),
        workplace: wpName,
        address: signUpAddress.trim(),
        avatar: workerAvatar,
        level: 1,
        initials,
        lat: workerLat,
        lng: workerLng,
        role: 'Worker' as const,
        isAvailable: true,
        registeredViaInvite: isInviteSignup,
        isVerifiedStaff: isInviteSignup,
        invitedByBusinessId: isInviteSignup ? targetBizId : undefined,
        businessId: isInviteSignup ? targetBizId : undefined,
      };

      let updatedBusinesses = [...(appState.businesses || [])];
      let targetBizToSave: any = null;

      if (!existingBiz) {
        const bizId = 'biz_' + Math.random().toString(36).substring(2, 9);
        const autoBusiness = {
          id: bizId,
          name: wpName,
          category: signUpPosition.trim() || 'Service Workplace',
          address: signUpAddress.trim() || 'Workplace Address',
          rating: 5.0,
          location: { lat: workerLat, lng: workerLng },
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/${bizId}`,
          workers: isInviteSignup ? [newWorkerPin] : [],
        };
        targetBizToSave = autoBusiness;
        updatedBusinesses.push(autoBusiness);
      } else if (isInviteSignup) {
        // ONLY if registered via official manager invite link, enroll into business management roster
        updatedBusinesses = updatedBusinesses.map(b => {
          if (b.id === existingBiz.id || b.name.toLowerCase().trim() === wpName.toLowerCase()) {
            const existingWorkers = b.workers || [];
            const updatedList = existingWorkers.some(w => w.name.toLowerCase() === newWorkerPin.name.toLowerCase())
              ? existingWorkers
              : [...existingWorkers, newWorkerPin];
            const updatedBiz = { ...b, workers: updatedList };
            targetBizToSave = updatedBiz;
            return updatedBiz;
          }
          return b;
        });
      }

      // Persist permanently to backend REST endpoints
      try {
        fetch('/api/workers', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(newWorkerPin),
        }).catch(() => {});

        if (targetBizToSave) {
          fetch('/api/businesses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(targetBizToSave),
          }).catch(() => {});
        }
      } catch (e) {}

      updateState({
        profile: {
          ...appState.profile,
          role: 'Worker',
          displayName: signUpName.trim(),
          position: signUpPosition.trim(),
          workplace: signUpWorkplace.trim(),
          address: signUpAddress.trim(),
          avatar: workerAvatar,
          location: { lat: workerLat, lng: workerLng },
        },
        workers: [newWorkerPin, ...appState.workers],
        businesses: updatedBusinesses
      });
    } else if (signUpRole === 'Business') {
      const targetBizName = signUpWorkplace.trim();
      let bizLat = signUpLatLng?.lat;
      let bizLng = signUpLatLng?.lng;

      if (!bizLat || !bizLng) {
        const geoPoint = await geocodeStreetAddress(signUpAddress.trim());
        bizLat = geoPoint.lat;
        bizLng = geoPoint.lng;
      }

      const existingBiz = (appState.businesses || []).find(
        b => b && b.name && b.name.toLowerCase().trim() === targetBizName.toLowerCase()
      );

      const currentSavedUser = getSavedUser();
      const bizOwnerId = currentSavedUser?.uid || user?.uid;
      const bizId = existingBiz?.id || ('biz_' + Math.random().toString(36).substring(2, 9));
      registeredBizId = bizId;
      registeredBizName = targetBizName;

      const newBusiness = {
        ...(existingBiz || {}),
        id: bizId,
        name: targetBizName,
        category: signUpPosition.trim() || existingBiz?.category || 'Service Workplace',
        address: signUpAddress.trim() || existingBiz?.address || 'Workplace Address',
        rating: existingBiz?.rating || 5.0,
        lat: bizLat,
        lng: bizLng,
        location: { lat: bizLat, lng: bizLng },
        plan: signUpPlan.name,
        planPrice: `${signUpPlan.priceFormatted} ${signUpPlan.period}`,
        employeeLimit: signUpPlan.employeeLimit,
        qrCodeUrl: existingBiz?.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/${bizId}`,
        workers: existingBiz?.workers || [],
        user_id: bizOwnerId,
        ownerEmail: signUpEmail.trim().toLowerCase(),
        hasPaid: false,
        paymentStatus: 'pending' as const,
      };

      const newBusinessPin = {
        id: bizId,
        name: targetBizName,
        position: signUpPosition.trim() || 'Workplace',
        workplace: targetBizName,
        address: signUpAddress.trim(),
        level: 5,
        initials: targetBizName.substring(0, 2).toUpperCase() || 'BZ',
        lat: bizLat,
        lng: bizLng,
        role: 'Business' as const,
        isAvailable: true,
      };

      const otherBusinesses = (appState.businesses || []).filter(
        b => b && b.id !== bizId && b.name && b.name.toLowerCase().trim() !== targetBizName.toLowerCase()
      );
      const otherWorkers = (appState.workers || []).filter(
        w => w && w.id !== bizId && w.name && w.name.toLowerCase().trim() !== targetBizName.toLowerCase()
      );

      updateState({
        profile: {
          ...appState.profile,
          role: 'Business',
          displayName: signUpName.trim(),
          position: 'Business Owner',
          workplace: targetBizName,
          address: signUpAddress.trim(),
          plan: signUpPlan.name,
          planPrice: `${signUpPlan.priceFormatted} ${signUpPlan.period}`,
          employeeLimit: signUpPlan.employeeLimit,
          location: { lat: bizLat, lng: bizLng },
          hasPaid: false,
          paymentStatus: 'pending',
        },
        businesses: [newBusiness, ...otherBusinesses],
        workers: [newBusinessPin, ...otherWorkers],
      });

      // Persist new business permanently to REST API
      fetch('/api/businesses', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newBusiness),
      }).catch(() => {});
    } else {
      updateState({
        profile: {
          ...appState.profile,
          role: 'Customer',
          displayName: signUpName.trim(),
        }
      });
    }

    markUserOnboarded(signUpEmail.trim());
    setShowVerifyModal(false);

    if (signUpRole === 'Business') {
      const planId = signUpPlan.id || 'starter';
      toast.success(`🎉 Account verified! Redirecting to secure Stripe Checkout for your ${signUpPlan.name}...`, { duration: 6000 });
      
      const origin = window.location.origin;
      await redirectToStripeCheckout({
        planId,
        businessId: registeredBizId,
        businessName: registeredBizName || signUpWorkplace.trim(),
        customerEmail: signUpEmail.trim(),
        successUrl: `${origin}/business?payment=success&plan=${planId}&registered=true`,
        cancelUrl: `${origin}/business?payment=cancelled&plan=${planId}&registered=true`,
      });
      return;
    } else {
      toast.success('Account created successfully! Welcome to FeeTrust.');
      navigate('/');
    }
  };

  const handleCompleteSignUp = async () => {
    if (!enteredCode.trim() || enteredCode.trim().length < 6) {
      setVerifyError('Please enter the full 6-digit verification code sent to your email.');
      return;
    }

    setVerifyLoading(true);
    setVerifyError('');
    setError('');

    try {
      if (signUpRole === 'Worker') {
        const targetWp = signUpWorkplace.trim().toLowerCase();
        const isInviteSignup = Boolean(
          invitedBusiness && invitedBusiness.name.toLowerCase().trim() === targetWp
        );
        const existingBiz = (appState.businesses || []).find(
          b => b && b.name && b.name.toLowerCase().trim() === targetWp
        );
        // Only manager-invited staff take an employee seat and are checked against plan capacity
        if (isInviteSignup && existingBiz) {
          const limit = existingBiz.employeeLimit || 4;
          const currentCount = existingBiz.workers?.length || 0;
          if (currentCount >= limit) {
            setVerifyError(`Staff Limit Reached: "${existingBiz.name}" has reached its maximum staff capacity of ${limit} employees under its current plan.`);
            setVerifyLoading(false);
            return;
          }
        }
      }

      // Validate 6-digit PIN with backend verification endpoint
      const verifyRes = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: signUpEmail.trim(), 
          code: enteredCode.trim(),
          token: verificationToken || undefined,
        }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.verified) {
        setVerifyError(verifyData.error || 'Incorrect 6-digit verification code. Please check your email inbox.');
        setVerifyLoading(false);
        return;
      }

      updateVerificationToken('');

      await executeSignUpRegistration();
    } catch (err: any) {
      setVerifyError(err.message || 'Sign up failed after verification.');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Load Google Identity Services script dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail.trim() || !signInPassword.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await loginEmail(signInEmail, signInPassword);
      toast.success('Signed in successfully!');
      if (res?.user?.role === 'Admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Google OAuth Redirect Token Callback (#access_token=...)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace('#', '?'));
      const accessToken = params.get('access_token');
      
      // Extract state parameter if present
      let pendingWp = '';
      let pendingRole: 'Customer' | 'Worker' | 'Business' | undefined = undefined;
      const stateParam = params.get('state');
      if (stateParam) {
        try {
          const parsedState = JSON.parse(decodeURIComponent(stateParam));
          if (parsedState.joinWorkplace) {
            pendingWp = parsedState.joinWorkplace;
            sessionStorage.setItem('feetrust_pending_invite', JSON.stringify({ workplace: pendingWp }));
          }
          if (parsedState.role && ['Customer', 'Worker', 'Business'].includes(parsedState.role)) {
            pendingRole = parsedState.role;
          }
        } catch (e) {}
      }

      if (!pendingWp) {
        try {
          const saved = sessionStorage.getItem('feetrust_pending_invite');
          if (saved) {
            const parsed = JSON.parse(saved);
            pendingWp = parsed.workplace || '';
          }
        } catch (e) {}
      }

      if (!pendingRole) {
        try {
          const savedRole = sessionStorage.getItem('feetrust_pending_role');
          if (savedRole && ['Customer', 'Worker', 'Business'].includes(savedRole)) {
            pendingRole = savedRole as any;
          }
        } catch (e) {}
      }

      if (accessToken) {
        window.location.hash = ''; // Clear hash from URL bar
        setLoading(true);
        loginGoogle({
          accessToken,
          role: pendingRole,
        })
          .then(async (authRes: any) => {
            sessionStorage.removeItem('feetrust_pending_role');
            const targetUser = authRes?.user;
            if (targetUser?.role === 'Admin') {
              toast.success(`Welcome back, Admin ${targetUser?.name || ''}!`);
              navigate('/admin', { replace: true });
              return;
            }
            const isExisting = !authRes?.isNewUser && targetUser?.email && isUserOnboarded(targetUser.email);
            if (isExisting && !pendingWp) {
              toast.success(`Welcome back, ${targetUser?.name || 'User'}!`);
              navigate('/', { replace: true });
            } else {
              toast.success(pendingWp 
                ? `Welcome! Let's join ${pendingWp} team.` 
                : `Welcome to FeeTrust! Let's set up your account.`
              );
              const targetUrl = pendingWp 
                ? `/onboarding?joinWorkplace=${encodeURIComponent(pendingWp)}` 
                : '/onboarding';
              navigate(targetUrl, { replace: true });
            }
          })
          .catch(err => {
            console.error("Google authentication error:", err);
            setError(err.message || "Google authentication failed. Please try again.");
            toast.error(err.message || "Google authentication failed.");
          })
          .finally(() => setLoading(false));
      }
    }
  }, [loginGoogle, navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const currentWp = signUpWorkplace.trim() || invitedBusiness?.name || '';
      if (currentWp) {
        try {
          sessionStorage.setItem('feetrust_pending_invite', JSON.stringify({ workplace: currentWp }));
        } catch (e) {}
      }

      const isSignUpTab = tab === 'signup';
      const roleToSend = isSignUpTab ? signUpRole : undefined;
      if (roleToSend) {
        try {
          sessionStorage.setItem('feetrust_pending_role', roleToSend);
        } catch (e) {}
      }

      const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
      const hasValidClientId = Boolean(clientId) && 
        clientId !== '123456789-example.apps.googleusercontent.com' && 
        !clientId.includes('example');

      // 1. Primary: Real Google OAuth 2.0 Web Redirect (accounts.google.com)
      if (hasValidClientId) {
        const redirectUri = window.location.origin + '/auth';
        const statePayloadObj: any = {};
        if (currentWp) statePayloadObj.joinWorkplace = currentWp;
        if (roleToSend) statePayloadObj.role = roleToSend;
        const statePayload = Object.keys(statePayloadObj).length > 0
          ? encodeURIComponent(JSON.stringify(statePayloadObj))
          : '';

        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=token&` +
          `scope=${encodeURIComponent('openid email profile')}&` +
          (statePayload ? `state=${statePayload}&` : '') +
          `prompt=select_account`;
        window.location.href = googleAuthUrl;
        return;
      }

      // 2. Google Identity Services Popup Fallback
      if ((window as any).google?.accounts?.id && hasValidClientId) {
        (window as any).google.accounts.id.prompt();
        setLoading(false);
        return;
      }

      // 3. Fallback: Show informative notification instead of insecure prompt
      setLoading(false);
      toast.error("Google Sign-In is unavailable. Please sign in with your email and password.");
      setError("Google OAuth is not configured on this environment. Please use Email & Password to sign in or create an account.");
    } catch (err: any) {
      setError(err.message || 'Google Account sign-in failed.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090a0f] flex flex-col items-center py-10 px-4 sm:px-6 text-slate-900 dark:text-slate-100 font-['Outfit',sans-serif] transition-colors relative selection:bg-indigo-500 selection:text-white">
      <Toaster position="top-center" toastOptions={{ className: 'bg-slate-900 text-white border border-slate-800 shadow-xl' }} />
      <div ref={authCardRef} id="auth-card" className="w-full max-w-md flex flex-col items-center">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src="/logo.png" alt="Feetrust Logo" className="h-14 w-auto max-w-60 object-contain mb-3 transition-all filter dark:drop-shadow-[0_0_16px_rgba(59,130,246,0.35)] hover:scale-105" />
          <p className="text-slate-600 dark:text-slate-400 text-base font-medium">Verified Merit & Digital Vault</p>
        </div>

        <div className="w-full bg-white dark:bg-slate-900/90 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-md">
          {/* Active Workplace Staff Invite Banner */}
          {invitedBusiness && (
            <div className="mb-6 p-4 rounded-2xl bg-linear-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-between space-x-3.5 shadow-xs">
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Building className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1.5 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1" /> Staff Invitation
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                      invitedBusiness.isFull 
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300' 
                        : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {invitedBusiness.isFull ? 'Limit Reached' : `Spot ${invitedBusiness.currentCount + 1}/${invitedBusiness.limit}`}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                    Join {invitedBusiness.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {invitedBusiness.address || 'Verified FeeTrust Workplace'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissInvitation}
                className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-xs font-semibold shrink-0 cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50"
                title="Decline staff invitation"
              >
                ✕ Decline
              </button>
            </div>
          )}

          {/* Tab Selection Header */}
          <div className="flex justify-center mb-6 border-b border-slate-200 dark:border-slate-800 pb-3 space-x-6">
            <button
              onClick={() => { setTab('signin'); setError(''); }}
              className={`text-lg font-bold transition-colors pb-2 cursor-pointer ${
                tab === 'signin' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Sign In
            </button>

            <button
              onClick={() => { setTab('signup'); setError(''); }}
              className={`text-lg font-bold transition-colors pb-2 cursor-pointer ${
                tab === 'signup' ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 rounded-xl mb-4 text-center animate-in fade-in">
              {error}
            </div>
          )}

          {/* SIGN IN FORM */}
          {tab === 'signin' && (
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1 font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={signInEmail}
                    onChange={e => setSignInEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1 font-medium">Password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={signInPassword}
                    onChange={e => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-12 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl flex items-center justify-center hover:opacity-95 transition-opacity disabled:opacity-50 mt-4 shadow-md cursor-pointer"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <LogIn className="w-5 h-5 mr-2" />}
                Sign In
              </button>

              <button
                type="button"
                onClick={() => { setResetEmail(signInEmail); setResetStep('request'); setShowResetModal(true); }}
                className="w-full text-center text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {tab === 'signup' && (
            <form onSubmit={handleInitiateSignUp} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1 font-medium">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={signUpName}
                    onChange={e => setSignUpName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1 font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={signUpEmail}
                    onChange={e => setSignUpEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1 font-medium">Password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={signUpPassword}
                    onChange={e => setSignUpPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-12 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm text-slate-700 mb-2 font-medium">Select Account Role</label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSignUpRole('Customer')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center text-xs font-bold cursor-pointer transition-all ${
                      signUpRole === 'Customer' ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-xs scale-[1.02]' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Store className="w-5 h-5 mb-1 text-amber-600" /> Customer
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignUpRole('Worker')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center text-xs font-bold cursor-pointer transition-all ${
                      signUpRole === 'Worker' ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-xs scale-[1.02]' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Award className="w-5 h-5 mb-1 text-indigo-600" /> Worker
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignUpRole('Business')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center text-xs font-bold cursor-pointer transition-all ${
                      signUpRole === 'Business' ? 'bg-rose-50 border-rose-400 text-rose-900 shadow-xs scale-[1.02]' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Building className="w-5 h-5 mb-1 text-rose-600" /> Business
                  </button>
                </div>
              </div>

              {/* DYNAMIC ROLE-SPECIFIC QUESTIONS */}
              {signUpRole === 'Worker' && (
                <div className="space-y-4 pt-2 border-t border-slate-200 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Worker Details</p>
                    {invitedBusiness && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        invitedBusiness.isFull
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}>
                        {invitedBusiness.isFull ? 'Team Capacity Full' : `Spot ${invitedBusiness.currentCount + 1} of ${invitedBusiness.limit}`}
                      </span>
                    )}
                  </div>

                  {invitedBusiness && (
                    <div className={`p-3.5 rounded-2xl border text-xs ${
                      invitedBusiness.isFull
                        ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300'
                    }`}>
                      <div className="font-extrabold flex items-center mb-0.5">
                        <span className="mr-1.5">{invitedBusiness.isFull ? '⚠️' : '🎉'}</span>
                        {invitedBusiness.isFull 
                          ? `Capacity Reached for ${invitedBusiness.name}`
                          : `Invited to join ${invitedBusiness.name}`}
                      </div>
                      <p className="text-[11px] opacity-90">
                        {invitedBusiness.isFull
                          ? `This workplace has reached its plan capacity of ${invitedBusiness.limit} employees. The business owner must upgrade to invite additional team members.`
                          : `You are claiming 1 of ${invitedBusiness.limit} employee spots under ${invitedBusiness.name}.`}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-slate-700 mb-1 font-medium">Job Title / Position</label>
                    <div className="relative">
                      <Award className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-indigo-600" />
                      <input
                        type="text"
                        required
                        value={signUpPosition}
                        onChange={e => setSignUpPosition(e.target.value)}
                        placeholder="e.g. Senior Barista, Hair Stylist, Server"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 mb-1 font-medium">Current Workplace</label>
                    <div className="relative">
                      <Building className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-indigo-600" />
                      <input
                        type="text"
                        required
                        value={signUpWorkplace}
                        onChange={e => setSignUpWorkplace(e.target.value)}
                        placeholder="e.g. Caputo's Super Market, Target"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 mb-1 font-medium">Workplace Street Address</label>
                    <AddressAutocompleteInput
                      value={signUpAddress}
                      onChange={(val, latLng) => {
                        setSignUpAddress(val);
                        if (latLng) setSignUpLatLng(latLng);
                      }}
                      placeholder="Start typing street address (e.g. 14100 Weber Dr...)"
                      required
                    />
                    <p className="text-[11px] text-indigo-600 font-semibold mt-1 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1 text-indigo-600" /> Autocompletes addresses & pinpoints your workplace on the map!
                    </p>
                  </div>
                </div>
              )}

              {signUpRole === 'Business' && (
                <div className="space-y-4 pt-2 border-t border-slate-200 animate-in fade-in duration-300">
                  <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">Business Details</p>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1 font-medium">Business / Company Name</label>
                    <div className="relative">
                      <Building className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-rose-600" />
                      <input
                        type="text"
                        required
                        value={signUpWorkplace}
                        onChange={e => setSignUpWorkplace(e.target.value)}
                        placeholder="e.g. Apex Coffee Roasters LLC"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 mb-1 font-medium">Industry Category</label>
                    <div className="relative">
                      <Briefcase className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-rose-600" />
                      <input
                        type="text"
                        required
                        value={signUpPosition}
                        onChange={e => setSignUpPosition(e.target.value)}
                        placeholder="e.g. Food & Beverage, Hospitality, Retail"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 mb-1 font-medium">Business Workplace Street Address</label>
                    <AddressAutocompleteInput
                      value={signUpAddress}
                      onChange={(val, latLng) => {
                        setSignUpAddress(val);
                        if (latLng) setSignUpLatLng(latLng);
                      }}
                      placeholder="Start typing street address (e.g. 100 S State St...)"
                      required
                    />
                    <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1 text-rose-600" /> Autocompletes address & places your business pin on the map!
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-200">
                    <PricingPlansSelector
                      selectedPlanId={signUpPlan.id}
                      onSelectPlan={setSignUpPlan}
                      compact
                    />
                  </div>
                </div>
              )}



              {/* Explicit Role Confirmation Badge */}
              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Registering account as:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  {signUpRole === 'Business' && <Building className="w-3.5 h-3.5 text-indigo-500" />}
                  {signUpRole === 'Worker' && <Briefcase className="w-3.5 h-3.5 text-blue-500" />}
                  {signUpRole === 'Customer' && <UserIcon className="w-3.5 h-3.5 text-amber-500" />}
                  {signUpRole === 'Business' ? 'Business Workplace' : signUpRole === 'Worker' ? 'Service Professional' : 'Customer / Reviewer'}
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl flex items-center justify-center hover:opacity-95 transition-opacity disabled:opacity-50 mt-4 shadow-md cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : signUpRole === 'Business' ? (
                  <CreditCard className="w-5 h-5 mr-2" />
                ) : (
                  <UserPlus className="w-5 h-5 mr-2" />
                )}
                {signUpRole === 'Business'
                  ? `Create Account & Proceed to Stripe (${signUpPlan.priceFormatted}${signUpPlan.period})`
                  : `Create ${signUpRole === 'Worker' ? 'Worker' : 'Customer'} Account`}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-mono font-bold tracking-widest">OR</span>
            </div>
          </div>

          {/* GOOGLE SIGN IN BUTTON */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer disabled:opacity-50 border border-slate-700/50"
          >
            <svg className="w-5 h-5 mr-3 shrink-0" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            <span>{tab === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
          </button>

          {/* Legal Consent Disclaimer */}
          <p className="text-[11px] text-center text-slate-400 mt-4 leading-relaxed">
            By signing in or creating an account, you agree to FeeTrust's{' '}
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="text-indigo-600 font-semibold underline hover:text-indigo-800 cursor-pointer"
            >
              Terms of Service
            </button>{' '}
            and{' '}
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="text-indigo-600 font-semibold underline hover:text-indigo-800 cursor-pointer"
            >
              Privacy Policy
            </button>
            .
          </p>
        </div>

        {/* Customer Support Footer Box */}
        <div className="mt-6 text-center space-y-2 flex flex-col items-center">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
            <Headphones className="w-3.5 h-3.5 text-indigo-600" />
            <span>Customer Support</span>
          </div>
          <div className="flex items-center justify-center space-x-2 text-xs font-bold text-slate-700">
            <a 
              href="mailto:jm@feetrust.com" 
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-linear-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:border-transparent transition-all duration-200 shadow-xs group font-mono"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-600 group-hover:text-white transition-colors" />
              <span>jm@feetrust.com</span>
            </a>
          </div>
        </div>
        {/* Scroll Prompt */}
        <button
          type="button"
          onClick={() => {
            document.getElementById('about-feetrust')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="mt-6 flex flex-col items-center space-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer group"
          aria-label="Scroll down to learn more about FeeTrust"
        >
          <span className="tracking-wide">Explore how FeeTrust works</span>
          <ChevronDown className="w-4 h-4 animate-bounce group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>

      {/* SEMI LANDING PAGE SECTION UNDER THE LOGIN */}
      <section
        id="about-feetrust"
        className="w-full max-w-4xl mt-14 pt-14 pb-16 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center text-center animate-in fade-in duration-500 scroll-mt-6"
      >
        {/* Eyebrow badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold tracking-wide uppercase shadow-xs mb-4">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Verified Merit & Reputation Ecosystem</span>
        </div>

        {/* Headline */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight max-w-2xl leading-tight mb-4">
          Turn Real Frontline Excellence Into{' '}
          <span className="bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Portable Career Value
          </span>
        </h2>

        {/* Core Explanatory Paragraph */}
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed mb-10">
          FeeTrust is a verified merit network that empowers service workers by turning in-person customer recognition into portable, authenticated reputation. Customers scan countertop QR codes to commend outstanding service instantly, specialists build a digital Merit Passport that stays with them throughout their career, and establishments build trust and loyalty with verified team recognition.
        </p>

        {/* 3 Pillars Grid (Customer, Worker, Business) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          {/* Pillar 1: For Customers */}
          <div className="bg-white dark:bg-slate-900/80 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700/50 transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md mb-4 group-hover:scale-105 transition-transform">
                <QrCode className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                For Customers
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Scan, Acknowledge & Earn
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Scan countertop QR codes at your favorite restaurants, cafés, and salons. Commend outstanding servers and stylists with verified merits and earn redeemable gems.
              </p>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 mb-6">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>1-tap instant counter QR recognition</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Earn redeemable gems on verified visits</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Direct gratitude to frontline specialists</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => navigate('/map')}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold text-xs hover:bg-amber-500 hover:text-white hover:border-transparent transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Explore Verified Workplaces</span>
            </button>
          </div>

          {/* Pillar 2: For Service Workers */}
          <div className="bg-white dark:bg-slate-900/80 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/50 transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md mb-4 group-hover:scale-105 transition-transform">
                <Award className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
                For Service Workers
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Own Your Merit Passport
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Your hard work stays with you forever. Build an authenticated digital track record from Level 1 to 10 that moves with you wherever your career leads.
              </p>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 mb-6">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Portable reputation across all jobs</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Level 1 to 10 Merit progression</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Manager-verified workplace status</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => scrollToSignUp('Worker')}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-bold text-xs hover:bg-indigo-600 hover:text-white hover:border-transparent transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Join as Service Worker</span>
            </button>
          </div>

          {/* Pillar 3: For Businesses */}
          <div className="bg-white dark:bg-slate-900/80 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700/50 transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md mb-4 group-hover:scale-105 transition-transform">
                <Building className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                For Workplaces
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Motivate & Retain Talent
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Display countertop QR posters, motivate your staff with real-time recognition analytics, and feature your establishment on the verified city map.
              </p>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 mb-6">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Countertop QR posters & display kits</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Real-time team recognition dashboard</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Priority pin on Chicago city map</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => scrollToSignUp('Business')}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold text-xs hover:bg-emerald-600 hover:text-white hover:border-transparent transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Register Your Workplace</span>
            </button>
          </div>
        </div>

        {/* 4 Trust & Integrity Points */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-10 text-left">
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
            <div className="flex items-center space-x-2 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Anti-Fraud Proof</h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Only real patrons at physical venues can submit verified merit ratings.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
            <div className="flex items-center space-x-2 mb-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Level Progression</h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Level 1 to 10 progression badges reward consistent top-tier service.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
            <div className="flex items-center space-x-2 mb-1.5">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Worker-Owned</h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Your merit record is yours forever, not tied to any single employer.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
            <div className="flex items-center space-x-2 mb-1.5">
              <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Citywide Trust</h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Discover verified hospitality and service venues on our live map.
            </p>
          </div>
        </div>

        {/* Bottom Callout Banner */}
        <div className="w-full mt-10 p-6 sm:p-8 rounded-3xl bg-linear-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-indigo-200/80 dark:border-indigo-800/80 flex flex-col sm:flex-row items-center justify-between gap-6 text-left shadow-xs">
          <div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-1">
              Ready to experience verified merit?
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create your free FeeTrust account or explore the workplace map in Chicago.
            </p>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <button
              type="button"
              onClick={() => scrollToSignUp()}
              className="py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer flex items-center space-x-2"
            >
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/map')}
              className="py-3 px-5 rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              View Map
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
          <p>© {new Date().getFullYear()} FeeTrust Inc. Chicago, IL • Verified Merit & Digital Vault</p>
          <div className="flex items-center justify-center space-x-4">
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 underline transition-colors cursor-pointer"
            >
              Privacy Policy & Terms
            </button>
            <span>•</span>
            <a
              href="mailto:jm@feetrust.com"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 underline transition-colors"
            >
              jm@feetrust.com
            </a>
          </div>
        </div>
      </section>

      {/* Privacy Policy & Terms Modal */}
      <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />

      {/* PASSWORD RESET MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">
                {resetStep === 'request' ? 'Reset your password' : 'Enter your reset code'}
              </h3>
              <button
                onClick={() => setShowResetModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {resetStep === 'request' ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <p className="text-xs text-slate-500">
                  Enter the email address on your account and we'll send a 6-digit reset code.
                </p>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-600"
                />
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send reset code
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <p className="text-xs text-slate-500">
                  Enter the 6-digit code sent to <strong>{resetEmail}</strong> and choose a new password.
                </p>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center tracking-[0.4em] font-mono text-lg text-slate-900 focus:outline-none focus:border-indigo-600"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetNewPassword}
                  onChange={e => setResetNewPassword(e.target.value)}
                  placeholder="New password (min 6 characters)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-600"
                />
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-linear-to-r from-emerald-600 to-emerald-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Set new password
                </button>
                <button
                  type="button"
                  onClick={() => setResetStep('request')}
                  className="w-full text-center text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  Use a different email
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {showVerifyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in duration-300 relative text-center font-['Outfit',sans-serif]">
            
            <div className="w-16 h-16 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Mail className="w-8 h-8 text-indigo-600" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Verify Your Email</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              We sent a 6-digit verification code to <span className="font-bold text-slate-900">{signUpEmail}</span>. Enter the code below to complete your registration.
            </p>

            {/* Verification Code Box */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Enter 6-Digit Confirmation PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={enteredCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setEnteredCode(val);
                    setVerifyError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && enteredCode.trim().length === 6 && !verifyLoading) {
                      e.preventDefault();
                      handleCompleteSignUp();
                    }
                  }}
                  placeholder="e.g. 584910"
                  className="w-full bg-slate-50 border-2 border-indigo-200 rounded-2xl py-3.5 px-4 text-center font-mono text-2xl font-extrabold tracking-[0.5em] text-indigo-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                />
              </div>

              {/* Dev Helper Code Display when SMTP key is missing in local dev */}
              {Boolean((import.meta as any).env?.DEV) && serverDevCode && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-center animate-in fade-in">
                  <div className="flex items-center justify-center space-x-2 text-amber-900 font-mono font-bold text-xs mb-1">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Verification Code:</span>
                    <span className="bg-amber-200/90 text-amber-950 px-2.5 py-0.5 rounded-lg font-black text-base tracking-widest">{serverDevCode}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Enter the code above to verify. (Add <code className="bg-amber-200/50 px-1 rounded font-bold text-amber-950">RESEND_API_KEY</code> in Vercel for direct inbox emails)
                  </p>
                </div>
              )}

              {verifyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold animate-in fade-in">
                  {verifyError}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleCompleteSignUp}
                disabled={verifyLoading || enteredCode.length < 6}
                className="w-full py-4 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center shadow-md hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {verifyLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                Confirm & Create Account
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={async () => {
                    if (resendCooldown > 0) return;
                    setEnteredCode('');
                    setVerifyError('');
                    setServerDevCode('');
                    updateVerificationToken('');
                    setResendCooldown(60);
                    try {
                      const res = await fetch('/api/auth/send-verification-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: signUpEmail.trim(), mode: 'signup' }),
                      });
                      const data = await res.json();
                      if (data.verificationToken) updateVerificationToken(data.verificationToken);
                      if (data.devCode) setServerDevCode(data.devCode);
                      toast.success(`Fresh verification code sent to ${signUpEmail.trim()}!`);
                    } catch (e) {
                      toast.success(`Fresh verification code sent to ${signUpEmail.trim()}!`);
                    }
                  }}
                  className={`font-bold transition-colors ${
                    resendCooldown > 0 
                      ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                      : 'text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer'
                  }`}
                >
                  {resendCooldown > 0 ? (
                    <span className="flex items-center text-amber-600 dark:text-amber-400 font-mono">
                      <Clock className="w-3.5 h-3.5 mr-1 animate-pulse" /> Resend code ({resendCooldown}s)
                    </span>
                  ) : (
                    'Resend Verification Code'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

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
