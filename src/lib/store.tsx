import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, getSavedUser, getSavedToken, setAuthSession, clearAuthSession, apiLogin, apiSignUp, apiGoogleSignIn, apiUpdateRole, DEFAULT_USER, isUserOnboarded, markUserOnboarded } from './auth';
import { cacheWorkersAndBusinesses, loadCachedWorkersAndBusinesses } from './offlineCache';
import { authHeaders } from './api';

export interface Review {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  meritType: string;
  tipAmount: number;
  reviewText: string;
  createdAt: string;
}

export interface WorkerProfile {
  id: string;
  name: string;
  position: string;
  level: number;
  initials: string;
  lat: number;
  lng: number;
  role: string;
  isAvailable: boolean;
  category?: string;
  workplace?: string;
  address?: string;
  avatar?: string;
  merits?: number;
  meritsReceived?: number;
  rating?: number;
  registeredViaInvite?: boolean;
  invitedByBusinessId?: string;
  businessId?: string;
  isVerifiedStaff?: boolean;
  rosterStatus?: 'pending' | 'active';
}

/**
 * Checks if a worker is officially affiliated with a business (manager-invited/verified)
 * to be displayed on the business owner's private management dashboard roster.
 */
export function isWorkerManagerAffiliated(worker?: WorkerProfile | null, business?: BusinessProfile | null): boolean {
  if (!worker || !business) return false;
  if (worker.role === 'Business' || worker.id === business.id) return false;
  
  const cleanBizName = (business.name || '').toLowerCase().trim();
  const workerWp = (worker.workplace || '').toLowerCase().trim();
  
  // 1. Explicitly present in the business's official workers array
  const inOfficialRoster = (business.workers || []).some(
    bw => bw && (bw.id === worker.id || (bw.name && worker.name && bw.name.toLowerCase().trim() === worker.name.toLowerCase().trim()))
  );
  if (inOfficialRoster) return true;

  // 2. Explicit manager invite linkage by business ID
  if (worker.invitedByBusinessId && worker.invitedByBusinessId === business.id) return true;
  if (worker.businessId && worker.businessId === business.id) return true;

  // 3. Registered via invite with matching workplace name
  if ((worker.registeredViaInvite || worker.isVerifiedStaff) && workerWp && workerWp === cleanBizName) {
    return true;
  }

  return false;
}

export interface BusinessProfile {
  id: string;
  name: string;
  category: string;
  address: string;
  rating: number;
  qrCodeUrl: string;
  workers?: WorkerProfile[];
  avatar?: string;
  lat?: number;
  lng?: number;
  location?: { lat: number; lng: number };
  plan?: string;
  planPrice?: string;
  employeeLimit?: number;
  user_id?: string;
  ownerEmail?: string;
  hasPaid?: boolean;
  paymentStatus?: 'paid' | 'pending' | 'cancelled';
}

export interface ActivityFeedItem {
  id: string;
  fromUserName: string;
  toWorkerName: string;
  businessName: string;
  meritType: string;
  tipAmount: number;
  timeAgo: string;
  reviewId?: string;
  createdAt?: string;
}

export interface ThankYouNote {
  id: string;
  reviewId: string;
  fromWorkerName: string;
  toUserName: string;
  message: string;
  createdAt: string;
}

export interface AppState {
  profile: any;
  merits: any[];
  contacts: any[];
  reviews: Review[];
  workers: WorkerProfile[];
  businesses: BusinessProfile[];
  activityFeed: ActivityFeedItem[];
  thankYouNotes: ThankYouNote[];
}

const DEFAULT_WORKERS: WorkerProfile[] = [];

const DEFAULT_BUSINESSES: BusinessProfile[] = [];

const DEFAULT_ACTIVITY: ActivityFeedItem[] = [];

const STORAGE_KEY_STATE = 'feetrust_app_state';

interface StoreContextType {
  user: User | null;
  token: string | null;
  needsAuth: boolean;
  appState: AppState;
  loginEmail: (e: string, p: string) => Promise<any>;
  signupEmail: (e: string, p: string, name: string, role?: 'Customer' | 'Worker' | 'Business') => Promise<void>;
  loginGoogle: (payload?: {
    credential?: string;
    accessToken?: string;
    email?: string;
    name?: string;
    photoURL?: string;
    role?: 'Customer' | 'Worker' | 'Business';
  }) => Promise<any>;
  signOut: () => void;
  updateState: (newState: Partial<AppState>) => void;
  addReview: (review: Omit<Review, 'id' | 'createdAt'>) => Promise<void>;
  switchRole: (role: 'Customer' | 'Worker' | 'Business') => void;
  addThankYouNote: (reviewId: string, message: string) => Promise<void>;
  updateWorkerAvailability: (workerId: string, isAvailable: boolean) => Promise<void>;
  deleteBusiness: (id: string) => Promise<void>;
  deleteWorker: (id: string) => Promise<void>;
  removeWorkerFromBusiness: (bizId: string, workerId: string) => Promise<void>;
  approveWorkerToRoster: (bizId: string, workerId: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

const isRealBusiness = (b: BusinessProfile) => {
  if (!b || !b.name || typeof b.name !== 'string') return false;
  const lower = b.name.toLowerCase();
  return !lower.includes('blue bottle') && !lower.includes('intelligentsia') && !(b.id && typeof b.id === 'string' && b.id.includes('demo_'));
};

const isRealWorker = (w: WorkerProfile) => {
  if (!w || !w.name || typeof w.name !== 'string') return false;
  const lower = w.name.toLowerCase();
  const wpLower = (w.workplace || '').toLowerCase();
  return !wpLower.includes('blue bottle') && !wpLower.includes('intelligentsia') && !(w.id && typeof w.id === 'string' && w.id.includes('demo_'));
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getSavedUser());
  const [token, setToken] = useState<string | null>(() => getSavedToken());
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getSavedUser() || !getSavedToken());

  const tombstonesRef = useRef<Set<string>>(new Set());
  const optimisticCreationsRef = useRef<Map<string, number>>(new Map());

  const [appState, setAppState] = useState<AppState>(() => {
    const savedUser = getSavedUser();
    const defaultProfile = {
      role: savedUser?.role || 'Customer',
      displayName: savedUser?.name || 'User',
      email: savedUser?.email || '',
      avatar: savedUser?.photoURL || null,
      position: savedUser?.role === 'Worker' ? 'Staff Member' : savedUser?.role === 'Business' ? 'Business Owner' : 'Customer',
      workplace: '',
      level: 1,
      gems: 0,
      meritsGiven: 0,
      meritsReceived: 0,
      isAvailable: true,
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATE);
      if (saved) {
        const parsed = JSON.parse(saved);
        const cleanedWorkers = Array.isArray(parsed?.workers) ? parsed.workers.filter(isRealWorker) : [];
        const cleanedBusinesses = Array.isArray(parsed?.businesses) ? parsed.businesses.filter(isRealBusiness) : [];

        return {
          profile: { ...defaultProfile, ...(parsed?.profile || {}) },
          merits: Array.isArray(parsed?.merits) ? parsed.merits : [],
          contacts: Array.isArray(parsed?.contacts) ? parsed.contacts : [],
          reviews: Array.isArray(parsed?.reviews) ? parsed.reviews : [],
          workers: cleanedWorkers,
          businesses: cleanedBusinesses,
          activityFeed: Array.isArray(parsed?.activityFeed) ? parsed.activityFeed.filter((a: any) => !(a?.businessName || '').toLowerCase().includes('blue bottle')) : [],
          thankYouNotes: Array.isArray(parsed?.thankYouNotes) ? parsed.thankYouNotes : [],
        };
      }
    } catch (e) {}

    return {
      profile: defaultProfile,
      merits: [],
      contacts: [],
      reviews: [],
      workers: [],
      businesses: [],
      activityFeed: [],
      thankYouNotes: [],
    };
  });

  // 1. Full LocalStorage & Offline Cache Persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(appState));
      cacheWorkersAndBusinesses(appState.workers, appState.businesses);
    } catch (e) {}
  }, [appState]);

  // 2. Cross-Tab Real-Time Synchronization Listener
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_STATE && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            setAppState(prev => ({
              ...prev,
              ...parsed,
              workers: Array.isArray(parsed.workers) ? parsed.workers.filter(isRealWorker) : prev.workers,
              businesses: Array.isArray(parsed.businesses) ? parsed.businesses.filter(isRealBusiness) : prev.businesses,
            }));
          }
        } catch (err) {}
      } else if (e.key === 'feetrust_auth_user') {
        const newUser = getSavedUser();
        const newToken = getSavedToken();
        setUser(newUser);
        setToken(newToken);
        setNeedsAuth(!newUser || !newToken);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 3. Initial Cache Load
  useEffect(() => {
    loadCachedWorkersAndBusinesses().then(({ workers, businesses }) => {
      const cleanedWorkers = Array.isArray(workers) ? workers.filter(isRealWorker) : [];
      const cleanedBusinesses = Array.isArray(businesses) ? businesses.filter(isRealBusiness) : [];

      if (cleanedWorkers.length > 0 || cleanedBusinesses.length > 0) {
        setAppState(prev => ({
          ...prev,
          workers: (prev.workers && prev.workers.length > 0) ? prev.workers.filter(isRealWorker) : cleanedWorkers,
          businesses: (prev.businesses && prev.businesses.length > 0) ? prev.businesses.filter(isRealBusiness) : cleanedBusinesses,
        }));
      }
    });
  }, []);

  // 4. Live REST API Synchronization across devices (Vercel Native)
  useEffect(() => {
    let isMounted = true;

    const fetchRemoteData = async () => {
      try {
        const [bRes, wRes, rRes, aRes, nRes] = await Promise.all([
          fetch('/api/businesses').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/workers').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/reviews').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/activity').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/reviews/notes').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);

        if (!isMounted) return;

        const now = Date.now();
        for (const [id, time] of optimisticCreationsRef.current.entries()) {
          if (now - time > 15000) {
            optimisticCreationsRef.current.delete(id);
          }
        }

        const hasValidBusinesses = Array.isArray(bRes) || (bRes && Array.isArray(bRes.businesses));
        const hasValidWorkers = Array.isArray(wRes) || (wRes && Array.isArray(wRes.workers));
        const hasValidReviews = Array.isArray(rRes) || (rRes && Array.isArray(rRes.reviews));
        const hasValidActivity = Array.isArray(aRes) || (aRes && Array.isArray(aRes.activityFeed));
        const hasValidNotes = Array.isArray(nRes) || (nRes && Array.isArray(nRes.thankYouNotes));

        const incomingBusinesses: BusinessProfile[] = hasValidBusinesses
          ? (Array.isArray(bRes) ? bRes : (bRes?.businesses || [])).filter(b => isRealBusiness(b) && !tombstonesRef.current.has(b.id))
          : [];

        const incomingWorkers: WorkerProfile[] = hasValidWorkers
          ? (Array.isArray(wRes) ? wRes : (wRes?.workers || [])).filter(w => isRealWorker(w) && !tombstonesRef.current.has(w.id))
          : [];

        const incomingReviews: Review[] = hasValidReviews
          ? (Array.isArray(rRes) ? rRes : (rRes?.reviews || []))
          : [];

        const incomingActivity: ActivityFeedItem[] = hasValidActivity
          ? (Array.isArray(aRes) ? aRes : (aRes?.activityFeed || []))
          : [];

        const incomingNotes: ThankYouNote[] = hasValidNotes
          ? (Array.isArray(nRes) ? nRes : (nRes?.thankYouNotes || []))
          : [];

        setAppState(prev => {
          let hasChanges = false;

          // 1. Reconcile Businesses (server list is authoritative + retain local creations & teams)
          let updatedBusinesses: BusinessProfile[] = [];
          if (hasValidBusinesses && incomingBusinesses.length > 0) {
            for (const b of incomingBusinesses) {
              if (!b || !b.name) continue;
              const cleanBizWorkers = (b.workers || []).map(w => {
                const freshWorker = incomingWorkers.find(iw => iw.id === w.id || (iw.name && w.name && iw.name.toLowerCase().trim() === w.name.toLowerCase().trim()));
                return freshWorker ? { ...w, ...freshWorker, avatar: freshWorker.avatar || w.avatar } : w;
              }).filter(w => isRealWorker(w) && !tombstonesRef.current.has(w.id));
              updatedBusinesses.push({
                ...b,
                workers: cleanBizWorkers,
              });
            }

            // Retain ONLY pending optimistic creations that the server has not acknowledged yet.
            // Anything else absent from the authoritative server list was deleted and must NOT
            // be resurrected locally (this previously made deleted businesses/workers reappear).
            for (const pb of prev.businesses) {
              if (pb && pb.id && !tombstonesRef.current.has(pb.id)) {
                const existingInUpdated = updatedBusinesses.find(ub => ub.id === pb.id || (ub.name && pb.name && ub.name.toLowerCase().trim() === pb.name.toLowerCase().trim()));
                if (!existingInUpdated) {
                  const createdAt = optimisticCreationsRef.current.get(pb.id);
                  const stillPending = typeof createdAt === 'number' && (now - createdAt) < 15000;
                  if (stillPending) updatedBusinesses.unshift(pb);
                } else {
                  // Merge any local worker pins attached to this business that server might not have yet
                  const existingWorkerIds = new Set((existingInUpdated.workers || []).map(w => w.id));
                  for (const pw of (pb.workers || [])) {
                    if (pw && pw.id && !existingWorkerIds.has(pw.id) && !tombstonesRef.current.has(pw.id)) {
                      const fresh = incomingWorkers.find(iw => iw.id === pw.id || (iw.name && pw.name && iw.name.toLowerCase().trim() === pw.name.toLowerCase().trim()));
                      existingInUpdated.workers = [...(existingInUpdated.workers || []), fresh ? { ...pw, ...fresh, avatar: fresh.avatar || pw.avatar } : pw];
                    }
                  }
                }
              }
            }
          } else {
            updatedBusinesses = [...prev.businesses];
          }

          if (JSON.stringify(updatedBusinesses) !== JSON.stringify(prev.businesses)) {
            hasChanges = true;
          }

          // 2. Reconcile Workers (server list is authoritative + retain local additions)
          let updatedWorkers: WorkerProfile[] = [];
          if (hasValidWorkers && incomingWorkers.length > 0) {
            updatedWorkers = [...incomingWorkers];
            for (const pw of prev.workers) {
              if (pw && pw.id && !tombstonesRef.current.has(pw.id) && !updatedWorkers.some(uw => uw.id === pw.id)) {
                // Only keep a worker the server hasn't acknowledged yet if it is a recent
                // pending creation — otherwise it was deleted on the server.
                const createdAt = optimisticCreationsRef.current.get(pw.id);
                const stillPending = typeof createdAt === 'number' && (now - createdAt) < 15000;
                if (stillPending) updatedWorkers.unshift(pw);
              }
            }
          } else {
            updatedWorkers = [...prev.workers];
          }

          if (JSON.stringify(updatedWorkers) !== JSON.stringify(prev.workers)) {
            hasChanges = true;
          }

          // 3. Reconcile Reviews without clobbering optimistic additions
          let updatedReviews = [...prev.reviews];
          for (const ir of incomingReviews) {
            if (!ir || !ir.id) continue;
            const idx = updatedReviews.findIndex(r => r.id === ir.id);
            if (idx === -1) {
              const isRecentMatch = updatedReviews.some(
                r => r.fromUserId === ir.fromUserId && r.toUserId === ir.toUserId && Math.abs(new Date(r.createdAt).getTime() - new Date(ir.createdAt).getTime()) < 3000
              );
              if (!isRecentMatch) {
                updatedReviews.unshift(ir);
                hasChanges = true;
              }
            }
          }

          // 4. Reconcile Activity Feed
          let updatedActivity = [...prev.activityFeed];
          for (const ia of incomingActivity) {
            if (!ia || !ia.id) continue;
            if (!updatedActivity.some(a => a.id === ia.id)) {
              updatedActivity.unshift(ia);
              hasChanges = true;
            }
          }

          // 5. Reconcile Thank You Notes
          let updatedNotes = [...prev.thankYouNotes];
          for (const inote of incomingNotes) {
            if (!inote || !inote.id) continue;
            if (!updatedNotes.some(n => n.id === inote.id)) {
              updatedNotes.unshift(inote);
              hasChanges = true;
            }
          }

          // If no state divergence detected, maintain object reference to prevent component re-render thrashing
          if (!hasChanges) {
            return prev;
          }

          return {
            ...prev,
            businesses: updatedBusinesses.filter(isRealBusiness),
            workers: updatedWorkers.filter(isRealWorker),
            reviews: updatedReviews,
            activityFeed: updatedActivity,
            thankYouNotes: updatedNotes,
          };
        });
      } catch (err) {}
    };

    fetchRemoteData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchRemoteData();
      }
    }, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const applyAuthSuccess = (u: User, t: string) => {
    if (!u || !u.email) return;
    const cleanEmail = (u.email || '').trim().toLowerCase();
    const cleanName = (u.name || cleanEmail.split('@')[0] || 'User').trim();

    const workersList = Array.isArray(appState?.workers) ? appState.workers : [];
    const bizList = Array.isArray(appState?.businesses) ? appState.businesses : [];
    const profile = appState?.profile || {};

    const existingWorker = workersList.find(
      w => w && (w.id === u.uid || (w.name && cleanName && w.name.toLowerCase().trim() === cleanName.toLowerCase()))
    );

    const targetBizName = (profile.workplace || '').toLowerCase().trim();
    const isExistingBusiness = profile.role === 'Business' || 
      (u.role === 'Business') || 
      (targetBizName ? bizList.some(b => b && b.name && b.name.toLowerCase().trim() === targetBizName) : false);
    
    const effectiveRole: 'Customer' | 'Worker' | 'Business' | 'Admin' = 
      (u.role && u.role !== 'Customer') 
        ? u.role 
        : (profile.role && profile.role !== 'Customer') 
        ? profile.role 
        : (isExistingBusiness ? 'Business' : existingWorker ? 'Worker' : 'Customer');

    const updatedUser: User = { 
      uid: u.uid || 'usr_' + Math.random().toString(36).substring(2, 9),
      name: cleanName,
      email: cleanEmail,
      role: effectiveRole,
      photoURL: u.photoURL || existingWorker?.avatar || profile.avatar || null,
    };
    
    // Only mark onboarded if already recorded, or has an explicit non-customer role / existing registered business
    const alreadyOnboarded = isUserOnboarded(cleanEmail) || !!existingWorker || isExistingBusiness || (u.role && u.role !== 'Customer');
    
    // 1. Synchronously persist to storage FIRST
    setAuthSession(updatedUser, t, alreadyOnboarded);
    
    // 2. Synchronously set atomic user and auth state
    setUser(updatedUser);
    setToken(t);
    setNeedsAuth(false);

    // 3. Update application state
    setAppState(prev => ({
      ...prev,
      profile: {
        ...(prev?.profile || {}),
        displayName: cleanName,
        email: cleanEmail,
        role: effectiveRole,
        avatar: updatedUser.photoURL,
        address: existingWorker?.address || prev?.profile?.address || '',
        position: existingWorker?.position || prev?.profile?.position || (effectiveRole === 'Worker' ? 'Staff Member' : effectiveRole === 'Business' ? 'Business Owner' : 'Customer'),
        workplace: existingWorker?.workplace || prev?.profile?.workplace || '',
        location: existingWorker ? { lat: existingWorker.lat, lng: existingWorker.lng } : prev?.profile?.location,
      }
    }));
  };

  const loginEmail = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    markUserOnboarded(email);
    applyAuthSuccess(res.user, res.token);
    return res;
  };

  const signupEmail = async (email: string, password: string, name: string, role: 'Customer' | 'Worker' | 'Business' = 'Customer') => {
    const res = await apiSignUp(email, password, name, role);
    markUserOnboarded(email);
    applyAuthSuccess(res.user, res.token);
  };

  const loginGoogle = async (payload?: {
    credential?: string;
    accessToken?: string;
    email?: string;
    name?: string;
    photoURL?: string;
    role?: 'Customer' | 'Worker' | 'Business';
  }) => {
    const res = await apiGoogleSignIn(payload);
    applyAuthSuccess(res.user, res.token);
    return res;
  };

  const signOut = () => {
    clearAuthSession();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setAppState(prev => ({
      ...prev,
      profile: {
        role: 'Customer',
        displayName: '',
        email: '',
        avatar: null,
      }
    }));
  };

  const updateState = (newState: Partial<AppState>) => {
    const now = Date.now();
    if (Array.isArray(newState.businesses)) {
      for (const b of newState.businesses) {
        if (b && b.id) {
          optimisticCreationsRef.current.set(b.id, now);
        }
      }
    }
    if (Array.isArray(newState.workers)) {
      for (const w of newState.workers) {
        if (w && w.id) {
          optimisticCreationsRef.current.set(w.id, now);
        }
      }
    }

    setAppState(prev => ({
      ...prev,
      ...newState,
      profile: newState.profile ? { ...prev.profile, ...newState.profile } : prev.profile,
    }));
  };

  const addReview = async (reviewData: Omit<Review, 'id' | 'createdAt'>) => {
    const currentUserName = appState.profile.displayName || appState.profile.name || user?.name || '';
    const targetWorker = appState.workers.find(w => w.id === reviewData.toUserId);
    const targetWorkerName = targetWorker ? targetWorker.name : reviewData.toUserId;

    // 1. RULE A: Cannot give merit to yourself
    if (
      (reviewData.fromUserId && reviewData.fromUserId === reviewData.toUserId) ||
      (currentUserName && targetWorkerName && currentUserName.trim().toLowerCase() === targetWorkerName.trim().toLowerCase())
    ) {
      throw new Error("Self-Recognition Blocked: You cannot award merit points or tips to yourself.");
    }

    // 2. RULE B: Limited to 1 merit per week (7 days) for the same person
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const recentReviewsToSameWorker = appState.reviews.filter(r => {
      const isFromUser = (reviewData.fromUserId && r.fromUserId === reviewData.fromUserId) ||
                         (currentUserName && r.fromUserName?.toLowerCase() === currentUserName.toLowerCase());
      const isToWorker = (reviewData.toUserId && r.toUserId === reviewData.toUserId) ||
                         (targetWorkerName && r.toUserId === targetWorkerName);
      if (!isFromUser || !isToWorker) return false;

      const reviewTime = new Date(r.createdAt).getTime();
      return (now - reviewTime) < sevenDaysMs;
    });

    if (recentReviewsToSameWorker.length > 0) {
      const latestReview = recentReviewsToSameWorker[0];
      const daysAgo = Math.floor((now - new Date(latestReview.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(1, 7 - daysAgo);
      throw new Error(`Recognition Limit: You can only award 1 merit recognition per week to the same team member. (Available in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'})`);
    }

    const newReview: Review = {
      ...reviewData,
      id: 'rev_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };

    setAppState(prev => {
      const workerName = targetWorker ? targetWorker.name : 'Team Member';
      const businessName = targetWorker?.workplace || 'FeeTrust Workplace';

      const newActivity: ActivityFeedItem = {
        id: 'act_' + Math.random().toString(36).substring(2, 9),
        fromUserName: reviewData.fromUserName || 'Customer',
        toWorkerName: workerName,
        businessName: businessName,
        meritType: reviewData.meritType,
        tipAmount: reviewData.tipAmount || 0,
        timeAgo: 'Just now',
      };

      // Persist to Express REST API & Supabase with matched canonical ID
      fetch('/api/reviews', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          id: newReview.id,
          fromUserId: newReview.fromUserId,
          fromUserName: newReview.fromUserName,
          toUserId: newReview.toUserId,
          meritType: newReview.meritType,
          tipAmount: newReview.tipAmount,
          reviewText: newReview.reviewText,
        }),
      }).catch(err => console.warn("API POST /api/reviews error:", err));

      const updatedReviews = [newReview, ...prev.reviews];
      const updatedActivity = [newActivity, ...prev.activityFeed];
      const updatedProfile = {
        ...prev.profile,
        meritsGiven: (prev.profile.meritsGiven || 0) + 1,
        gems: (prev.profile.gems || 0) + 50,
      };

      const updatedWorkers = prev.workers.map(w => {
        if (w.id === reviewData.toUserId) {
          return { ...w, level: w.level + 1 };
        }
        return w;
      });

      return {
        ...prev,
        reviews: updatedReviews,
        activityFeed: updatedActivity,
        profile: updatedProfile,
        workers: updatedWorkers,
      };
    });
  };

  const switchRole = (newRole: 'Customer' | 'Worker' | 'Business') => {
    let position = 'Customer';
    let workplace = '';

    if (newRole === 'Worker') {
      position = 'Staff Member';
      workplace = '';
    } else if (newRole === 'Business') {
      position = 'Business Owner';
      workplace = '';
    }

    setAppState(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        role: newRole,
        position,
        workplace,
      }
    }));

    if (user) {
      const updatedUser: User = { ...user, role: newRole };
      setUser(updatedUser);
      setAuthSession(updatedUser, token || 'token_demo');
      apiUpdateRole(newRole).catch(err => console.warn('[AUTH] Error syncing role to server:', err));
    }
  };

  const addThankYouNote = async (reviewId: string, message: string) => {
    const targetReview = appState.reviews.find(r => r.id === reviewId);
    const workerName = appState.profile.displayName || user?.name || 'Team Member';
    const customerName = targetReview ? targetReview.fromUserName : 'Customer';

    const newNote: ThankYouNote = {
      id: 'tn_' + Math.random().toString(36).substring(2, 9),
      reviewId,
      fromWorkerName: workerName,
      toUserName: customerName,
      message,
      createdAt: new Date().toISOString(),
    };

    setAppState(prev => ({
      ...prev,
      thankYouNotes: [newNote, ...(prev.thankYouNotes || [])]
    }));

    fetch(`/api/reviews/${reviewId}/thank-you`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        id: newNote.id,
        fromWorkerName: workerName,
        toUserName: customerName,
        message,
      }),
    }).catch(err => console.warn("API POST thank-you error:", err));
  };

  const updateWorkerAvailability = async (workerId: string, isAvailable: boolean) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await fetch(`/api/workers/${workerId}/availability`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isAvailable }),
      });
    } catch (e) {}
  };

  const deleteBusiness = async (id: string) => {
    const targetBiz = appState.businesses.find(b => b.id === id);
    const bizName = targetBiz?.name;
    const snapshotBusinesses = appState.businesses;
    const snapshotWorkers = appState.workers;

    setAppState(prev => ({
      ...prev,
      businesses: prev.businesses.filter(b => b.id !== id),
      workers: prev.workers.map(w => (bizName && w.workplace && w.workplace.toLowerCase().trim() === bizName.toLowerCase().trim()) ? { ...w, workplace: 'Unassigned' } : w),
    }));

    let res: Response;
    try {
      res = await fetch(`/api/businesses/${id}`, { method: 'DELETE', headers: authHeaders() });
    } catch (err) {
      setAppState(prev => ({ ...prev, businesses: snapshotBusinesses, workers: snapshotWorkers }));
      throw new Error('Could not reach the server — nothing was deleted.');
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as any));
      setAppState(prev => ({ ...prev, businesses: snapshotBusinesses, workers: snapshotWorkers }));
      throw new Error(j.error || `Delete failed (HTTP ${res.status}).`);
    }
    tombstonesRef.current.add(id);
    optimisticCreationsRef.current.delete(id);
  };

  const deleteWorker = async (id: string) => {
    const snapshotWorkers = appState.workers;
    const snapshotBusinesses = appState.businesses;

    setAppState(prev => ({
      ...prev,
      workers: prev.workers.filter(w => w.id !== id),
      businesses: prev.businesses.map(b => ({
        ...b,
        workers: (b.workers || []).filter(w => w.id !== id),
      })),
    }));

    let res: Response;
    try {
      res = await fetch(`/api/workers/${id}`, { method: 'DELETE', headers: authHeaders() });
    } catch (err) {
      setAppState(prev => ({ ...prev, workers: snapshotWorkers, businesses: snapshotBusinesses }));
      throw new Error('Could not reach the server — nothing was deleted.');
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as any));
      setAppState(prev => ({ ...prev, workers: snapshotWorkers, businesses: snapshotBusinesses }));
      throw new Error(j.error || `Delete failed (HTTP ${res.status}).`);
    }
    tombstonesRef.current.add(id);
    optimisticCreationsRef.current.delete(id);
  };

  const removeWorkerFromBusiness = async (bizId: string, workerId: string) => {
    setAppState(prev => ({
      ...prev,
      businesses: prev.businesses.map(b => b.id === bizId ? {
        ...b,
        workers: (b.workers || []).filter(w => w.id !== workerId),
      } : b),
      workers: prev.workers.map(w => w.id === workerId ? { 
        ...w, 
        workplace: 'Unassigned',
        registeredViaInvite: false,
        isVerifiedStaff: false,
        invitedByBusinessId: undefined,
        businessId: undefined
      } : w),
    }));

    try {
      await fetch(`/api/businesses/${bizId}/workers/${workerId}`, { method: 'DELETE', headers: authHeaders() });
    } catch (err) {
      console.warn('DELETE business worker error:', err);
    }
  };

  const approveWorkerToRoster = async (bizId: string, workerId: string) => {
    setAppState(prev => ({
      ...prev,
      workers: prev.workers.map(w => w.id === workerId ? { ...w, rosterStatus: 'active' as const } : w),
    }));

    try {
      const res = await fetch(`/api/businesses/${bizId}/workers/${workerId}/approve`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        // revert on failure
        setAppState(prev => ({
          ...prev,
          workers: prev.workers.map(w => w.id === workerId ? { ...w, rosterStatus: 'pending' as const } : w),
        }));
      }
    } catch (err) {
      console.warn('Approve worker error:', err);
    }
  };

  return (
    <StoreContext.Provider value={{ user, token, needsAuth, appState, loginEmail, signupEmail, loginGoogle, signOut, updateState, addReview, switchRole, addThankYouNote, updateWorkerAvailability, deleteBusiness, deleteWorker, removeWorkerFromBusiness, approveWorkerToRoster }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
};
