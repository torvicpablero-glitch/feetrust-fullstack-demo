import { useState, useMemo, useEffect } from 'react';
import { useStore, BusinessProfile, WorkerProfile, isWorkerManagerAffiliated } from '../lib/store';

export interface BusinessMetrics {
  totalMerits: number;
  totalTips: number;
  activeWorkers: WorkerProfile[];
  pendingWorkers: WorkerProfile[];
  seatLimit: number;
  planName: string;
  planPrice: string;
  slotsRemaining: number;
  topStaff: { name: string; count: number }[];
  peakHour: number | null;
  dayBuckets: number[];
  maxDayMerits: number;
}

export function useActiveBusiness() {
  const { appState, user } = useStore();
  const userBizName = (appState.profile?.workplace || '').toLowerCase().trim();

  // 1. Resolve all businesses owned or claimed by the authenticated manager
  const userOwnedBusinesses = useMemo<BusinessProfile[]>(() => {
    const list = appState.businesses || [];
    return list.filter(b => {
      if (!b) return false;
      const bName = (b.name || '').toLowerCase().trim();
      const bOwnerId = (b as any).user_id || (b as any).userId;
      const bOwnerEmail = (b as any).ownerEmail;

      const matchesUid = Boolean(user?.uid && bOwnerId && bOwnerId === user.uid);
      const matchesEmail = Boolean(user?.email && bOwnerEmail && bOwnerEmail.toLowerCase() === user.email.toLowerCase());
      const matchesWorkplace = Boolean(userBizName && bName && bName === userBizName);

      return matchesUid || matchesEmail || matchesWorkplace;
    });
  }, [appState.businesses, user?.uid, user?.email, userBizName]);

  // 2. Synthesize safe fallback business for the user's workplace if not yet in appState.businesses
  const fallbackBusiness = useMemo<BusinessProfile>(() => {
    const isLuigi = userBizName.includes('luigi');
    const defaultPlan = isLuigi ? 'Business' : (appState.profile?.plan || 'Starter');
    const defaultPrice = isLuigi ? '$499 USD / year' : (appState.profile?.planPrice || (defaultPlan.toLowerCase().includes('business') ? '$499 USD / year' : defaultPlan.toLowerCase().includes('growth') ? '$349 USD / year' : '$5 USD / year'));
    const defaultLimit = (defaultPlan.toLowerCase().includes('business') || isLuigi) ? 15 : defaultPlan.toLowerCase().includes('growth') ? 8 : 4;

    const lat = appState.profile?.lat || appState.profile?.location?.lat;
    const lng = appState.profile?.lng || appState.profile?.location?.lng;

    return {
      id: 'biz_' + (user?.uid || 'primary'),
      name: appState.profile?.workplace || 'My Business',
      category: appState.profile?.position || 'Service & Hospitality',
      address: appState.profile?.address || 'Registered Address',
      rating: 5.0,
      lat,
      lng,
      location: (lat && lng) ? { lat, lng } : undefined,
      plan: defaultPlan,
      planPrice: defaultPrice,
      employeeLimit: defaultLimit,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/biz_${user?.uid || '1'}`,
      workers: [],
      user_id: user?.uid,
      ownerEmail: user?.email,
      hasPaid: appState.profile?.hasPaid !== undefined ? Boolean(appState.profile.hasPaid) : true,
      paymentStatus: appState.profile?.paymentStatus || ((appState.profile?.hasPaid === false) ? 'pending' : 'paid'),
    };
  }, [appState.profile, user?.uid, user?.email, userBizName]);

  // 3. Selection state: strictly synchronize with owned stores
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(() => {
    return userOwnedBusinesses[0]?.id || fallbackBusiness.id;
  });

  // Keep selected ID in sync if owned businesses change or load from API
  useEffect(() => {
    if (userOwnedBusinesses.length > 0) {
      const stillValid = userOwnedBusinesses.some(b => b.id === selectedBusinessId);
      if (!stillValid) {
        setSelectedBusinessId(userOwnedBusinesses[0].id);
      }
    } else {
      setSelectedBusinessId(fallbackBusiness.id);
    }
  }, [userOwnedBusinesses, fallbackBusiness.id, selectedBusinessId]);

  // 4. Resolve active current business — NEVER fallback to random seeded demo store
  const activeBusiness = useMemo<BusinessProfile>(() => {
    if (userOwnedBusinesses.length > 0) {
      const found = userOwnedBusinesses.find(b => b.id === selectedBusinessId);
      if (found) return found;
      return userOwnedBusinesses[0];
    }
    // If the user has a workplace name set, strictly use fallbackBusiness for their workplace
    if (appState.profile?.workplace || appState.profile?.role === 'Business') {
      return fallbackBusiness;
    }
    // Absolute fallback for demo/guest view only
    return (appState.businesses && appState.businesses[0]) || fallbackBusiness;
  }, [userOwnedBusinesses, selectedBusinessId, appState.profile?.workplace, appState.profile?.role, fallbackBusiness, appState.businesses]);

  // 5. Build authoritative team roster for active business
  const { activeWorkers, pendingWorkers } = useMemo(() => {
    const combinedMap = new Map<string, WorkerProfile>();
    const cleanBizName = (activeBusiness.name || '').toLowerCase().trim();

    // A. Explicit roster on business object
    (activeBusiness.workers || []).forEach(w => {
      if (w && w.id && w.role !== 'Business' && w.id !== activeBusiness.id && (w.name || '').toLowerCase().trim() !== cleanBizName) {
        combinedMap.set(w.id, w);
      }
    });

    // B. Global workers with official manager affiliation
    (appState.workers || []).forEach(w => {
      if (w && isWorkerManagerAffiliated(w, activeBusiness)) {
        const existingKey = Array.from(combinedMap.keys()).find(k => {
          const ew = combinedMap.get(k);
          return k === w.id || (ew && ew.name && w.name && ew.name.toLowerCase().trim() === w.name.toLowerCase().trim());
        });
        if (existingKey) {
          const existing = combinedMap.get(existingKey)!;
          combinedMap.set(existingKey, {
            ...existing,
            ...w,
            avatar: w.avatar || existing.avatar,
          });
        } else {
          combinedMap.set(w.id, w);
        }
      }
    });

    // C. Enrich avatars
    combinedMap.forEach((w, key) => {
      if (!w.avatar) {
        const match = (appState.workers || []).find(gw => gw && gw.avatar && (
          gw.id === w.id || (gw.name && w.name && gw.name.toLowerCase().trim() === w.name.toLowerCase().trim())
        ));
        if (match?.avatar) {
          combinedMap.set(key, { ...w, avatar: match.avatar });
        }
      }
    });

    const all = Array.from(combinedMap.values());
    return {
      activeWorkers: all.filter(w => w.rosterStatus !== 'pending'),
      pendingWorkers: all.filter(w => w.rosterStatus === 'pending'),
    };
  }, [activeBusiness, appState.workers]);

  // 6. Plan limits and seats
  const planLower = (activeBusiness.plan || appState.profile?.plan || 'Starter').toLowerCase();
  const isLuigi = (activeBusiness.name || '').toLowerCase().includes('luigi');
  const defaultLimitForPlan = (planLower.includes('business') || isLuigi) ? 15 : planLower.includes('growth') ? 8 : 4;
  const seatLimit = Math.max(
    Number(activeBusiness.employeeLimit || (isLuigi ? 15 : appState.profile?.employeeLimit) || defaultLimitForPlan),
    defaultLimitForPlan
  );
  const planName = activeBusiness.plan || (isLuigi ? 'Business' : appState.profile?.plan) || 'Starter';
  const planPrice = activeBusiness.planPrice || (isLuigi ? '$499 USD / year' : appState.profile?.planPrice) || (
    (planLower.includes('business') || isLuigi) ? '$499 USD / year' :
    planLower.includes('growth') ? '$349 USD / year' : '$5 USD / year'
  );
  const slotsRemaining = Math.max(0, seatLimit - activeWorkers.length);

  // 7. Strictly scoped business metrics (Zero leakage from other businesses)
  const metrics = useMemo<BusinessMetrics>(() => {
    const cleanBizName = (activeBusiness.name || '').toLowerCase().trim();
    const workerIds = new Set(activeWorkers.map(w => w.id));

    // Scoped activity feed matching this business
    const bizActivity = (appState.activityFeed || []).filter(a => {
      if (!a || !a.businessName) return false;
      const ab = a.businessName.toLowerCase().trim();
      return ab === cleanBizName || (userBizName && ab === userBizName);
    });

    // Scoped reviews matching this business OR its workers (NEVER appState.reviews.length!)
    const bizReviews = (appState.reviews || []).filter(r => {
      if (!r) return false;
      if ((r as any).businessId && (r as any).businessId === activeBusiness.id) return true;
      if ((r as any).businessName) {
        const rb = ((r as any).businessName || '').toLowerCase().trim();
        if (rb === cleanBizName || (userBizName && rb === userBizName)) return true;
      }
      if (r.toUserId && workerIds.has(r.toUserId)) return true;
      return false;
    });

    // Merits count
    const totalMerits = Math.max(bizActivity.length, bizReviews.length);

    // Tips collected strictly for this business
    const activityTips = bizActivity.reduce((acc, a) => acc + (Number(a.tipAmount) || 0), 0);
    const reviewTips = bizReviews.reduce((acc, r) => acc + (Number(r.tipAmount) || 0), 0);
    const totalTips = Math.max(activityTips, reviewTips);

    // Top staff by merits received
    const staffCounts = new Map<string, number>();
    for (const a of bizActivity) {
      const key = (a.toWorkerName || 'Team Member').trim();
      staffCounts.set(key, (staffCounts.get(key) || 0) + 1);
    }
    for (const r of bizReviews) {
      const w = activeWorkers.find(worker => worker.id === r.toUserId);
      const key = (w?.name || r.toUserId || 'Team Member').trim();
      if (!bizActivity.some(a => (a.toWorkerName || '').trim() === key)) {
        staffCounts.set(key, (staffCounts.get(key) || 0) + 1);
      }
    }
    const topStaff = Array.from(staffCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 5);

    // Peak hours and 7-day trends
    const hourBuckets = new Array(24).fill(0);
    const dayBuckets = new Array(7).fill(0);
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    for (const a of bizActivity) {
      const t = a.createdAt ? new Date(a.createdAt).getTime() : null;
      if (t && !isNaN(t)) {
        hourBuckets[new Date(t).getHours()] += 1;
        const daysAgo = Math.floor((now - t) / DAY_MS);
        if (daysAgo >= 0 && daysAgo < 7) dayBuckets[6 - daysAgo] += 1;
      }
    }

    const peakHour = hourBuckets.some(c => c > 0)
      ? hourBuckets.indexOf(Math.max(...hourBuckets))
      : null;
    const maxDayMerits = Math.max(1, ...dayBuckets);

    return {
      totalMerits,
      totalTips,
      activeWorkers,
      pendingWorkers,
      seatLimit,
      planName,
      planPrice,
      slotsRemaining,
      topStaff,
      peakHour,
      dayBuckets,
      maxDayMerits,
    };
  }, [activeBusiness, activeWorkers, pendingWorkers, seatLimit, planName, planPrice, slotsRemaining, appState.activityFeed, appState.reviews, userBizName]);

  return {
    activeBusiness,
    userOwnedBusinesses,
    selectedBusinessId,
    setSelectedBusinessId,
    metrics,
    cleanBizName: (activeBusiness.name || '').toLowerCase().trim(),
    isLuigi,
  };
}
