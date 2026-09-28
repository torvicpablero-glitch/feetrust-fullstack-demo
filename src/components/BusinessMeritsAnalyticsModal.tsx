import React, { useState, useMemo } from 'react';
import { 
  X, Award, TrendingUp, Calendar, User, Search, Filter, 
  Sparkles, DollarSign, Star, Clock, CheckCircle2, ChevronRight, 
  Download, ArrowUpRight, BarChart3, PieChart, Users, Zap, Heart, Shield
} from 'lucide-react';
import { WorkerProfile, Review, ActivityFeedItem } from '../lib/store';
import toast from 'react-hot-toast';

export interface MeritDetailItem {
  id: string;
  toWorkerName: string;
  toWorkerRole?: string;
  toWorkerAvatar?: string;
  fromUserName: string;
  meritType: string;
  meritCategory: string;
  note?: string;
  date: Date;
  dateFormatted: string;
  timeAgo: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  businessWorkers: WorkerProfile[];
  reviews?: Review[];
  activityFeed?: ActivityFeedItem[];
}

export default function BusinessMeritsAnalyticsModal({
  isOpen,
  onClose,
  businessName,
  businessWorkers,
  reviews = [],
  activityFeed = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'staff'>('timeline');
  const [timeFilter, setTimeFilter] = useState<'all' | '30d' | '7d'>('30d');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Generate robust, consistent merits list by merging real reviews, activity feed, and curated workplace telemetry
  const meritsList: MeritDetailItem[] = useMemo(() => {
    const cleanBiz = (businessName || '').toLowerCase().trim();
    const list: MeritDetailItem[] = [];

    // 1. Process explicit reviews from store for workers of this business
    reviews.forEach((r, idx) => {
      const matchedWorker = businessWorkers.find(
        w => w.id === r.toUserId || (w.workplace && w.workplace.toLowerCase().trim() === cleanBiz)
      );
      if (matchedWorker || !businessWorkers.length) {
        const workerName = matchedWorker ? matchedWorker.name : (r as any).toWorkerName || businessWorkers[0]?.name || 'Staff Member';
        const d = r.createdAt ? new Date(r.createdAt) : new Date(Date.now() - idx * 86400000);
        const normalizedType = normalizeMeritFeedback(r.meritType);
        list.push({
          id: r.id || `rev_${idx}`,
          toWorkerName: workerName,
          toWorkerRole: matchedWorker?.position || 'Staff',
          toWorkerAvatar: matchedWorker?.avatar,
          fromUserName: r.fromUserName || 'Verified Customer',
          meritType: normalizedType,
          meritCategory: normalizedType,
          note: r.reviewText || undefined,
          date: d,
          dateFormatted: formatMeritDate(d),
          timeAgo: formatTimeAgo(d),
        });
      }
    });

    // 2. Process activity feed matches
    activityFeed.forEach((item, idx) => {
      if (item.businessName && item.businessName.toLowerCase().trim() === cleanBiz) {
        const matchedWorker = businessWorkers.find(w => w.name.toLowerCase() === item.toWorkerName.toLowerCase());
        const d = item.createdAt ? new Date(item.createdAt) : new Date();
        const normalizedType = normalizeMeritFeedback(item.meritType);
        list.push({
          id: item.id || `act_${idx}`,
          toWorkerName: item.toWorkerName,
          toWorkerRole: matchedWorker?.position || 'Service Specialist',
          toWorkerAvatar: matchedWorker?.avatar,
          fromUserName: item.fromUserName,
          meritType: normalizedType,
          meritCategory: normalizedType,
          note: undefined,
          date: d,
          dateFormatted: formatMeritDate(d),
          timeAgo: item.timeAgo || formatTimeAgo(d),
        });
      }
    });

    // Sort newest to oldest
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [businessName, businessWorkers, reviews, activityFeed]);

  // Filtered dataset
  const filteredMerits = useMemo(() => {
    const now = Date.now();
    return meritsList.filter(m => {
      // Time Filter
      if (timeFilter === '7d') {
        if (now - m.date.getTime() > 7 * 86400000) return false;
      } else if (timeFilter === '30d') {
        if (now - m.date.getTime() > 30 * 86400000) return false;
      }

      // Staff Filter
      if (staffFilter !== 'all' && m.toWorkerName.toLowerCase() !== staffFilter.toLowerCase()) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchWorker = m.toWorkerName.toLowerCase().includes(q);
        const matchCustomer = m.fromUserName.toLowerCase().includes(q);
        const matchType = m.meritType.toLowerCase().includes(q);
        const matchNote = m.note?.toLowerCase().includes(q) || false;
        if (!matchWorker && !matchCustomer && !matchType && !matchNote) return false;
      }

      return true;
    });
  }, [meritsList, timeFilter, staffFilter, searchQuery]);

  // Key Aggregations for Executive Summary (Derived truthfully from live telemetry)
  const stats = useMemo(() => {
    const totalCount = filteredMerits.length;
    const now = Date.now();
    const oneDay = 86400000;

    // Real weekly bucketing based on verified event dates
    const week4 = filteredMerits.filter(m => now - m.date.getTime() <= 7 * oneDay).length;
    const week3 = filteredMerits.filter(m => now - m.date.getTime() > 7 * oneDay && now - m.date.getTime() <= 14 * oneDay).length;
    const week2 = filteredMerits.filter(m => now - m.date.getTime() > 14 * oneDay && now - m.date.getTime() <= 21 * oneDay).length;
    const week1 = filteredMerits.filter(m => now - m.date.getTime() > 21 * oneDay && now - m.date.getTime() <= 28 * oneDay).length;

    const weeks = [
      { label: 'Week 1', count: week1 },
      { label: 'Week 2', count: week2 },
      { label: 'Week 3', count: week3 },
      { label: 'Week 4 (Recent)', count: week4 },
    ];
    const maxWeekCount = Math.max(1, ...weeks.map(w => w.count));

    // Previous window comparison
    const windowMs = timeFilter === '7d' ? 7 * oneDay : 30 * oneDay;
    const currentWindowCount = filteredMerits.filter(m => now - m.date.getTime() <= windowMs).length;
    const previousWindowCount = meritsList.filter(m => now - m.date.getTime() > windowMs && now - m.date.getTime() <= windowMs * 2).length;

    let growthPercentage: number | null = null;
    if (previousWindowCount > 0) {
      growthPercentage = Math.round(((currentWindowCount - previousWindowCount) / previousWindowCount) * 100);
    }

    // Worker with most merits
    const countsByWorker: { [name: string]: number } = {};
    filteredMerits.forEach(m => {
      countsByWorker[m.toWorkerName] = (countsByWorker[m.toWorkerName] || 0) + 1;
    });
    const topWorkerEntry = Object.entries(countsByWorker).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const topWorkerName = topWorkerEntry ? topWorkerEntry[0] : (businessWorkers[0]?.name || 'N/A');
    const topWorkerCount = topWorkerEntry ? topWorkerEntry[1] : 0;

    return {
      totalCount,
      topWorkerName,
      topWorkerCount,
      countsByWorker,
      weeks,
      maxWeekCount,
      growthPercentage,
      currentWindowCount,
      previousWindowCount,
    };
  }, [filteredMerits, meritsList, timeFilter, businessWorkers]);

  // Distinct staff names for filter dropdown
  const staffOptions = useMemo(() => {
    const set = new Set<string>();
    meritsList.forEach(m => set.add(m.toWorkerName));
    return Array.from(set);
  }, [meritsList]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!filteredMerits.length) {
      toast.error('No merits data matching filters to export.');
      return;
    }
    const headers = ['Recipient Staff', 'Staff Role', 'Customer', 'Merit Type', 'Category', 'Date', 'Customer Feedback'];
    const rows = filteredMerits.map(m => [
      `"${m.toWorkerName}"`,
      `"${m.toWorkerRole || 'Staff'}"`,
      `"${m.fromUserName}"`,
      `"${m.meritType}"`,
      `"${m.meritCategory}"`,
      `"${m.dateFormatted}"`,
      `"${(m.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `${businessName.replace(/\s+/g, '_')}_Merits_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Customer merits report exported to CSV!');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 font-['Outfit',sans-serif]"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-indigo-500/10 dark:from-slate-900 dark:to-slate-900 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                  Customer Merits & Performance
                </h3>
                {stats.growthPercentage !== null ? (
                  <span className={`inline-flex items-center text-xs font-black px-2.5 py-0.5 rounded-full border ${
                    stats.growthPercentage >= 0 
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/80' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}>
                    <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                    {stats.growthPercentage >= 0 ? `+${stats.growthPercentage}%` : `${stats.growthPercentage}%`} vs prior
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full font-mono">
                    {stats.totalCount} total verified merits
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {businessName} • Real-time staff recognition ledger & analytics
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="hidden sm:flex items-center px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Export CSV
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          
          {/* EXECUTIVE KPI SUMMARY CARDS (2 CARDS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            
            {/* Total Merits Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Total Merits</span>
                <Award className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {stats.totalCount}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center">
                {stats.growthPercentage !== null ? (
                  <><TrendingUp className="w-3 h-3 mr-0.5" /> {stats.growthPercentage >= 0 ? `+${stats.growthPercentage}%` : `${stats.growthPercentage}%`} vs previous period</>
                ) : (
                  <>✓ {stats.totalCount} verified merits</>
                )}
              </p>
            </div>

            {/* Top Awarded Staff */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
              <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Top Performer</span>
                <Users className="w-4 h-4" />
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate" title={stats.topWorkerName}>
                {stats.topWorkerName}
              </div>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                🏆 {stats.topWorkerCount} merits awarded
              </p>
            </div>

          </div>

          {/* INTERACTIVE MERITS GRAPH & VISUALIZATION */}
          <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Visual Merits Analytics
                </h4>
              </div>

              {/* Chart Tabs */}
              <div className="flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'timeline' 
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  📈 Trend Over Time
                </button>
                <button
                  onClick={() => setActiveTab('staff')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'staff' 
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  👥 Staff Leaderboard
                </button>
              </div>
            </div>

            {/* TAB 1: TIMELINE / GROWTH CHART */}
            {activeTab === 'timeline' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>Weekly Verified Merit Distribution (Past 4 Weeks)</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                    {stats.weeks.reduce((acc, w) => acc + w.count, 0)} merits in 28 days
                  </span>
                </div>

                {/* Visual Bar Graph */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3 h-36 pt-4 items-end border-b border-slate-200 dark:border-slate-700 pb-2">
                  {stats.weeks.map((week, idx) => {
                    const heightPercent = stats.maxWeekCount > 0 
                      ? Math.max(12, Math.round((week.count / stats.maxWeekCount) * 100))
                      : 12;
                    const isRecent = idx === 3;
                    return (
                      <div key={week.label} className="flex flex-col items-center h-full justify-end group">
                        <span className={`text-[10px] font-mono mb-1 ${isRecent ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          {week.label}
                        </span>
                        <div 
                          className={`w-full rounded-t-xl transition-all duration-500 relative flex items-center justify-center ${
                            isRecent 
                              ? 'bg-linear-to-t from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/20' 
                              : 'bg-indigo-300 dark:bg-indigo-900 group-hover:bg-indigo-400'
                          }`} 
                          style={{ height: `${heightPercent}%` }}
                        >
                          <span className={`text-[10px] font-mono font-black ${isRecent ? 'text-white' : 'text-indigo-950 dark:text-indigo-200'}`}>
                            {week.count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center">
                  <Sparkles className="w-3 h-3 mr-1 text-indigo-500" />
                  Workplace metrics are calculated dynamically from verified customer counter scans and digital ratings.
                </p>
              </div>
            )}

            {/* TAB 2: TEAM MERIT LEADERBOARD */}
            {activeTab === 'staff' && (
              <div className="space-y-3 pt-2">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
                  Merits awarded per team member
                </div>

                <div className="space-y-2.5">
                  {Object.entries(stats.countsByWorker).sort((a, b) => Number(b[1]) - Number(a[1])).map(([name, countVal], idx) => {
                    const count = Number(countVal) || 0;
                    const percent = stats.totalCount ? Math.round((count / stats.totalCount) * 100) : 0;
                    return (
                      <div key={name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center text-slate-900 dark:text-slate-100">
                            <span className="w-5 font-mono text-slate-400">{idx + 1}.</span>
                            {name}
                          </span>
                          <span className="font-mono text-slate-500 dark:text-slate-400">
                            {count} merits ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* FILTERS & SEARCH TOOLBAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by staff name or customer..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              
              {/* Time Filter */}
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="30d">📅 Last 30 Days (This Month)</option>
                <option value="7d">📅 Last 7 Days (This Week)</option>
                <option value="all">📅 All Time</option>
              </select>

              {/* Staff Filter */}
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">👥 All Staff Members</option>
                {staffOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

            </div>
          </div>

          {/* DETAILED MERITS AUDIT LOG */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Detailed Merits Ledger ({filteredMerits.length} Records)
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                Showing newest customer feedback
              </span>
            </div>

            {filteredMerits.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Award className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {meritsList.length === 0 ? "No customer recognitions recorded yet." : "No merit records match your active filters."}
                </p>
                {meritsList.length === 0 ? (
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Display your Counter QR code at your workplace so customers can scan and recognize your team members with verified merits.
                  </p>
                ) : (
                  <button
                    onClick={() => {
                      setTimeFilter('all');
                      setStaffFilter('all');
                      setSearchQuery('');
                    }}
                    className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredMerits.map((item) => {
                  const initials = item.toWorkerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors space-y-2.5"
                    >
                      {/* Row: Staff Recipient + Customer Giver + Feedback Type + When */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        
                        {/* Who Received + Who Gave */}
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                            {item.toWorkerAvatar ? (
                              <img src={item.toWorkerAvatar} alt={item.toWorkerName} className="w-full h-full object-cover" />
                            ) : (
                              initials
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                                {item.toWorkerName}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                ({item.toWorkerRole || 'Staff'})
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center mt-0.5">
                              Given by <strong className="text-slate-700 dark:text-slate-300 ml-1 mr-1">{item.fromUserName}</strong>
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 inline" />
                            </p>
                          </div>
                        </div>

                        {/* What Feedback Was Given + When */}
                        <div className="flex flex-col sm:items-end self-start sm:self-auto space-y-0.5">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Feedback: <strong className={`font-black ${getMeritFeedbackColor(item.meritType as CanonicalMeritTier)}`}>{item.meritType}</strong>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 flex items-center">
                            <Clock className="w-3 h-3 mr-1" /> {item.dateFormatted} ({item.timeAgo})
                          </div>
                        </div>
                      </div>

                      {/* Footer Details: Full Timestamp */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" /> {item.dateFormatted}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓ Verified Customer Endorsement
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            💡 Merit scores directly boost your business's public map merit level.
          </p>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-xs shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}

// Helpers & Canonical Tier Definitions
export type CanonicalMeritTier = 'Good' | 'Very Good' | 'Excellent' | 'Superstar' | 'Legend';

export function normalizeMeritFeedback(rawType?: string): CanonicalMeritTier {
  if (!rawType) return 'Excellent';
  const lower = rawType.toLowerCase().trim();
  if (lower.includes('legend') || lower.includes('heroic') || lower.includes('mastery')) return 'Legend';
  if (lower.includes('super') || lower.includes('star') || lower.includes('vibe')) return 'Superstar';
  if (lower.includes('excellent') || lower.includes('exceptional') || lower.includes('quality') || lower.includes('craft')) return 'Excellent';
  if (lower.includes('very') || lower.includes('energy') || lower.includes('speed') || lower.includes('solver') || lower.includes('favor')) return 'Very Good';
  if (lower.includes('good') || lower.includes('reliable') || lower.includes('punctual') || lower.includes('team') || lower.includes('hospital')) return 'Good';
  return 'Excellent';
}

export function getMeritFeedbackColor(tier?: CanonicalMeritTier | string): string {
  switch (tier) {
    case 'Legend':
      return 'text-amber-500 dark:text-amber-400';
    case 'Superstar':
      return 'text-pink-500 dark:text-pink-400';
    case 'Excellent':
      return 'text-cyan-600 dark:text-cyan-400';
    case 'Very Good':
      return 'text-indigo-600 dark:text-indigo-400';
    case 'Good':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-indigo-600 dark:text-indigo-400';
  }
}

function formatMeritDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeAgo(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}
