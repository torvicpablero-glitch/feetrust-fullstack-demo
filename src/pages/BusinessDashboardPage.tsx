import React, { useState } from 'react';
import { useStore, WorkerProfile, BusinessProfile, isWorkerManagerAffiliated } from '../lib/store';
import { Building, Users, Star, QrCode, Plus, Download, Printer, CheckCircle2, TrendingUp, Award, Shield, Search, ArrowUpRight, Lock, UserCheck, ArrowRight, Mail, Share2, Copy, Sparkles, MapPin, Check, Sliders, DollarSign, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import PrintableQRPosterModal from '../components/PrintableQRPosterModal';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import PricingPlansModal from '../components/PricingPlansModal';
import BusinessInviteModal from '../components/BusinessInviteModal';
import BusinessMeritsAnalyticsModal from '../components/BusinessMeritsAnalyticsModal';
import { PricingPlan } from '../components/PricingPlansSelector';
import { geocodeStreetAddress } from '../lib/geocoding';
import { authHeaders } from '../lib/api';

export default function BusinessDashboardPage() {
  const { appState, user, updateState, removeWorkerFromBusiness, approveWorkerToRoster } = useStore();
  const navigate = useNavigate();
  const isBusinessUser = appState.profile.role === 'Business';

  const userBizName = (appState.profile?.workplace || '').toLowerCase().trim();
  const userOwnedBusinesses = (appState.businesses || []).filter(
    b => (b && b.name && b.name.toLowerCase().trim() === userBizName) || ((b as any)?.user_id && (b as any).user_id === user?.uid)
  );

  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(() => {
    return userOwnedBusinesses[0]?.id || (appState.businesses || []).find(b => b && b.name && b.name.toLowerCase().trim() === userBizName)?.id || appState.businesses?.[0]?.id || 'biz_primary';
  });
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showMeritsAnalyticsModal, setShowMeritsAnalyticsModal] = useState(false);

  // New worker form state
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerPosition, setNewWorkerPosition] = useState('');
  const [newWorkerCategory, setNewWorkerCategory] = useState('Baristas');

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Claim Business state
  const [claimName, setClaimName] = useState('');
  const [claimCategory, setClaimCategory] = useState('Food & Beverage');
  const [claimAddress, setClaimAddress] = useState('');
  const [claimLatLng, setClaimLatLng] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [claiming, setClaiming] = useState(false);

  const handleRemoveWorker = async (workerId: string, workerName: string) => {
    if (window.confirm(`Are you sure you want to remove ${workerName} from ${currentBusiness.name}'s team? This will free up 1 employee seat.`)) {
      await removeWorkerFromBusiness(currentBusiness.id, workerId);
      toast.success(`Removed ${workerName} from team.`);
    }
  };

  const currentBusiness = (appState.businesses || []).find(b => b && (
    (selectedBusinessId && b.id === selectedBusinessId) ||
    (userBizName && b.name && b.name.toLowerCase().trim() === userBizName) ||
    ((b as any)?.user_id && (b as any).user_id === user?.uid)
  )) || userOwnedBusinesses[0] || (appState.businesses || [])[0] || {
    id: 'biz_' + (user?.uid || '1'),
    name: appState.profile?.workplace || 'My Business',
    category: appState.profile?.position || 'Service & Hospitality',
    address: appState.profile?.address || 'Registered Address',
    rating: 5.0,
    lat: appState.profile?.lat || appState.profile?.location?.lat,
    lng: appState.profile?.lng || appState.profile?.location?.lng,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/biz_${user?.uid || '1'}`,
    workers: [],
  };

  const cleanBizName = (currentBusiness.name || '').toLowerCase().trim();

  // ONLY workers who registered via the business manager's official invite link
  // appear on the business management dashboard roster and take employee seats.
  const combinedMap = new Map<string, WorkerProfile>();

  // 1. Explicit business roster (invited staff saved on the business record)
  (currentBusiness.workers || []).forEach(w => {
    if (w && w.id && w.role !== 'Business' && w.id !== currentBusiness.id && (w.name || '').toLowerCase().trim() !== cleanBizName) {
      combinedMap.set(w.id, w);
    }
  });

  // 2. Global workers who have officially registered via manager invite
  (appState.workers || []).forEach(w => {
    if (w && isWorkerManagerAffiliated(w, currentBusiness)) {
      combinedMap.set(w.id, w);
    }
  });

  const businessWorkers = Array.from(combinedMap.values());
  const pendingWorkers = businessWorkers.filter(w => w.rosterStatus === 'pending');
  const activeWorkers = businessWorkers.filter(w => w.rosterStatus !== 'pending');
  const businessActivity = (appState.activityFeed || []).filter(
    a => a && a.businessName && (
      a.businessName.toLowerCase().trim() === cleanBizName ||
      (userBizName && a.businessName.toLowerCase().trim() === userBizName)
    )
  );

  const handlePlanSelect = (plan: PricingPlan) => {
    const updatedBusinesses = (appState.businesses || []).map(b => {
      if (b && (b.id === currentBusiness.id || (b.name && b.name.toLowerCase().trim() === cleanBizName))) {
        return {
          ...b,
          plan: plan.name,
          planPrice: `${plan.priceFormatted} ${plan.period}`,
          employeeLimit: plan.employeeLimit,
        };
      }
      return b;
    });

    updateState({
      businesses: updatedBusinesses,
      profile: {
        ...appState.profile,
        plan: plan.name,
        planPrice: `${plan.priceFormatted} ${plan.period}`,
        employeeLimit: plan.employeeLimit,
      }
    });

    toast.success(`Plan updated to ${plan.name} (${plan.priceFormatted}${plan.period})!`);
    setShowPricingModal(false);
  };

  const handleExportReport = () => {
    if (!businessWorkers.length) {
      toast.error('No staff members registered under this business to export.');
      return;
    }

    const headers = ['Name', 'Role/Position', 'Category', 'Merit Received', 'Merit Level', 'Status'];
    const rows = businessWorkers.map(w => [
      `"${w.name}"`,
      `"${w.position || 'Staff'}"`,
      `"${w.category || 'General'}"`,
      w.meritsReceived || w.merits || 0,
      w.level || 5,
      w.isAvailable ? 'Active' : 'Offline'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${cleanBizName.replace(/\s+/g, '_')}_staff_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Team CSV report downloaded successfully!');
  };

  const handleAddWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName.trim() || !newWorkerPosition.trim()) {
      toast.error('Worker name and position are required');
      return;
    }

    const employeeLimit = currentBusiness.employeeLimit || 4;
    if (businessWorkers.length >= employeeLimit) {
      toast.error(`Staff Limit Reached: Your ${currentBusiness.plan || 'Starter'} plan allows up to ${employeeLimit} employees. Please upgrade your plan to add more staff.`);
      setShowPricingModal(true);
      setShowAddWorkerModal(false);
      return;
    }

    const initials = newWorkerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const newWorker: WorkerProfile = {
      id: 'worker_' + Math.random().toString(36).substring(2, 9),
      name: newWorkerName.trim(),
      position: newWorkerPosition.trim(),
      category: newWorkerCategory,
      workplace: currentBusiness.name,
      level: 1,
      initials,
      lat: currentBusiness.lat || (currentBusiness as any).location?.lat || 41.879,
      lng: currentBusiness.lng || (currentBusiness as any).location?.lng || -87.628,
      role: 'Worker',
      isAvailable: true,
    };

    const updatedWorkers = [newWorker, ...appState.workers];
    const updatedBusinesses = (appState.businesses || []).map(b => {
      if (b && (b.id === currentBusiness.id || (b.name && b.name.toLowerCase().trim() === cleanBizName))) {
        const currentList = b.workers || [];
        return {
          ...b,
          workers: [newWorker, ...currentList.filter(w => w.id !== newWorker.id && w.name.toLowerCase().trim() !== newWorker.name.toLowerCase().trim())]
        };
      }
      return b;
    });

    updateState({
      workers: updatedWorkers,
      businesses: updatedBusinesses,
    });

    // Persist to REST backend
    try {
      fetch('/api/workers', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newWorker),
      }).catch(() => { });

      fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentBusiness,
          workers: [newWorker, ...(currentBusiness.workers || []).filter(w => w.id !== newWorker.id && w.name.toLowerCase().trim() !== newWorker.name.toLowerCase().trim())]
        }),
      }).catch(() => { });
    } catch (e) { }

    toast.success(`Added ${newWorker.name} to ${currentBusiness.name} team!`);
    setNewWorkerName('');
    setNewWorkerPosition('');
    setShowAddWorkerModal(false);
  };

  const generateBusinessInviteUrl = (biz: typeof currentBusiness) => {
    const cleanBizName = (biz.name || '').trim() || 'Your Business';
    const bizPayload = {
      id: biz.id || ('biz_' + Math.random().toString(36).substring(2, 9)),
      name: cleanBizName,
      address: (biz.address || '').trim(),
      lat: biz.lat || (biz as any).location?.lat,
      lng: biz.lng || (biz as any).location?.lng,
      category: biz.category || 'Food & Beverage',
      plan: biz.plan || 'Starter',
      employeeLimit: biz.employeeLimit || 4,
      managerInvite: true,
      inviteToken: `ft_inv_${biz.id || 'biz'}_${Date.now()}`,
    };
    let bizDataParam = '';
    try {
      bizDataParam = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(bizPayload)))));
    } catch (e) {
      bizDataParam = encodeURIComponent(JSON.stringify(bizPayload));
    }
    return `${window.location.origin}/auth?joinWorkplace=${encodeURIComponent(cleanBizName)}&bizData=${bizDataParam}`;
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const recipient = inviteEmail.trim();
    const inviteUrl = generateBusinessInviteUrl(currentBusiness);
    const subject = encodeURIComponent(`Staff Invitation: Join ${currentBusiness.name} on FeeTrust`);
    const body = encodeURIComponent(
      `Hello!\n\nYou have been invited by ${currentBusiness.name} to join our team on FeeTrust.\n\nFeeTrust allows you to collect verified merits, tips, and build your portable workplace passport.\n\nClick the link below to accept your invitation and complete your staff profile:\n${inviteUrl}\n\nWelcome to the team!\n- ${currentBusiness.name}`
    );

    // Also copy to clipboard for convenience
    try {
      navigator.clipboard.writeText(inviteUrl);
    } catch (err) { }

    // Trigger user mail client with pre-filled invitation
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;

    toast.success(`Opening email client to send invite to ${recipient}! Link copied to clipboard.`);
    setInviteEmail('');
    setShowInviteModal(false);
  };

  const handleNativeShare = async () => {
    const inviteUrl = generateBusinessInviteUrl(currentBusiness);
    const text = `Join ${currentBusiness.name} team on FeeTrust! Accept your invitation here:`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${currentBusiness.name} on FeeTrust`,
          text: text,
          url: inviteUrl,
        });
        toast.success("Shared staff invitation link!");
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          navigator.clipboard.writeText(`${text} ${inviteUrl}`);
          toast.success("Link copied! Share via Instagram, WhatsApp, Messages, or Snapchat.");
        }
      }
    } else {
      navigator.clipboard.writeText(`${text} ${inviteUrl}`);
      toast.success("Invite message & link copied! Ready to paste into Instagram, WhatsApp, Snapchat, or Messages.");
    }
  };

  const handleShareApp = (platform: 'whatsapp' | 'sms' | 'facebook' | 'copy') => {
    const inviteUrl = generateBusinessInviteUrl(currentBusiness);
    const text = `Join ${currentBusiness.name} team on FeeTrust! Claim your staff profile here: ${inviteUrl}`;

    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'sms') {
      window.open(`sms:?&body=${encodeURIComponent(text)}`, '_self');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`, '_blank');
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Invite message copied! Open Instagram or Snapchat to send via DM or Story.");
    }
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = generateBusinessInviteUrl(currentBusiness);
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    toast.success("Workplace invitation link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimName.trim() || !claimAddress.trim()) {
      toast.error('Business Name and Address are required.');
      return;
    }

    setClaiming(true);
    try {
      let lat = claimLatLng?.lat;
      let lng = claimLatLng?.lng;
      if (!lat || !lng) {
        const point = await geocodeStreetAddress(claimAddress.trim());
        lat = point.lat;
        lng = point.lng;
      }

      const newBizId = 'biz_' + Math.random().toString(36).substring(2, 9);
      const newBiz: BusinessProfile = {
        id: newBizId,
        name: claimName.trim(),
        category: claimCategory,
        address: claimAddress.trim(),
        rating: 5.0,
        lat,
        lng,
        location: (lat && lng) ? { lat, lng } : undefined,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/${newBizId}`,
        workers: [],
      };

      const newBizPin: WorkerProfile = {
        id: newBizId,
        name: claimName.trim(),
        position: claimCategory || 'Business',
        workplace: claimName.trim(),
        address: claimAddress.trim(),
        level: 5,
        initials: claimName.trim().substring(0, 2).toUpperCase(),
        lat,
        lng,
        role: 'Business',
        isAvailable: true,
      };

      updateState({
        businesses: [newBiz, ...appState.businesses],
        workers: [newBizPin, ...appState.workers],
        profile: {
          ...appState.profile,
          workplace: claimName.trim(),
          address: claimAddress.trim(),
          location: { lat, lng },
        }
      });

      // Persist permanently to API & Supabase database
      fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBiz),
      }).catch(() => { });

      setSelectedBusinessId(newBizId);
      toast.success(`Successfully claimed and registered ${claimName.trim()} on FeeTrust Map!`);
      setShowClaimModal(false);
      setClaimName('');
      setClaimAddress('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim business.');
    } finally {
      setClaiming(false);
    }
  };

  if (!isBusinessUser) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 animate-in fade-in zoom-in duration-300 font-['Outfit',sans-serif]">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-5 backdrop-blur-md">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-3xl flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800/60">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 px-3 py-1 rounded-full text-xs font-bold font-mono inline-block mb-2">
              Business Account Required
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Business Access Only</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">
              The Business Manager Dashboard is reserved exclusively for registered business accounts to manage team members and counter QR codes.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-4 rounded-2xl text-left space-y-2">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Current Logged-in Account:</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">{appState.profile.name}</span>
              <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 px-2.5 py-0.5 rounded-full font-bold">
                Role: {appState.profile.role}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-3.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center shadow-md hover:opacity-95 transition-opacity cursor-pointer"
            >
              Sign In with Authorized Account <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-['Outfit',sans-serif]">
      <Toaster position="top-center" toastOptions={{ className: 'bg-slate-900 text-white border border-slate-800 shadow-xl' }} />

      {/* Invite Staff Member Modal with Capacity Limit Enforcement */}
      {showInviteModal && (
        <BusinessInviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          businessId={currentBusiness.id}
          businessName={currentBusiness.name}
          businessAddress={currentBusiness.address}
          businessCategory={currentBusiness.category}
          businessLat={currentBusiness.lat || (currentBusiness as any).location?.lat}
          businessLng={currentBusiness.lng || (currentBusiness as any).location?.lng}
          employeeLimit={currentBusiness.employeeLimit || 4}
          currentStaffCount={businessWorkers.length}
          planName={currentBusiness.plan || 'Starter'}
          onOpenPricingModal={() => setShowPricingModal(true)}
        />
      )}

      {/* Claim / Register Business Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center">
              <Building className="w-5 h-5 mr-2 text-rose-600" /> Claim / Register Business
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">Officially register your business on the FeeTrust live merit map.</p>

            <form onSubmit={handleClaimSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Business Name</label>
                <input
                  type="text"
                  required
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  placeholder="e.g. Apex Coffee Roasters"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Category</label>
                <select
                  value={claimCategory}
                  onChange={(e) => setClaimCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-600 font-medium"
                >
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="Retail & Grocery">Retail & Grocery</option>
                  <option value="Hospitality & Hotels">Hospitality & Hotels</option>
                  <option value="Personal Care & Beauty">Personal Care & Beauty</option>
                  <option value="Services & Support">Services & Support</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Street Address</label>
                <AddressAutocompleteInput
                  value={claimAddress}
                  onChange={(val, latLng) => {
                    setClaimAddress(val);
                    if (latLng) setClaimLatLng(latLng);
                  }}
                  placeholder="Start typing street address..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={claiming}
                  className="flex-1 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-sm hover:opacity-95 transition-opacity shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {claiming ? 'Geocoding & Claiming...' : 'Claim & Pin on Map'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Worker Modal */}
      {showAddWorkerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center">
              <Users className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" /> Add New Staff Member
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">Add a team member to {currentBusiness.name}'s public team merit profile.</p>

            <form onSubmit={handleAddWorkerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Worker Full Name</label>
                <input
                  type="text"
                  required
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  placeholder="e.g. Maya Lin"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Job Title / Role</label>
                <input
                  type="text"
                  required
                  value={newWorkerPosition}
                  onChange={(e) => setNewWorkerPosition(e.target.value)}
                  placeholder="e.g. Senior Barista"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Category</label>
                <select
                  value={newWorkerCategory}
                  onChange={(e) => setNewWorkerCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-600 font-medium"
                >
                  <option value="Baristas">Baristas</option>
                  <option value="Waiters">Waiters & Servers</option>
                  <option value="Support">Customer Support</option>
                  <option value="Stylists">Stylists & Personal Care</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWorkerModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-sm hover:opacity-95 transition-opacity shadow-md cursor-pointer"
                >
                  Add Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Building className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Business Manager Dashboard</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage team members, printable QR codes, and staff merit metrics</p>
        </div>

        {/* Action Header Buttons & Business Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPricingModal(true)}
            className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 rounded-2xl text-xs font-extrabold flex items-center hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" /> Plans & Pricing
          </button>

          <button
            onClick={handleExportReport}
            className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-extrabold flex items-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Export CSV
          </button>

          <button
            onClick={() => setShowClaimModal(true)}
            className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-extrabold flex items-center hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
          >
            <Building className="w-3.5 h-3.5 mr-1.5 text-rose-600" /> Claim Store
          </button>

          <button
            onClick={() => setShowInviteModal(true)}
            className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 rounded-2xl text-xs font-extrabold flex items-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 mr-1.5 text-indigo-600" /> Invite Staff
          </button>

          {userOwnedBusinesses.length > 1 ? (
            <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-xs">
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider pl-2 font-mono">Store:</label>
              <select
                value={selectedBusinessId}
                onChange={(e) => setSelectedBusinessId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
              >
                {userOwnedBusinesses.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-2xl shadow-xs">
              <Building className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="text-xs font-black text-slate-900 dark:text-slate-100">{currentBusiness.name}</span>
              <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-md">
                My Store
              </span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative overflow-hidden backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Team</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
                {activeWorkers.length} / {currentBusiness.employeeLimit || 4} <span className="text-sm font-sans font-normal text-slate-400">Seats</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/60">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] font-bold">
            <span className="text-indigo-600 dark:text-indigo-400">
              {Math.max(0, (currentBusiness.employeeLimit || 4) - activeWorkers.length)} slots left on {currentBusiness.plan || 'Starter'}
            </span>
            <button
              type="button"
              onClick={() => setShowPricingModal(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Change Plan
            </button>
          </div>
        </div>

        <div
          onClick={() => setShowMeritsAnalyticsModal(true)}
          className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500/70 p-5 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden backdrop-blur-md cursor-pointer group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setShowMeritsAnalyticsModal(true)}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-1.5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer Merits</p>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {businessActivity.length} Merits
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/60 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-xs">
              <Award className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 flex-wrap gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMeritsAnalyticsModal(true);
              }}
              className="text-[11px] text-emerald-700 dark:text-emerald-300 font-extrabold inline-flex items-center bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/80 transition-colors cursor-pointer group/pill"
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400 group-hover/pill:scale-110 transition-transform" />
              <span>{businessActivity.length > 0 ? `${businessActivity.length} verified merits` : 'Awaiting first recognition'}</span>
              <ArrowUpRight className="w-3 h-3 ml-1 text-emerald-600 dark:text-emerald-400 opacity-70 group-hover/pill:translate-x-0.5 group-hover/pill:-translate-y-0.5 transition-transform" />
            </button>

            <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center">
              View Insights <ChevronRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative overflow-hidden backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Status</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {(currentBusiness as any).verified ? 'Verified ✅' : 'Active Workplace'}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/60">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-bold mt-3 inline-block">
            {(currentBusiness as any).verified ? 'FeeTrust Verified Partner Badge' : 'FeeTrust Registered Workplace'}
          </span>
        </div>
      </div>

      {/* Main Grid: Staff Team + Counter QR Printable Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Staff Team Table (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Team ({businessWorkers.length})</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Employees registered at {currentBusiness.name}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 mr-1" /> Invite Staff
              </button>

              <button
                onClick={() => setShowAddWorkerModal(true)}
                className="bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center shadow-xs hover:opacity-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Staff Member
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {pendingWorkers.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  Pending approvals ({pendingWorkers.length})
                </p>
                {pendingWorkers.map(w => (
                  <div key={w.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{w.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{w.position} · joined via invite</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => { await approveWorkerToRoster(currentBusiness.id, w.id); toast.success(`Approved ${w.name}`); }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveWorker(w.id, w.name)}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeWorkers.length > 0 ? (
              activeWorkers.map(w => (
                <div key={w.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-xs overflow-hidden font-mono">
                      {w.avatar ? (
                        <img src={w.avatar} alt={w.name} className="w-full h-full object-cover" />
                      ) : (
                        w.initials
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{w.name}</h4>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">{w.position}</p>
                      <p className="text-[11px] text-slate-400 font-medium">Category: {w.category || 'General'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 rounded-full text-xs font-bold font-mono">
                      Lvl {w.level}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveWorker(w.id, w.name)}
                      title="Remove staff member from team"
                      className="text-[11px] font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs space-y-2">
                <p className="font-semibold text-slate-700 dark:text-slate-300">No staff members registered under this business yet.</p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                >
                  + Invite employee via email or QR link
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Counter QR Printable Poster Card */}
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4 text-center backdrop-blur-md">
          <div>
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-200 dark:border-amber-800/60">
              <QrCode className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Business Counter QR Banner</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Display at register/counter for instant customer merit scans.</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 border border-dashed border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 text-center space-y-3">
            <img
              src={currentBusiness.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.feetrust.com/business/${currentBusiness.id}`}
              alt="Business Counter QR Code"
              className="w-44 h-44 mx-auto rounded-xl border-2 border-white dark:border-slate-800 shadow-md object-contain bg-white"
            />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{currentBusiness.name}</p>
            <p className="text-[11px] text-slate-400 font-mono">{currentBusiness.address}</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => setShowPrintModal(true)}
              className="w-full py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-xs flex items-center justify-center shadow-sm hover:opacity-95 transition-opacity cursor-pointer font-mono"
            >
              <Printer className="w-4 h-4 mr-2" /> Customize & Print Poster
            </button>
          </div>
        </div>
      </div>

      {/* Business Map Location & Pin Preview Card */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800/60">
              <MapPin className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center">
                Business Map Pin Location
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentBusiness.address || 'Address not configured'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowClaimModal(true)}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 mr-1 text-indigo-500" /> Edit Address & Pin
            </button>

            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-xs flex items-center shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
            >
              View on Live Merit Map <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>

        {/* Embedded Map Visual Banner */}
        <div className="relative w-full h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center">
          <div className="absolute inset-0 bg-linear-to-tr from-slate-900/60 via-slate-900/20 to-transparent z-10 pointer-events-none" />

          {/* Map Tile Graphic / Static Preview */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] bg-size-[16px_16px]" />

          {/* Pulsing Live Pin Marker */}
          <div className="relative z-20 flex flex-col items-center animate-bounce">
            <div className="w-12 h-12 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-xl border-2 border-white ring-4 ring-rose-500/30">
              <Building className="w-6 h-6" />
            </div>
            <div className="bg-slate-900/90 text-white text-[11px] font-bold px-3 py-1 rounded-full mt-2 shadow-lg backdrop-blur-xs border border-slate-700 font-mono">
              📍 {currentBusiness.name}
            </div>
          </div>

          <div className="absolute bottom-3 left-3 z-20 flex items-center space-x-2">
            <span className="bg-emerald-500/90 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-400/40 shadow-sm flex items-center">
              <Check className="w-3 h-3 mr-1" /> Pin Active on Live Map
            </span>
            <span className="bg-slate-950/80 text-slate-300 text-[10px] font-mono px-2.5 py-1 rounded-full border border-slate-800">
              Google Maps Enabled
            </span>
          </div>
        </div>
      </div>

      {/* Printable Poster Customizer Modal */}
      <PrintableQRPosterModal
        business={currentBusiness}
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
      />

      {/* Subscription Pricing Plans Modal */}
      <PricingPlansModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        selectedPlanId={
          currentBusiness.plan?.toLowerCase().includes('starter') || currentBusiness.plan === 'INITIAL PLAN' || currentBusiness.plan === 'starter' || currentBusiness.plan === 'initial'
            ? 'starter'
            : currentBusiness.plan?.toLowerCase().includes('business') || currentBusiness.plan === 'BUSINESS PLAN' || currentBusiness.plan === 'business'
              ? 'business'
              : 'growth'
        }
        onPlanSelected={handlePlanSelect}
      />

      {/* Customer Merits & Performance Analytics Modal */}
      {showMeritsAnalyticsModal && (
        <BusinessMeritsAnalyticsModal
          isOpen={showMeritsAnalyticsModal}
          onClose={() => setShowMeritsAnalyticsModal(false)}
          businessName={currentBusiness.name}
          businessWorkers={businessWorkers}
          reviews={appState.reviews}
          activityFeed={appState.activityFeed}
        />
      )}
    </div>
  );
}
