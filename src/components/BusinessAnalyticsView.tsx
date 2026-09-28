import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, WorkerProfile, BusinessProfile } from '../lib/store';
import { Building, Award, TrendingUp, Users, QrCode, Star, DollarSign, MapPin, Edit3, X, Loader2, Check, Sparkles, AlertTriangle, Trash2, LogOut, Shield } from 'lucide-react';
import BusinessQRModal from './BusinessQRModal';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import PricingPlansModal from './PricingPlansModal';
import { PricingPlan } from './PricingPlansSelector';
import { geocodeStreetAddress } from '../lib/geocoding';
import { deleteAccountPermanently } from '../lib/auth';
import { authHeaders } from '../lib/api';
import { soundEngine } from '../lib/audio';
import { compressImage } from '../lib/image';
import toast from 'react-hot-toast';
import { useActiveBusiness } from '../hooks/useActiveBusiness';

interface Props {
  onSelectWorker?: (worker: WorkerProfile) => void;
}

export default function BusinessAnalyticsView({ onSelectWorker }: Props) {
  const navigate = useNavigate();
  const { appState, user, updateState, signOut } = useStore();
  const [showQrModal, setShowQrModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const { activeBusiness: business, metrics, cleanBizName } = useActiveBusiness();

  const teamWorkers = metrics.activeWorkers;
  const totalTeamMerits = metrics.totalMerits;
  const totalTipsCollected = metrics.totalTips;
  const topStaff = metrics.topStaff;
  const peakHour = metrics.peakHour;
  const dayBuckets = metrics.dayBuckets;
  const maxDay = metrics.maxDayMerits;
  const timedMerits = metrics.totalMerits;
  const insightMerits = metrics.totalMerits;
  const insightTips = metrics.totalTips;

  const [editAddress, setEditAddress] = useState(business.address || appState.profile.address || '');
  const [editLatLng, setEditLatLng] = useState<{ lat: number; lng: number } | undefined>(
    business.lat && business.lng ? { lat: business.lat, lng: business.lng } : appState.profile.location
  );
  const [savingLocation, setSavingLocation] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const newAvatarUrl = await compressImage(file, 512, 0.85);
        if (!newAvatarUrl) return;
        const targetBizId = business.id;
        const cleanName = (business.name || '').toLowerCase().trim();

        let found = false;
        const updatedBusinesses = (appState.businesses || []).map((b) => {
          if (b.id === targetBizId || (b.name && b.name.toLowerCase().trim() === cleanName)) {
            found = true;
            return { ...b, avatar: newAvatarUrl };
          }
          return b;
        });

        if (!found) {
          updatedBusinesses.unshift({
            ...business,
            avatar: newAvatarUrl,
          });
        }

        updateState({
          profile: { ...appState.profile, avatar: newAvatarUrl },
          businesses: updatedBusinesses
        });

        const targetBiz = updatedBusinesses.find(b => b.id === targetBizId || (b.name && b.name.toLowerCase().trim() === cleanName)) || updatedBusinesses[0];
        if (targetBiz) {
          fetch('/api/businesses', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(targetBiz),
          }).catch(() => {});
        }

        toast.success('Business photo updated and visible on map!');
      } catch (err) {
        console.error('Failed to compress business photo:', err);
        toast.error('Failed to process image. Please try another photo.');
      }
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAddress.trim()) {
      toast.error('Please enter a valid street address.');
      return;
    }

    setSavingLocation(true);
    try {
      let finalLat = editLatLng?.lat;
      let finalLng = editLatLng?.lng;

      if (!finalLat || !finalLng) {
        const geo = await geocodeStreetAddress(editAddress.trim());
        finalLat = geo.lat;
        finalLng = geo.lng;
      }

      const cleanName = (business.name || '').toLowerCase().trim();
      let found = false;
      const updatedBusinesses = (appState.businesses || []).map((b) => {
        if (b.id === business.id || (b.name && b.name.toLowerCase().trim() === cleanName)) {
          found = true;
          return {
            ...b,
            address: editAddress.trim(),
            lat: finalLat,
            lng: finalLng,
            location: { lat: finalLat!, lng: finalLng! }
          };
        }
        return b;
      });

      if (!found) {
        updatedBusinesses.unshift({
          ...business,
          address: editAddress.trim(),
          lat: finalLat,
          lng: finalLng,
          location: { lat: finalLat!, lng: finalLng! }
        });
      }

      const updatedWorkers = (appState.workers || []).map(w => {
        if (w.id === business.id || (w.role === 'Business' && w.name.toLowerCase().trim() === cleanName)) {
          return {
            ...w,
            address: editAddress.trim(),
            lat: finalLat!,
            lng: finalLng!
          };
        }
        return w;
      });

      await updateState({
        profile: {
          ...appState.profile,
          address: editAddress.trim(),
          lat: finalLat,
          lng: finalLng,
          location: { lat: finalLat, lng: finalLng }
        },
        businesses: updatedBusinesses,
        workers: updatedWorkers
      });

      // Persist to REST API
      const updatedTargetBiz = updatedBusinesses.find(b => b.id === business.id || (b.name && b.name.toLowerCase().trim() === cleanName)) || updatedBusinesses[0];
      if (updatedTargetBiz) {
        await fetch('/api/businesses', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(updatedTargetBiz),
        }).catch(() => {});
      }

      toast.success('Pin location & address updated accurately on map!');
      setShowLocationModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const handlePlanSelect = async (plan: PricingPlan) => {
    const cleanName = (business.name || '').toLowerCase().trim();
    let found = false;
    const updatedBusinesses = (appState.businesses || []).map(b => {
      if (b.id === business.id || (b.name && b.name.toLowerCase().trim() === cleanName)) {
        found = true;
        return {
          ...b,
          plan: plan.name,
          planPrice: `${plan.priceFormatted} ${plan.period}`,
          employeeLimit: plan.employeeLimit,
        };
      }
      return b;
    });

    if (!found) {
      updatedBusinesses.unshift({
        ...business,
        plan: plan.name,
        planPrice: `${plan.priceFormatted} ${plan.period}`,
        employeeLimit: plan.employeeLimit,
      });
    }

    updateState({
      businesses: updatedBusinesses,
      profile: {
        ...appState.profile,
        plan: plan.name,
        planPrice: `${plan.priceFormatted} ${plan.period}`,
        employeeLimit: plan.employeeLimit,
      }
    });

    // Persist to REST backend
    try {
      const targetBiz = updatedBusinesses.find(b => b.id === business.id || (b.name && b.name.toLowerCase().trim() === cleanName)) || updatedBusinesses[0];
      if (targetBiz) {
        fetch('/api/businesses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            ...targetBiz,
            plan: plan.name,
            planPrice: `${plan.priceFormatted} ${plan.period}`,
            employeeLimit: plan.employeeLimit,
          }),
        }).catch(err => console.warn('Could not persist business plan:', err));
      }

      fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          id: user?.uid,
          email: user?.email,
          plan: plan.name,
          planPrice: `${plan.priceFormatted} ${plan.period}`,
          employeeLimit: plan.employeeLimit,
        }),
      }).catch(err => console.warn('Could not persist profile plan:', err));
    } catch (e) { }

    toast.success(`Plan updated to ${plan.name} (${plan.priceFormatted}${plan.period})!`);
    setShowPricingModal(false);
  };

  const handleDeleteBusinessAccount = async () => {
    setDeletingAccount(true);
    try {
      const userUid = user?.uid;
      const userEmail = user?.email || appState.profile.email;
      const userName = user?.name || appState.profile.displayName || appState.profile.name;
      const bizName = business.name || appState.profile.workplace || '';
      const bizId = business.id;
      const cleanBiz = bizName.toLowerCase().trim();

      // 1. Wipe backend database records and purge local storage
      await deleteAccountPermanently(userUid, userEmail, bizId, bizName);

      // 2. Clean in-memory appState
      updateState({
        workers: (appState.workers || []).filter(w => {
          if (userUid && w.id === userUid) return false;
          if (bizId && w.id === bizId) return false;
          if (cleanBiz && w.role === 'Business' && w.name.toLowerCase().trim() === cleanBiz) return false;
          if (cleanBiz && w.workplace && w.workplace.toLowerCase().trim() === cleanBiz) return false;
          if (userName && w.name.toLowerCase().trim() === userName.toLowerCase().trim()) return false;
          return true;
        }),
        businesses: (appState.businesses || []).filter(b => {
          if (b.id === bizId || b.id === userUid || (b as any).user_id === userUid) return false;
          if (cleanBiz && b.name.toLowerCase().trim() === cleanBiz) return false;
          return true;
        }),
        reviews: (appState.reviews || []).filter(r => {
          if (userUid && (r.fromUserId === userUid || r.toUserId === userUid)) return false;
          if (cleanBiz && r.businessName && r.businessName.toLowerCase().trim() === cleanBiz) return false;
          return true;
        }),
        activityFeed: (appState.activityFeed || []).filter(a => {
          if (cleanBiz && a.businessName && a.businessName.toLowerCase().trim() === cleanBiz) return false;
          return true;
        }),
        merits: [],
        contacts: [],
      });

      // 3. Clear session and redirect to auth
      signOut();
      toast.success("Your business and account have been permanently deleted.", { duration: 5000 });
      window.location.href = '/auth';
    } catch (err: any) {
      console.error("Delete business account error:", err);
      signOut();
      window.location.href = '/auth';
    } finally {
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  const businessAvatar = business.avatar || appState.profile.avatar;

  return (
    <div className="space-y-6 font-['Outfit',sans-serif]">
      {/* Business Header & QR Button */}
      <div className="bg-gradient-to-br from-purple-50 via-white to-pink-50 border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          {/* Business Image Upload Circle */}
          <div 
            className="relative group cursor-pointer shrink-0" 
            onClick={() => fileInputRef.current?.click()}
            title="Click to upload business picture for the map"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 p-0.5 shadow-md transition-transform group-hover:scale-105">
              <div className="w-full h-full bg-slate-100 rounded-[14px] flex items-center justify-center overflow-hidden relative">
                {businessAvatar ? (
                  <img src={businessAvatar} alt={business.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🏢</span>
                )}
                <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-extrabold text-white uppercase tracking-wider">Photo</span>
                </div>
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
              aria-label="Upload business photo"
            />
          </div>

          <div>
            <div className="flex items-center space-x-2 text-rose-600 font-bold text-xs uppercase tracking-wider mb-1">
              <Building className="w-4 h-4" /> Business Dashboard
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{business.name}</h2>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-slate-500 text-sm flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1 text-rose-500 shrink-0" />
                {business.address || 'Address not configured'}
              </span>
              <button
                onClick={() => {
                  setEditAddress(business.address || appState.profile.address || '');
                  setShowLocationModal(true);
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer inline-flex items-center"
              >
                <Edit3 className="w-3 h-3 mr-0.5" /> Edit Pin
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => navigate('/business')}
            className="flex-1 md:flex-initial bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-4 py-3 rounded-2xl flex items-center justify-center shadow-xs hover:bg-indigo-100 transition-colors text-xs md:text-sm cursor-pointer"
          >
            <Users className="w-4 h-4 mr-1.5 text-indigo-600" /> Team Hub
          </button>
          <button
            onClick={() => {
              setEditAddress(business.address || appState.profile.address || '');
              setShowLocationModal(true);
            }}
            className="flex-1 md:flex-initial bg-white border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-2xl flex items-center justify-center shadow-xs hover:bg-slate-50 transition-colors text-xs md:text-sm cursor-pointer"
          >
            <MapPin className="w-4 h-4 mr-1.5 text-rose-500" /> Fix Pin Location
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 md:flex-initial bg-white border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-2xl flex items-center justify-center shadow-xs hover:bg-slate-50 transition-colors text-xs md:text-sm cursor-pointer"
          >
            🖼️ Upload Photo
          </button>
          <button
            onClick={() => setShowQrModal(true)}
            className="flex-1 md:flex-initial bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-5 py-3 rounded-2xl flex items-center justify-center shadow-md hover:opacity-95 transition-opacity text-xs md:text-sm cursor-pointer"
          >
            <QrCode className="w-4 h-4 mr-2" /> Display QR
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-amber-500 mb-2">
            <Star className="w-6 h-6 fill-amber-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Team Merits</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{totalTeamMerits}</div>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">{totalTeamMerits > 0 ? `${totalTeamMerits} total verified merits` : 'Awaiting first recognition'}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <Users className="w-6 h-6 text-purple-600" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee Seats</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {teamWorkers.length}{' '}
            <span className="text-sm font-semibold text-slate-400">
              / {metrics.seatLimit} Seats
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <p className="text-[11px] text-purple-600 font-bold flex items-center">
              <Sparkles className="w-3 h-3 mr-1" />
              {metrics.planName} ({metrics.planPrice})
            </p>
            <button
              onClick={() => setShowPricingModal(true)}
              className="text-[11px] font-extrabold text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              Change Plan
            </button>
          </div>
        </div>
      </div>

      {/* Insights: trends, top staff, peak hours, tips */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 text-emerald-600 mr-2" /> Insights
        </h3>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Merits</p>
            <p className="text-2xl font-extrabold text-slate-900">{insightMerits}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tips collected</p>
            <p className="text-2xl font-extrabold text-slate-900">${insightTips}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Peak hour</p>
            <p className="text-2xl font-extrabold text-slate-900">
              {peakHour != null ? `${String(peakHour).padStart(2, '0')}:00` : '—'}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">On roster</p>
            <p className="text-2xl font-extrabold text-slate-900">{teamWorkers.length}</p>
          </div>
        </div>

        {/* 7-day trend */}
        <div className="mb-5">
          <p className="text-xs font-bold text-slate-600 mb-2">Last 7 days</p>
          <div className="flex items-end gap-2 h-24">
            {dayBuckets.map((c, i) => {
              const d = new Date(now - (6 - i) * DAY_MS);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t-md transition-all"
                    style={{ height: `${Math.max(4, (c / maxDay) * 100)}%` }}
                    title={`${c} merit(s)`}
                  />
                  <span className="text-[9px] text-slate-400 mt-1 font-mono">
                    {d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top staff */}
        <div>
          <p className="text-xs font-bold text-slate-600 mb-2">Top staff by merits received</p>
          {topStaff.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">No merits recorded yet for {business.name}.</p>
          ) : (
            <div className="space-y-2">
              {topStaff.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  <span className="text-sm font-bold text-slate-800">#{i + 1} {s.name}</span>
                  <span className="text-sm font-extrabold text-amber-600">{s.count}</span>
                </div>
              ))}
            </div>
          )}
          {insightMerits > 0 && timedMerits === 0 && (
            <p className="text-[11px] text-slate-400 mt-2">Trend/hour data appears once activity carries timestamps.</p>
          )}
        </div>
      </div>

      {/* Team Leaderboard */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
          <Award className="w-5 h-5 text-amber-500 mr-2" /> Team Merit Leaderboard
        </h3>

        <div className="space-y-3">
          {teamWorkers.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No staff members enrolled yet</p>
              <p className="text-xs text-slate-500 mt-1">Staff members who join {business.name} will appear on this leaderboard.</p>
            </div>
          ) : (
            teamWorkers.map((worker, index) => (
              <div 
                key={worker.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between hover:border-indigo-400 hover:bg-white transition-all shadow-2xs"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-sm ${
                    index === 0 ? 'bg-amber-400 text-slate-950' : index === 1 ? 'bg-slate-300 text-slate-950' : 'bg-amber-600 text-white'
                  }`}>
                    #{index + 1}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-base shadow-xs">
                    {worker.initials || (worker.name ? worker.name.substring(0, 2).toUpperCase() : 'FT')}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{worker.name}</h4>
                    <p className="text-xs text-slate-500">{worker.position}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-600">Level {worker.level}</p>
                    <p className="text-xs text-slate-500">{worker.level * 8 + 12} Merits</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Business QR Modal */}
      <BusinessQRModal
        business={business}
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        onSelectWorker={(w) => onSelectWorker?.(w)}
      />

      {/* Edit Pin & Street Address Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 font-['Outfit',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Business Map Pin</h3>
                  <p className="text-xs text-slate-500">Set accurate street address for the live map</p>
                </div>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Street Address & City
                </label>
                <AddressAutocompleteInput
                  value={editAddress}
                  onChange={(val, latLng) => {
                    setEditAddress(val);
                    if (latLng) {
                      setEditLatLng(latLng);
                    }
                  }}
                  placeholder="e.g. 14100 Weber Drive, Huntley, IL"
                  required
                />
              </div>

              {editLatLng && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <span className="font-mono text-[11px]">Lat: {editLatLng.lat.toFixed(4)}, Lng: {editLatLng.lng.toFixed(4)}</span>
                  <span className="text-emerald-600 font-bold flex items-center">
                    <Check className="w-3.5 h-3.5 mr-1" /> Geocoded
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingLocation}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md hover:opacity-95 transition-opacity text-sm cursor-pointer flex items-center justify-center disabled:opacity-50"
                >
                  {savingLocation ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
                  Save Pin Location
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  disabled={savingLocation}
                  className="py-3 px-4 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors text-sm cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Pricing Plans Modal */}
      <PricingPlansModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        business={business}
        selectedPlanId={
          business.plan?.toLowerCase().includes('starter') || business.plan === 'INITIAL PLAN' || business.plan === 'starter' || business.plan === 'initial'
            ? 'starter'
            : business.plan?.toLowerCase().includes('business') || business.plan === 'BUSINESS PLAN' || business.plan === 'business'
            ? 'business'
            : 'growth'
        }
      />

      {/* Business Account Management / Small Delete Option */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center sm:justify-start">
            <Shield className="w-4 h-4 text-slate-400 mr-1.5" /> Business Account Settings
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Account: <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.email || appState.profile.email}</span> • Role: <span className="font-semibold text-purple-600 dark:text-purple-400">Business Manager</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center sm:justify-end">
          <button
            onClick={() => {
              soundEngine.playClick();
              signOut();
            }}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center shadow-2xs"
            aria-label="Sign out of business account"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign Out
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setShowDeleteConfirm(true);
            }}
            className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 rounded-xl transition-colors cursor-pointer flex items-center shadow-2xs"
            aria-label="Delete business account"
            title="Permanently delete business and account"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Account
          </button>
        </div>
      </div>

      {/* Delete Business Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl text-center space-y-4 font-['Outfit',sans-serif]">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800 shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                Delete Business & Account?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed font-medium">
                This action is <span className="font-bold text-rose-600 dark:text-rose-400">permanent and irreversible</span>. 
                Your business (<strong className="text-slate-800 dark:text-slate-200">{business.name}</strong>), map pin, team links, customer recognitions, and login records will be completely erased.
              </p>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl text-left text-xs space-y-1 text-rose-800 dark:text-rose-300 font-medium">
              <p className="font-bold flex items-center text-rose-700 dark:text-rose-300">
                <Trash2 className="w-3.5 h-3.5 mr-1.5 shrink-0" /> Everything that will be deleted:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                <li>Business: <strong className="font-bold">{business.name}</strong></li>
                <li>Live map discovery pin and street address</li>
                <li>Employee seats and staff team connections</li>
                <li>Reviews, merits, and activity feed history</li>
                <li>User profile and credentials ({user?.email || appState.profile.email})</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleDeleteBusinessAccount}
                disabled={deletingAccount}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Deleting Business & Account...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Yes, Delete Everything Permanently
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingAccount}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors cursor-pointer text-sm hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Cancel, Keep My Business
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
