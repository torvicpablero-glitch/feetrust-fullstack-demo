import React from 'react';
import { useStore, ActivityFeedItem } from '../lib/store';
import { Star, Sparkles, Building, DollarSign, Activity } from 'lucide-react';

export default function ActivityFeed() {
  const { appState } = useStore();
  const feed: ActivityFeedItem[] = appState.activityFeed || [];

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm font-['Outfit',sans-serif]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-slate-900 flex items-center">
          <Activity className="w-5 h-5 text-indigo-600 mr-2 animate-pulse" /> Live Merit Activity
        </h3>
        <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100 font-bold flex items-center">
          <span className="w-2 h-2 rounded-full bg-indigo-600 mr-1.5 animate-ping" /> Real-time
        </span>
      </div>

      <div className="space-y-3">
        {feed.map((item) => (
          <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between hover:bg-slate-100/80 transition-colors">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  <span className="text-indigo-600 font-bold">{item.fromUserName}</span> gave{' '}
                  <span className="text-amber-700 font-bold">+{item.meritType}</span> merit to{' '}
                  <span className="text-slate-950 font-bold">{item.toWorkerName}</span>
                </p>
                <div className="flex items-center text-xs text-slate-500 mt-1 space-x-3">
                  <span className="flex items-center"><Building className="w-3 h-3 mr-1 text-slate-400" /> {item.businessName}</span>
                  <span>• {item.timeAgo}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
