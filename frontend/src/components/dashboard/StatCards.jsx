import React, { useState, useEffect } from 'react';
import { Package, Layers, AlertTriangle, Clock, XCircle, ShoppingCart, Users, Truck } from 'lucide-react';
import api from '../../services/api';

const PRIMARY_METRICS = [
  { key: 'totalProducts', label: 'Total Products', icon: Package, color: '#168A45', bg: '#E8F5ED', border: '#C7E8D3' },
  { key: 'totalInventory', label: 'Total Stock Units', icon: Layers, color: '#12372A', bg: '#FDF3D0', border: '#F8CB46' },
  { key: 'todayOrders', label: "Orders Today", icon: ShoppingCart, color: '#168A45', bg: '#E8F5ED', border: '#A2D7B5' },
  { key: 'lowStock', label: 'Low Stock Alerts', icon: AlertTriangle, color: '#E9A23B', bg: '#FEF6EB', border: '#FDE3B8', criticalIfNonZero: true },
];

const SECONDARY_METRICS = [
  { key: 'nearExpiry', label: 'Near Expiry', icon: Clock, color: '#E9A23B', bg: '#FEF6EB' },
  { key: 'expired', label: 'Expired Batches', icon: XCircle, color: '#DC3545', bg: '#FDF2F2' },
  { key: 'totalCustomers', label: 'Registered Customers', icon: Users, color: '#0284C7', bg: '#F0F9FF' },
  { key: 'totalSuppliers', label: 'Active Suppliers', icon: Truck, color: '#4A544D', bg: '#F0F2EE' },
];

export default function StatCards() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api.get('/dashboard/stats')
      .then(res => {
        if (res.data && res.data.success) {
          setStats(res.data.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="bg-white rounded-xl p-5 border border-[#E5E9E4] shadow-sm animate-pulse h-28">
            <div className="w-8 h-8 rounded-lg bg-slate-200 mb-3" />
            <div className="h-6 bg-slate-200 rounded w-16 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-white rounded-xl p-4 border border-[#E5E9E4] mb-6 text-center text-sm text-[#DC3545]">
        Unable to load live warehouse metrics. Verify database connection.
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      {/* 4 Core Operational Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {PRIMARY_METRICS.map((cfg) => {
          const Icon = cfg.icon;
          const val = Number(stats[cfg.key] ?? 0);
          const isWarning = cfg.criticalIfNonZero && val > 0;

          return (
            <div 
              key={cfg.key} 
              className={`bg-white rounded-xl p-5 border transition-all duration-200 shadow-sm hover:shadow-md ${
                isWarning ? 'border-[#E9A23B] bg-[#FFFDF9]' : 'border-[#E5E9E4] hover:border-[#168A45]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#68736B] uppercase tracking-wider">
                  {cfg.label}
                </span>
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  <Icon size={20} strokeWidth={2.2} />
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-2xl sm:text-3xl font-extrabold text-[#17211B] tracking-tight">
                  {val.toLocaleString('en-IN')}
                </div>
                {isWarning && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FEF6EB] text-[#E9A23B] border border-[#E9A23B]/30">
                    Needs Action
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Secondary Operational Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        {SECONDARY_METRICS.map((cfg) => {
          const Icon = cfg.icon;
          const val = Number(stats[cfg.key] ?? 0);
          return (
            <div 
              key={cfg.key}
              className="bg-white rounded-lg px-3.5 py-2.5 border border-[#E5E9E4] flex items-center justify-between text-xs hover:border-[#168A45]/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  <Icon size={15} />
                </div>
                <span className="text-[#68736B] font-medium">{cfg.label}</span>
              </div>
              <span className={`font-bold text-sm ${cfg.key === 'expired' && val > 0 ? 'text-[#DC3545]' : 'text-[#17211B]'}`}>
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
