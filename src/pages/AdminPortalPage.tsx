import React, { useState } from 'react';
import { useStore, BusinessProfile, WorkerProfile } from '../lib/store';
import { Shield, Plus, Building, Users, Star, QrCode, Mail, MapPin, CheckCircle2, Lock, ArrowRight, Search, Trash2, Printer, Edit, UserPlus, X, RefreshCw, ChevronRight, Key, Sparkles, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import { geocodeStreetAddress } from '../lib/geocoding';
import { PRICING_PLANS } from '../components/PricingPlansSelector';
import { authHeaders } from '../lib/api';

export default function AdminPortalPage() {
  const { appState, updateState, deleteBusiness, deleteWorker, removeWorkerFromBusiness } = useStore();
  const navigate = useNavigate();
  const isAdmin = appState.profile.role === 'Admin';

  // Navigation sub-tab inside Admin Dashboard
  const [activeTab, setActiveTab] = useState<'businesses' | 'workforce' | 'moderation'>('businesses');

  // Moderation state
  const [modUsers, setModUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const loadModerationUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        setModUsers(Array.isArray(json.users) ? json.users : []);
      }
    } catch { /* ignore */ } finally {
      setLoadingUsers(false);
    }
  };

  const setUserStatus = async (uid: string, status: 'active' | 'suspended') => {
    setPendingUserId(uid);
    try {
      const res = await fetch(`/api/admin/users/${uid}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(status === 'suspended' ? 'Account suspended' : 'Account reactivated');
        setModUsers(prev => prev.map(u => (u.uid === uid ? { ...u, status } : u)));
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || 'Failed to update status');
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setPendingUserId(null);
    }
  };

  const verifyBusiness = async (bizId: string, verified: boolean) => {
    try {
      const res = await fetch(`/api/admin/businesses/${bizId}/verify`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ verified }),
      });
      if (res.ok) toast.success(verified ? 'Business verified' : 'Verification removed');
      else toast.error('Failed to update verification');
    } catch {
      toast.error('Failed to update verification');
    }
  };

  // New Business Form State
  const [bizName, setBizName] = useState('');
  const [bizCategory, setBizCategory] = useState('Food & Beverage');
  const [bizAddress, setBizAddress] = useState('');
  const [bizOwnerEmail, setBizOwnerEmail] = useState('');
  const [bizRating, setBizRating] = useState('4.9');
  const [bizPlan, setBizPlan] = useState('growth');
  const [bizPassword, setBizPassword] = useState('FeeTrust2026!');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Business Modal State for Managing Team
  const [managingBiz, setManagingBiz] = useState<BusinessProfile | null>(null);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerPosition, setNewWorkerPosition] = useState('');

  // QR Modal State
  const [selectedQrUrl, setSelectedQrUrl] = useState<string | null>(null);
  const [selectedQrName, setSelectedQrName] = useState<string>('');

  const filteredBusinesses = (appState?.businesses || []).filter(b =>
    b && (
      (b.name && b.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.category && b.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.address && b.address.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  );

  const filteredWorkers = (appState?.workers || []).filter(w =>
    w && (
      (w.name && w.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (w.position && w.position.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (w.workplace && w.workplace.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  );

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim() || !bizAddress.trim() || !bizOwnerEmail.trim()) {
      toast.error('Store Name, Address, and Owner Email are required');
      return;
    }

    setIsProvisioning(true);
    try {
      const geo = await geocodeStreetAddress(bizAddress.trim());
      const selectedPlanObj = PRICING_PLANS.find(p => p.id === bizPlan) || PRICING_PLANS[1];

      const newId = 'biz_' + Math.random().toString(36).substring(2, 9);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.feetrust.com/business/${newId}`;

      const newBusiness: BusinessProfile = {
        id: newId,
        name: bizName.trim(),
        category: bizCategory,
        address: bizAddress.trim(),
        rating: parseFloat(bizRating) || 4.9,
        qrCodeUrl: qrUrl,
        lat: geo.lat,
        lng: geo.lng,
        location: geo,
        plan: selectedPlanObj.name,
        planPrice: `${selectedPlanObj.priceFormatted} ${selectedPlanObj.period}`,
        employeeLimit: selectedPlanObj.employeeLimit,
        user_id: bizOwnerEmail.trim().toLowerCase(),
        workers: [],
      };

      const newBusinessPin: WorkerProfile = {
        id: newId,
        name: bizName.trim(),
        position: 'Storefront',
        workplace: bizName.trim(),
        category: bizCategory,
        address: bizAddress.trim(),
        level: 5,
        initials: bizName.substring(0, 2).toUpperCase(),
        lat: geo.lat,
        lng: geo.lng,
        role: 'Business',
        isAvailable: true,
      };

      updateState({
        businesses: [newBusiness, ...appState.businesses],
        workers: [newBusinessPin, ...appState.workers],
      });

      // Also persist via REST API if backend is active
      fetch('/api/businesses', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newBusiness),
      }).catch(() => { });

      fetch('/api/workers', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newBusinessPin),
      }).catch(() => { });

      // Auto-provision owner user account for client login
      if (bizPassword.trim()) {
        try {
          await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: bizOwnerEmail.trim().toLowerCase(),
              password: bizPassword.trim(),
              name: `${bizName.trim()} Manager`,
              role: 'Business',
            }),
          });
        } catch (authErr) {
          console.warn('Auto-provision user note:', authErr);
        }
      }

      toast.success(
        `Business "${newBusiness.name}" provisioned on ${selectedPlanObj.name} plan! Credentials: ${bizOwnerEmail} / ${bizPassword}`,
        { duration: 8000 }
      );
      setBizName('');
      setBizAddress('');
      setBizOwnerEmail('');
    } catch (err: any) {
      toast.error('Provisioning error: ' + (err?.message || 'Failed'));
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleDeleteBusiness = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to permanently delete the business account for ${name}? This will unassign its staff members.`)) {
      try {
        await deleteBusiness(id);
        toast.success(`Removed business account for ${name}`);
        if (managingBiz?.id === id) setManagingBiz(null);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to remove business.');
      }
    }
  };

  const handleAddWorkerToBiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingBiz || !newWorkerName.trim() || !newWorkerPosition.trim()) {
      toast.error('Worker Name and Position required');
      return;
    }

    const initials = newWorkerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const newWorker: WorkerProfile = {
      id: 'worker_' + Math.random().toString(36).substring(2, 9),
      name: newWorkerName.trim(),
      position: newWorkerPosition.trim(),
      category: managingBiz.category,
      workplace: managingBiz.name,
      level: 1,
      initials,
      lat: 41.879 + (Math.random() - 0.5) * 0.01,
      lng: -87.628 + (Math.random() - 0.5) * 0.01,
      role: 'Worker',
      isAvailable: true,
    };

    updateState({
      workers: [newWorker, ...appState.workers],
    });

    // Also persist directly to REST backend
    try {
      await fetch('/api/workers', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newWorker),
      });
    } catch (err) { }

    toast.success(`Added ${newWorker.name} to ${managingBiz.name} team!`);
    setNewWorkerName('');
    setNewWorkerPosition('');
  };

  const handleRemoveWorkerFromTeam = async (workerId: string, workerName: string) => {
    if (confirm(`Remove ${workerName} from this business's team?`)) {
      if (managingBiz) {
        await removeWorkerFromBusiness(managingBiz.id, workerId);
      } else {
        await deleteWorker(workerId);
      }
      toast.success(`Removed ${workerName} from team.`);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 animate-in fade-in zoom-in duration-300 font-['Outfit',sans-serif]">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-5 backdrop-blur-md">
          <div className="w-16 h-16 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-3xl flex items-center justify-center mx-auto border border-purple-200 dark:border-purple-800/60">
            <Shield className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60 px-3 py-1 rounded-full text-xs font-bold font-mono inline-block mb-2">
              Admin Access Control
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Administrator Access Required</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">
              The Admin Dashboard is reserved exclusively for FeeTrust Administrators to manage and provision business accounts.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-4 rounded-2xl text-left space-y-2">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Current Account Status:</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">{appState.profile.name}</span>
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                Role: {appState.profile.role}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-3.5 bg-linear-to-r from-purple-600 to-indigo-600 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center shadow-md hover:opacity-95 transition-opacity cursor-pointer"
            >
              Sign In with Admin Credentials <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-['Outfit',sans-serif]">
      <Toaster position="top-center" toastOptions={{ className: 'bg-slate-900 text-white border border-slate-800 shadow-xl' }} />

      {/* Team Management Modal */}
      {managingBiz && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-5 animate-in zoom-in duration-300">
            <div className="flex justify-between items-start">
              <div>
                <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                  {managingBiz.category}
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{managingBiz.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{managingBiz.address}</p>
              </div>
              <button
                onClick={() => setManagingBiz(null)}
                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Worker to Team */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center">
                <UserPlus className="w-4 h-4 mr-1.5 text-purple-600 dark:text-purple-400" /> Assign New Staff Member
              </h4>
              <form onSubmit={handleAddWorkerToBiz} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Full Name (e.g. Liam Smith)"
                  value={newWorkerName}
                  onChange={e => setNewWorkerName(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-600"
                />
                <input
                  type="text"
                  placeholder="Job Title (e.g. Lead Barista)"
                  value={newWorkerPosition}
                  onChange={e => setNewWorkerPosition(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-600"
                />
                <button
                  type="submit"
                  className="bg-purple-600 text-white font-extrabold px-4 py-2 rounded-xl text-xs hover:bg-purple-700 transition-colors shadow-xs cursor-pointer"
                >
                  Add to Team
                </button>
              </form>
            </div>

            {/* Team Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Current Staff Members ({appState.workers.filter(w => w.workplace === managingBiz.name).length})
              </h4>

              {appState.workers.filter(w => w.workplace === managingBiz.name).length > 0 ? (
                appState.workers.filter(w => w.workplace === managingBiz.name).map(w => (
                  <div key={w.id} className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-purple-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs font-mono shrink-0 overflow-hidden">
                        {w.avatar ? (
                          <img src={w.avatar} alt={w.name} className="w-full h-full object-cover" />
                        ) : (
                          w.initials
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{w.name}</p>
                        <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">{w.position}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveWorkerFromTeam(w.id, w.name)}
                      className="text-slate-400 hover:text-rose-600 text-xs font-bold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic py-3 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  No staff members currently assigned to {managingBiz.name}.
                </p>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setManagingBiz(null)}
                className="py-2 px-5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Banner Modal */}
      {selectedQrUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in duration-300">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Business Counter QR Poster</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{selectedQrName}</p>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl">
              <img src={selectedQrUrl} alt="Counter QR Poster" className="w-48 h-48 mx-auto rounded-xl shadow-md border-2 border-white dark:border-slate-800 bg-white" />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.open(selectedQrUrl, '_blank')}
                className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl text-xs flex items-center justify-center hover:bg-purple-700 transition-colors shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4 mr-1.5" /> Print Poster
              </button>
              <button
                onClick={() => setSelectedQrUrl(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linear-to-r from-slate-900 via-purple-950 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-purple-300 uppercase">FEE TRUST SYSTEM MANAGEMENT</span>
              <h1 className="text-2xl font-black tracking-tight">Admin Dashboard & Provisioning Portal</h1>
            </div>
          </div>
          <p className="text-slate-300 text-xs mt-2 max-w-xl">
            Create, provision, manage store teams, and delete business accounts across the FeeTrust platform.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20">
          <button
            onClick={() => setActiveTab('businesses')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${activeTab === 'businesses' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
              }`}
          >
            Businesses ({appState.businesses.length})
          </button>
          <button
            onClick={() => setActiveTab('workforce')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${activeTab === 'workforce' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
              }`}
          >
            Workforce ({appState.workers.length})
          </button>
          <button
            onClick={() => setActiveTab('moderation')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${activeTab === 'moderation' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
              }`}
          >
            Moderation
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Businesses</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">{appState.businesses.length} Stores</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-800/60">
              <Building className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 font-bold mt-2">Provisioned by Admin</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registered Workforce</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">{appState.workers.length} Members</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/60">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold mt-2">100% Available on Map</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer Merits</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">{appState.reviews.length + 24} Merits</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/60">
              <Star className="w-5 h-5 text-emerald-600 dark:text-emerald-400 fill-emerald-400" />
            </div>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-2">Live Merit Feed</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Status</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">Operational ✅</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/60">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-bold mt-2">Postgres & Vercel Verified</p>
        </div>
      </div>

      {activeTab === 'businesses' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Create & Provision Business Account Form (1 col) */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 backdrop-blur-md">
            <div className="flex items-center space-x-2">
              <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Provision New Business</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Create a business account and generate their official store profile.</p>

            <form onSubmit={handleCreateBusiness} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Business Name</label>
                <input
                  type="text"
                  required
                  value={bizName}
                  onChange={e => setBizName(e.target.value)}
                  placeholder="e.g. Philz Coffee Downtown"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Business Category</label>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">Pick offered or type custom</span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    list="category-suggestions"
                    required
                    value={bizCategory}
                    onChange={e => setBizCategory(e.target.value)}
                    placeholder="Select preset or type custom category..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:border-purple-600 shadow-2xs"
                  />
                  <datalist id="category-suggestions">
                    <option value="Food & Beverage">Food & Beverage (Cafes, Restaurants)</option>
                    <option value="Retail & Shopping">Retail & Shopping</option>
                    <option value="Beauty & Salon">Beauty & Salon</option>
                    <option value="Hotels & Hospitality">Hotels & Hospitality</option>
                    <option value="Automotive & Repair">Automotive & Repair</option>
                    <option value="Fitness & Gym">Fitness & Gym</option>
                    <option value="Personal Care & Wellness">Personal Care & Wellness</option>
                    <option value="Entertainment & Venues">Entertainment & Venues</option>
                  </datalist>

                  {/* Offered Category Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'Food & Beverage',
                      'Retail & Shopping',
                      'Beauty & Salon',
                      'Hotels & Hospitality',
                      'Automotive & Repair',
                      'Fitness & Gym'
                    ].map((catOption) => (
                      <button
                        key={catOption}
                        type="button"
                        onClick={() => setBizCategory(catOption)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border ${bizCategory === catOption
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                      >
                        {catOption}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Street Address</label>
                <AddressAutocompleteInput
                  value={bizAddress}
                  onChange={(val) => setBizAddress(val)}
                  placeholder="Start typing street address (e.g. 14100 Weber Dr...)"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:border-purple-600"
                  icon={<MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-600 pointer-events-none" />}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Owner / Manager Email</label>
                <input
                  type="email"
                  required
                  value={bizOwnerEmail}
                  onChange={e => setBizOwnerEmail(e.target.value)}
                  placeholder="e.g. manager@philzcoffee.com"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Subscription Plan Level</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'starter', name: 'Starter', price: '$5/yr', cap: '4 staff' },
                    { id: 'growth', name: 'Growth', price: '$349/yr', cap: '8 staff' },
                    { id: 'business', name: 'Business', price: '$499/yr', cap: '15 staff' },
                    { id: 'enterprise', name: 'Enterprise', price: 'Custom', cap: 'Unlimited' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBizPlan(p.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        bizPlan === p.id
                          ? 'border-purple-600 bg-purple-50/80 dark:bg-purple-950/60 ring-2 ring-purple-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">{p.name}</span>
                        <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 font-mono">{p.price}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">{p.cap}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Owner Login Password <span className="text-slate-400 font-normal lowercase">(for client to sign in)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={bizPassword}
                    onChange={e => setBizPassword(e.target.value)}
                    placeholder="Set temporary password..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-3 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-purple-600"
                  />
                  <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-600 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Client can log in at <code className="text-purple-600 dark:text-purple-400 font-bold">/auth</code> using their email & this password.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Initial Merit Level</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={bizRating}
                  onChange={e => setBizRating(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:border-purple-600"
                />
              </div>

              <button
                type="submit"
                disabled={isProvisioning}
                className="w-full py-3.5 bg-linear-to-r from-purple-600 to-indigo-600 text-white font-extrabold rounded-xl text-xs flex items-center justify-center shadow-md hover:opacity-95 transition-opacity cursor-pointer mt-2 disabled:opacity-50"
              >
                {isProvisioning ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Provisioning & Geocoding Map Pin...
                  </>
                ) : (
                  <>
                    <Building className="w-4 h-4 mr-2" /> Create & Provision Business
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Directory of Businesses (2 cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Manage Businesses ({filteredBusinesses.length})</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Admin tools to edit teams, print counter QR codes, or delete accounts</p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search businesses..."
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-600 w-full sm:w-56"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {filteredBusinesses.length > 0 ? (
                filteredBusinesses.map(b => {
                  const workerCount = appState.workers.filter(w => w.workplace === b.name).length;
                  return (
                    <div key={b.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-purple-600 to-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                          <Building className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{b.name}</h4>
                            <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/60">
                              Verified
                            </span>
                            {b.plan && (
                              <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/60 font-mono">
                                {b.plan}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-purple-600 dark:text-purple-400 font-bold">{b.category}</p>
                          <p className="text-[11px] text-slate-400 font-medium flex items-center mt-0.5">
                            <MapPin className="w-3 h-3 mr-1 text-slate-400" /> {b.address}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap justify-end">
                        <button
                          onClick={() => setManagingBiz(b)}
                          className="bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/40 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center transition-colors cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5 mr-1" /> View Team ({workerCount})
                        </button>

                        <button
                          onClick={() => {
                            setSelectedQrUrl(b.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.feetrust.com/business/${b.id}`);
                            setSelectedQrName(b.name);
                          }}
                          className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1" /> Counter QR
                        </button>

                        <button
                          onClick={() => handleDeleteBusiness(b.id, b.name)}
                          className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/40 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center transition-colors cursor-pointer"
                          title="Delete Business Account"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs">
                  No business accounts found matching your search.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'workforce' ? (
        /* Workforce Directory View */
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Platform Workforce Directory ({filteredWorkers.length})</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Admin view of all registered workers across all businesses</p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search staff members..."
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-600 w-full sm:w-56"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredWorkers.map(w => (
              <div key={w.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-purple-600 to-indigo-600 text-white font-black flex items-center justify-center text-xs shadow-xs font-mono shrink-0 overflow-hidden">
                    {w.avatar ? (
                      <img src={w.avatar} alt={w.name} className="w-full h-full object-cover" />
                    ) : (
                      w.initials
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{w.name}</h4>
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-bold">{w.position}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">📍 {w.workplace || 'Unassigned'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-bold font-mono text-[10px]">
                    Lvl {w.level}
                  </span>
                  <button
                    onClick={() => handleRemoveWorkerFromTeam(w.id, w.name)}
                    className="text-rose-600 dark:text-rose-400 font-bold hover:underline text-[11px] cursor-pointer"
                  >
                    Remove Staff
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Moderation View */
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Account Moderation ({modUsers.length})</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Suspend abusive accounts or reinstate them. Suspended users cannot sign in.</p>
            </div>
            <button
              onClick={loadModerationUsers}
              disabled={loadingUsers}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-extrabold hover:bg-purple-700 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loadingUsers ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Shield className="w-3.5 h-3.5 mr-1.5" />}
              Load Accounts
            </button>
          </div>

          {modUsers.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No accounts loaded</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Click "Load Accounts" to review registered users.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {modUsers.map(u => (
                <div key={u.uid} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{u.name || 'Unnamed'} <span className="text-xs font-mono text-slate-400">· {u.role}</span></p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                    <span className={`inline-block mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      u.status === 'suspended'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {u.status === 'suspended' ? 'SUSPENDED' : 'ACTIVE'}
                    </span>
                  </div>
                  <button
                    onClick={() => setUserStatus(u.uid, u.status === 'suspended' ? 'active' : 'suspended')}
                    disabled={pendingUserId === u.uid}
                    className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-60 ${
                      u.status === 'suspended'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-rose-600 text-white hover:bg-rose-700'
                    }`}
                  >
                    {pendingUserId === u.uid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
