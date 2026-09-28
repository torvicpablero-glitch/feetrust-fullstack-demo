import React, { useState, useEffect, useRef } from 'react';
import { useStore, WorkerProfile } from '../lib/store';
import { deleteAccountPermanently } from '../lib/auth';
import { Star, Building2, ChevronRight, Settings, Loader2, Camera, Edit2, QrCode, LogOut, Award, ShieldCheck, UserPlus, Lock, RefreshCw, MessageSquare, Shield, Trash2, FileText, AlertTriangle, Share2 } from 'lucide-react';
import BusinessAnalyticsView from '../components/BusinessAnalyticsView';
import BusinessQRModal from '../components/BusinessQRModal';
import WorkerPassportModal from '../components/WorkerPassportModal';
import WorkerQRModal from '../components/WorkerQRModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import toast, { Toaster } from 'react-hot-toast';
import { soundEngine } from '../lib/audio';
import { authHeaders } from '../lib/api';
import { compressImage } from '../lib/image';


export default function ProfilePage() {
  const { appState, user, signOut, updateState, updateWorkerAvailability } = useStore();
  const { profile } = appState;
  const [contacts, setContacts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editPosition, setEditPosition] = useState(profile.position || '');
  const [editWorkplace, setEditWorkplace] = useState(profile.workplace || '');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showWorkerQrModal, setShowWorkerQrModal] = useState(false);
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const matchingWorker = (appState.workers || []).find(w => 
    w && (w.id === user?.uid || (user?.email && w.id === user.email) || (user?.name && w.name && w.name.toLowerCase().trim() === user.name.toLowerCase().trim()))
  );

  const effectiveRole: 'Customer' | 'Worker' | 'Business' | 'Admin' = 
    (user?.role && user.role !== 'Customer')
      ? user.role
      : (profile.role && profile.role !== 'Customer')
      ? profile.role
      : matchingWorker
      ? 'Worker'
      : (profile.workplace && profile.workplace !== 'FeetTrust Workplace' ? 'Worker' : 'Customer');

  const currentLevel = matchingWorker?.level || profile.level || 1;
  const currentMerits = (profile.meritsGiven * 250) || (currentLevel * 250);
  const nextLevelMerits = (currentLevel + 1) * 400;
  const progressPercent = Math.min(100, Math.round((currentMerits / nextLevelMerits) * 100));

  // Availability (on-shift) toggle — worker-only
  const [isAvailable, setIsAvailable] = useState<boolean>(
    (matchingWorker?.isAvailable ?? profile.isAvailable ?? true) as boolean
  );
  const [savingAvailability, setSavingAvailability] = useState(false);

  useEffect(() => {
    setIsAvailable((matchingWorker?.isAvailable ?? profile.isAvailable ?? true) as boolean);
  }, [matchingWorker?.isAvailable, profile.isAvailable]);

  const handleToggleAvailability = async () => {
    const workerRef = matchingWorker?.id || user?.uid;
    if (!workerRef) {
      toast.error('No worker profile found to update.');
      return;
    }
    const next = !isAvailable;
    setIsAvailable(next);
    setSavingAvailability(true);
    try {
      await updateWorkerAvailability(workerRef, next);
      toast.success(next ? 'You are now marked Available for work' : 'You are now marked Unavailable');
    } catch {
      setIsAvailable(!next);
      toast.error('Failed to update availability.');
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const userUid = user?.uid;
      const userEmail = user?.email || profile.email;
      const userName = user?.name || profile.displayName || profile.name;
      const bizName = profile.workplace || '';
      const biz = (appState.businesses || []).find(b => 
        (bizName && b.name && b.name.toLowerCase().trim() === bizName.toLowerCase().trim()) ||
        ((b as any)?.user_id && (b as any).user_id === userUid) ||
        (b.id === userUid || b.id === `biz_${userUid}`)
      );
      const cleanBiz = (biz?.name || bizName).toLowerCase().trim();

      // 1. Wipe backend database records and purge local storage
      await deleteAccountPermanently(userUid, userEmail, biz?.id, biz?.name || bizName);

      // 2. Clean in-memory appState
      updateState({
        workers: (appState.workers || []).filter(w => {
          if (userUid && w.id === userUid) return false;
          if (biz?.id && w.id === biz.id) return false;
          if (cleanBiz && w.role === 'Business' && w.name.toLowerCase().trim() === cleanBiz) return false;
          if (cleanBiz && w.workplace && w.workplace.toLowerCase().trim() === cleanBiz) return false;
          if (userName && w.name.toLowerCase().trim() === userName.toLowerCase().trim()) return false;
          return true;
        }),
        businesses: (appState.businesses || []).filter(b => {
          if (b.id === biz?.id || b.id === userUid || (b as any).user_id === userUid) return false;
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

      // 3. Clear session and show notification
      signOut();
      toast.success("Your account and all personal data have been permanently deleted.", { duration: 5000 });
      window.location.href = '/auth';
    } catch (err: any) {
      console.error("Delete account error:", err);
      signOut();
      window.location.href = '/auth';
    } finally {
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  useEffect(() => {
    if (!user?.uid || profile.role === 'Customer') {
      setReviews([]);
      return;
    }
    const userReviews = (appState.reviews || []).filter((r: any) => r.toUserId === user?.uid);
    setReviews(userReviews);
  }, [user, profile.role, appState.reviews]);

  const handleFetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const token = await import('../lib/auth').then(m => m.getAccessToken());
      if (!token) return;
      const res = await fetch('/api/contacts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.connections && data.connections.length > 0) {
        setContacts(data.connections);
        toast.success('Contacts synced successfully!');
      } else {
        toast.error('No contacts available from connected service.');
      }
    } catch (err) {
      toast.error('Failed to import contacts.');
    }
    setLoadingContacts(false);
  };

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/auth?referrer=${encodeURIComponent(user?.name || 'User')}`;
    const text = `Check out my FeeTrust merit profile & verified passport!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${user?.name || 'FeeTrust'} - Merit Profile`,
          text: text,
          url: profileUrl,
        });
        toast.success("Shared profile link!");
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          navigator.clipboard.writeText(`${text} ${profileUrl}`);
          toast.success("Profile link copied to clipboard!");
        }
      }
    } else {
      navigator.clipboard.writeText(`${text} ${profileUrl}`);
      toast.success("Profile link copied to clipboard!");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const newAvatarUrl = await compressImage(file, 512, 0.85);
        if (!newAvatarUrl) return;

        const currentWorkerId = user?.uid;
        const currentEmail = user?.email || profile.email;
        const currentName = user?.name || profile.displayName || profile.name;

        const updatedWorkers = (appState.workers || []).map(w => {
          if (w.id === currentWorkerId || (currentEmail && w.id === currentEmail) || (currentName && w.name.toLowerCase() === currentName.toLowerCase())) {
            return { ...w, avatar: newAvatarUrl };
          }
          return w;
        });

        const updatedBusinesses = (appState.businesses || []).map(b => {
          return {
            ...b,
            workers: (b.workers || []).map(bw => {
              if (bw.id === currentWorkerId || (currentEmail && bw.id === currentEmail) || (currentName && bw.name.toLowerCase() === currentName.toLowerCase())) {
                return { ...bw, avatar: newAvatarUrl };
              }
              return bw;
            })
          };
        });

        updateState({ 
          profile: { ...profile, avatar: newAvatarUrl },
          workers: updatedWorkers,
          businesses: updatedBusinesses,
        });

        try {
          localStorage.setItem('cached_workers', JSON.stringify(updatedWorkers));
        } catch (e) { }

        // Persist to REST backend and database
        try {
          fetch('/api/auth/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              id: user?.uid,
              email: currentEmail,
              name: currentName,
              avatar: newAvatarUrl,
            }),
          }).catch(err => console.warn('Could not persist avatar to /api/auth/profile:', err));

          const targetWorker = updatedWorkers.find(w => w.id === currentWorkerId || (currentName && w.name.toLowerCase() === currentName.toLowerCase()));
          const workerPayload = targetWorker ? {
            ...targetWorker,
            avatar: newAvatarUrl,
          } : {
            name: currentName || 'Staff Member',
            position: profile.position || 'Staff',
            workplace: profile.workplace || '',
            avatar: newAvatarUrl,
            role: 'Worker',
            user_id: user?.uid,
          };

          fetch('/api/workers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(workerPayload),
          }).catch(err => console.warn('Could not persist avatar to /api/workers:', err));
        } catch (e) { }

        toast.success('Profile picture updated and visible across map and team rosters!');
      } catch (err) {
        console.error('Failed to compress image:', err);
        toast.error('Failed to process image. Please try another photo.');
      }
    }
  };

  const handleSaveProfile = () => {
    soundEngine.playClick();
    updateState({ profile: { ...profile, position: editPosition, workplace: editWorkplace } });
    setIsEditing(false);
    toast.success('Profile updated!');
  };

  const handleToggleAvailable = () => {
    soundEngine.playClick();
    const newAvail = profile.isAvailable === false ? true : false;
    const currentWorker = (appState.workers || []).find(w => w.id === user?.uid || (user?.name && w.name.toLowerCase() === user.name.toLowerCase()));

    updateState({ 
      profile: { ...profile, isAvailable: newAvail },
      workers: (appState.workers || []).map(w => {
        if (w.id === user?.uid || (user?.name && w.name.toLowerCase() === user.name.toLowerCase())) {
          return { ...w, isAvailable: newAvail };
        }
        return w;
      })
    });

    if (currentWorker && updateWorkerAvailability) {
      updateWorkerAvailability(currentWorker.id, newAvail);
    }
  };

  if (showSettings) {
    return (
      <div className="max-w-md mx-auto h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 font-['Outfit',sans-serif]">
        <div className="flex items-center px-2">
          <button 
            onClick={() => setShowSettings(false)} 
            className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer text-sm font-semibold focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1"
            aria-label="Back to Profile"
          >
            <span className="mr-2">←</span> Back to Profile
          </button>
        </div>
        
        <h2 className="text-3xl font-extrabold px-2 text-slate-900 dark:text-slate-100">Settings & Privacy</h2>
        
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-base">Map Visibility</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Display location on interactive map</div>
            </div>
            <button 
              onClick={handleToggleAvailable}
              className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 ${profile.isAvailable !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              aria-label="Toggle map visibility"
            >
              <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-xs transition-transform ${profile.isAvailable !== false ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer border border-slate-200/80 dark:border-slate-700"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Privacy Policy & Terms</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">View data protection & terms</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer border border-rose-200/60 dark:border-rose-900/40 text-rose-600 dark:text-rose-400"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">Delete Account & Data</div>
                  <div className="text-xs text-rose-500/80 dark:text-rose-400/80">Permanently erase profile & merits</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-rose-400" />
            </button>
          </div>
        </div>
        
        <div className="mt-auto pb-4">
          <button 
            onClick={signOut} 
            className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-bold transition-colors cursor-pointer flex items-center justify-center focus-visible:ring-2 focus-visible:ring-slate-400 text-sm"
            aria-label="Sign out of account"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out of Account
          </button>
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
              <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Delete Account & Data?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This action is permanent and irreversible. All your profile information, merits, merit level, and saved rewards will be completely erased.
              </p>
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors cursor-pointer text-sm flex items-center justify-center disabled:opacity-50"
                >
                  {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Yes, Delete My Account
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletingAccount}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer text-sm hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
      </div>
    );
  }

  // BUSINESS ROLE SPECIFIC ANALYTICS DASHBOARD
  if (profile.role === 'Business') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-['Outfit',sans-serif]">
        <BusinessAnalyticsView />
      </div>
    );
  }

  const userWorker: WorkerProfile = matchingWorker || {
    id: user?.uid || 'usr_me',
    name: user?.name || profile.displayName || 'Worker',
    position: profile.position || 'Staff Specialist',
    level: currentLevel,
    initials: (user?.name || 'W').substring(0, 2).toUpperCase(),
    lat: 41.879,
    lng: -87.628,
    role: effectiveRole === 'Worker' ? 'Worker' : 'Customer',
    isAvailable: profile.isAvailable ?? true,
    workplace: profile.workplace || 'FeetTrust Workplace',
  };

  const userBizName = (profile.workplace || '').toLowerCase().trim();
  const userBusiness = (appState.businesses || []).find(
    b => (userBizName && b.name && b.name.toLowerCase().trim() === userBizName)
  );

  return (
    <div className="max-w-xl mx-auto h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-['Outfit',sans-serif]">
      <Toaster position="top-center" toastOptions={{ className: 'bg-slate-900 text-white border border-slate-800 shadow-xl' }} />

      {/* Contextual Header without Title Redundancy */}
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">My Profile</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Verified Merit & Digital Vault</p>
        </div>
        <button 
          onClick={() => setShowSettings(true)} 
          className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-xs"
          aria-label="Open settings and privacy"
        >
          <Settings className="w-6 h-6 text-slate-600 dark:text-slate-300" />
        </button>
      </div>

      {/* Recent Merit Received Notification Banner */}
      {reviews.length > 0 && (
        <div className="bg-linear-to-r from-amber-500 via-indigo-600 to-purple-600 p-0.5 rounded-3xl shadow-lg animate-in fade-in zoom-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[22px] p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800/60 flex items-center">
                <Star className="w-3.5 h-3.5 mr-1 fill-amber-400 text-amber-500" /> NEW MERIT RECEIVED!
              </span>
              <span className="text-xs text-slate-400 font-semibold font-mono">Real-time</span>
            </div>
            <h4 className="font-black text-slate-900 dark:text-slate-100 text-base">
              {reviews[0].fromUserName} awarded you a <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{reviews[0].meritType}</span> Merit!
            </h4>
            {reviews[0].reviewText && (
              <p className="text-xs text-slate-600 dark:text-slate-300 italic mt-1 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                "{reviews[0].reviewText}"
              </p>
            )}
            {reviews[0].tipAmount > 0 && (
              <div className="mt-2 inline-flex items-center text-xs font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 font-mono">
                💰 +${reviews[0].tipAmount} Tip Received
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Header Profile Card */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center relative overflow-hidden backdrop-blur-md">
        {/* Avatar with Camera Icon Overlay */}
        <div 
          className="relative group cursor-pointer" 
          onClick={() => fileInputRef.current?.click()}
          title="Click to update avatar photo"
        >
          <div className="w-28 h-28 rounded-full bg-linear-to-br from-blue-600 via-indigo-600 to-purple-600 p-1 mb-4 transition-transform group-hover:scale-105 shadow-md">
            <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-3xl font-extrabold overflow-hidden relative">
              {profile.avatar ? (
                <img src={profile.avatar} alt="User Avatar" className="w-full h-full object-cover" />
              ) : user?.photoURL ? (
                <img src={user.photoURL} alt="User Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-transparent bg-clip-text bg-linear-to-br from-blue-600 to-indigo-600 font-extrabold font-mono">
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : 'FT'}
                </span>
              )}
              {/* Explicit Camera Icon Overlay on Hover */}
              <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-7 h-7 text-white mb-0.5" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Upload</span>
              </div>
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleImageUpload} 
            aria-label="Upload custom avatar image"
          />
        </div>

        {/* User Name & Editable Pencil Button */}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center justify-center">
          {user?.name || profile.displayName || 'User'}
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className="ml-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Edit display name and position"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </h1>
        
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3">{user?.email || 'user@feetrust.com'}</p>
        
        {/* Verified Role Badge */}
        <div className="mb-4 flex items-center justify-center">
          {effectiveRole === 'Worker' ? (
            <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-2xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
              Verified Worker / Staff Specialist
            </span>
          ) : effectiveRole === 'Business' ? (
            <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 shadow-2xs font-mono">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-purple-600 dark:text-purple-400" />
              Business Workplace Owner
            </span>
          ) : (
            <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-2xs font-mono">
              <Star className="w-3.5 h-3.5 mr-1.5 text-amber-500 fill-amber-400" />
              Customer / Reviewer
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="flex flex-col items-center space-y-2.5 mb-6 w-full max-w-xs animate-in fade-in">
            <input 
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600" 
              value={editPosition} 
              onChange={e => setEditPosition(e.target.value)}
              placeholder="Position / Role Title"
            />
            <input 
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600" 
              value={editWorkplace} 
              onChange={e => setEditWorkplace(e.target.value)}
              placeholder="Workplace / Business"
            />
            <button 
              onClick={handleSaveProfile} 
              className="text-xs bg-linear-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold w-full shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
            >
              Save Profile
            </button>
          </div>
        ) : (
          (effectiveRole === 'Worker' || (profile.workplace && profile.workplace !== 'FeetTrust Workplace')) && (
            <>
              <div className="flex items-center text-sm text-indigo-600 dark:text-indigo-400 font-semibold space-x-3 mb-3">
                <span className="flex items-center"><Building2 className="w-4 h-4 mr-1 text-slate-400" /> {matchingWorker?.position || profile.position || 'Staff Member'}</span>
                <span>•</span>
                <span className="flex items-center"><Star className="w-4 h-4 mr-1 text-amber-500 fill-amber-400" /> {matchingWorker?.workplace || profile.workplace || 'FeetTrust Workplace'}</span>
              </div>

              {/* Availability (on-shift) toggle */}
              <button
                type="button"
                onClick={handleToggleAvailability}
                disabled={savingAvailability}
                aria-pressed={isAvailable}
                aria-label={isAvailable ? 'Mark yourself unavailable for work' : 'Mark yourself available for work'}
                className={`mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold border transition-colors cursor-pointer disabled:opacity-60 ${
                  isAvailable
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {savingAvailability ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                )}
                {isAvailable ? 'Available for work' : 'Unavailable'}
              </button>
            </>
          )
        )}

        {/* Gamified Level & XP Progress Card */}
        <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 my-2 text-left">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-2">
              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-3 py-1 rounded-full text-xs font-extrabold flex items-center shadow-2xs font-mono">
                <Award className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" /> Level {currentLevel}
              </span>
            </div>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold font-mono">
              {currentMerits.toLocaleString()} / {nextLevelMerits.toLocaleString()} Merit Points
            </span>
          </div>

          <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
            <div 
              className="h-full bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Earn {nextLevelMerits - currentMerits} more merit points to reach Level {currentLevel + 1}!</p>
        </div>

        {/* Personal QR, Business QR & Passport Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 mt-4 w-full">
          <button 
            onClick={() => setShowWorkerQrModal(true)}
            className="flex-1 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer font-mono"
            aria-label="Open Personal QR code"
          >
            <QrCode className="w-4 h-4 mr-1.5" /> MY PERSONAL QR
          </button>

          <button 
            onClick={() => setShowQrModal(true)}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-2xl text-xs flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer font-mono"
            aria-label="Open Business QR code"
          >
            <QrCode className="w-4 h-4 mr-1.5 text-amber-500" /> BUSINESS QR
          </button>

          <button 
            onClick={() => setShowPassportModal(true)}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-2xl text-xs flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer font-mono"
            aria-label="Open Digital Vault"
          >
            <ShieldCheck className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400" /> DIGITAL VAULT
          </button>
        </div>
      </div>

      {/* Modals */}
      <WorkerQRModal
        worker={userWorker}
        isOpen={showWorkerQrModal}
        onClose={() => setShowWorkerQrModal(false)}
      />

      <BusinessQRModal
        business={userBusiness}
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        onSelectWorker={() => setShowQrModal(false)}
      />

      <WorkerPassportModal
        worker={userWorker}
        isOpen={showPassportModal}
        onClose={() => setShowPassportModal(false)}
        onGiveMerit={() => setShowPassportModal(false)}
      />

      {/* Simple Share Profile Section */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center">
            <Share2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mr-2" /> Share Profile
          </h3>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
          Share your FeeTrust merit profile link with coworkers, customers, and business managers.
        </p>

        <button
          onClick={handleShareProfile}
          className="w-full py-3.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-2xl flex items-center justify-center text-xs shadow-md hover:opacity-95 transition-all cursor-pointer space-x-2 font-mono"
        >
          <Share2 className="w-4 h-4" />
          <span>Share Profile</span>
        </button>
      </div>

      {/* Merits Received History */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm backdrop-blur-md">
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
          <Award className="w-5 h-5 text-amber-500 mr-2" /> Merit Received
        </h3>
        
        {reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((r, i) => (
              <div key={i} className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800/60">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{r.meritType || 'Merit'} from {r.fromUserName}</div>
                  {r.reviewText && <p className="text-xs text-slate-600 dark:text-slate-300 italic mt-0.5">"{r.reviewText}"</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Star className="w-12 h-12 mx-auto text-amber-300/80 mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Give merits on the map to start earning merit!</p>
          </div>
        )}
      </div>
    </div>
  );
}
