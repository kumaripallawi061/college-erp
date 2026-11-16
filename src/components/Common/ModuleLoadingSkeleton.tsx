import React from 'react';
import { Loader2 } from 'lucide-react';

export const ModuleLoadingSkeleton: React.FC<{ title?: string }> = ({ title = 'Loading Module' }) => {
  return (
    <div className="space-y-6 animate-pulse p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Banner Skeleton */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-2.5 w-full max-w-md">
          <div className="h-6 bg-slate-800 rounded-lg w-3/4 flex items-center gap-2 px-3">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
            <span className="text-xs font-semibold text-slate-300 font-mono tracking-wide">{title}...</span>
          </div>
          <div className="h-3.5 bg-slate-800/60 rounded w-1/2"></div>
        </div>
        <div className="h-9 bg-slate-800 rounded-xl w-32 shrink-0"></div>
      </div>

      {/* KPI Stat Cards Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-3 bg-slate-200 rounded w-20"></div>
              <div className="w-7 h-7 bg-slate-100 rounded-xl"></div>
            </div>
            <div className="h-7 bg-slate-200 rounded w-28"></div>
            <div className="h-2.5 bg-slate-100 rounded w-36"></div>
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="h-5 bg-slate-200 rounded w-48"></div>
          <div className="h-8 bg-slate-100 rounded-xl w-64"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
              <div className="h-4 bg-slate-100 rounded w-16 shrink-0"></div>
              <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/6"></div>
              <div className="h-4 bg-slate-100 rounded w-1/6"></div>
              <div className="h-4 bg-slate-100 rounded w-20 ml-auto"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
