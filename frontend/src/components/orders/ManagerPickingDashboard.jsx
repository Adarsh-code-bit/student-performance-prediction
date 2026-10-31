import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Clock, AlertTriangle, Play, CheckCircle, Eye, 
  MapPin, RefreshCw, Layers, ShieldAlert, ArrowRight,
  TrendingUp, Pause, Activity, Filter, Search
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function ManagerPickingDashboard({ onInspectHistory, onOpenPickingStation }) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [isAutoPolling, setIsAutoPolling] = useState(true);
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [search, setSearch] = useState('');

  // Live ticking counter
  const [tick, setTick] = useState(0);

  const fetchActivity = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.get('/orders/manager/picking-activity');
      if (res.data?.success) {
        setActivities(res.data.data || []);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      if (err.response?.status === 403) {
        addToast('Manager privileges required to view live picking dashboard', 'error');
      } else {
        console.error('Error fetching picking activity', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Live 1-second ticker for smooth timer increments
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 5-second polling interval with visibility state check
  useEffect(() => {
    fetchActivity(true);

    const pollInterval = setInterval(() => {
      if (isAutoPolling && document.visibilityState === 'visible') {
        fetchActivity(false);
      }
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAutoPolling) {
        fetchActivity(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAutoPolling]);

  // Helper to format seconds nicely
  const formatSecs = (sec) => {
    if (sec == null || isNaN(sec) || sec < 0) return '0s';
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  // Filtered list
  const filtered = activities.filter(act => {
    if (delayedOnly && !act.is_delayed) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchOrder = act.order_id?.toString().includes(q);
      const matchPicker = act.picker_name?.toLowerCase().includes(q);
      const matchCustomer = act.customer_name?.toLowerCase().includes(q);
      const matchProduct = act.current_item?.product_name?.toLowerCase().includes(q);
      return matchOrder || matchPicker || matchCustomer || matchProduct;
    }
    return true;
  });

  // Summary Metrics
  const activePickers = new Set(activities.filter(a => a.status === 'picking_in_progress').map(a => a.picker_id)).size;
  const inProgressCount = activities.filter(a => a.status === 'picking_in_progress').length;
  const queuedCount = activities.filter(a => a.status === 'picking_queue').length;
  const delayedCount = activities.filter(a => a.is_delayed).length;

  return (
    <div className="space-y-6">
      {/* Live Header & Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="content-card p-4 flex items-center justify-between border-l-4 border-l-primary-500">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Pickers</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{activePickers}</div>
            <div className="text-xs text-slate-500 mt-0.5">On warehouse floor</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
            <Users size={20} />
          </div>
        </div>

        <div className="content-card p-4 flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Picking In Progress</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{inProgressCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">{queuedCount} queued in store</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
            <Activity size={20} />
          </div>
        </div>

        <div className={`content-card p-4 flex items-center justify-between border-l-4 ${
          delayedCount > 0 ? 'border-l-red-500 bg-red-50/20' : 'border-l-emerald-500'
        }`}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delayed Orders</div>
            <div className={`text-2xl font-black mt-1 ${delayedCount > 0 ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>
              {delayedCount}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Exceeding SLA limits</div>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            delayedCount > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="content-card p-4 flex items-center justify-between border-l-4 border-l-purple-500">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Store Scoping</div>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {user?.role === 'ADMIN' ? 'All Stores (Admin)' : `Store #${user?.store_id || 1}`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Live store-level isolation</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      {/* Control Bar: Polling indicator, Delayed Toggle, Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Live Polling Indicator */}
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${
              isAutoPolling ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`} />
            <span className="text-xs font-semibold text-slate-700">
              {isAutoPolling ? 'Live Feed (5s Polling)' : 'Polling Paused'}
            </span>
          </div>

          <button
            onClick={() => setIsAutoPolling(!isAutoPolling)}
            className="btn btn-secondary btn-sm text-xs py-1 px-2.5"
          >
            {isAutoPolling ? 'Pause' : 'Resume'}
          </button>

          <button
            onClick={() => fetchActivity(true)}
            disabled={loading}
            className="btn btn-secondary btn-sm text-xs py-1 px-2.5 flex items-center gap-1"
            title="Manual refresh"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {lastRefreshed && (
            <span className="text-[11px] text-slate-400 hidden md:inline">
              Updated: {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Filter and Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setDelayedOnly(!delayedOnly)}
            className={`btn btn-sm text-xs py-1 px-3 flex items-center gap-1.5 transition-all ${
              delayedOnly 
                ? 'bg-red-600 text-white font-bold hover:bg-red-700 shadow-sm' 
                : 'btn-secondary text-slate-600'
            }`}
          >
            <AlertTriangle size={13} />
            Delayed Only ({delayedCount})
          </button>

          <div className="relative w-48 sm:w-60">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search picker or order..."
              className="form-input pl-8 py-1 text-xs w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Live Activity Table */}
      <div className="content-card overflow-hidden">
        {loading && activities.length === 0 ? (
          <div className="empty-state py-12">
            <RefreshCw className="animate-spin text-primary-500 mx-auto mb-2" size={24} />
            Loading real-time picking operations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state py-12 text-slate-500">
            No active picking tasks match your filter.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order & Customer</th>
                  <th>Assigned Picker</th>
                  <th>Current Item & Rack Location</th>
                  <th>Progress</th>
                  <th>Waiting Time</th>
                  <th>Current Item</th>
                  <th>Active Duration</th>
                  <th>Total Elapsed</th>
                  <th>Status</th>
                  <th className="text-right">Audit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(act => {
                  return (
                    <tr 
                      key={act.order_id}
                      className={act.is_delayed ? 'bg-red-50/40 hover:bg-red-50/70 transition-colors' : ''}
                    >
                      {/* Order & Customer */}
                      <td>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 font-bold">#{act.order_id}</strong>
                          {act.is_delayed && (
                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-black uppercase tracking-wide border border-red-200 animate-pulse">
                              Delayed
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{act.customer_name}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(act.order_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Picker */}
                      <td>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                          <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-[10px]">
                            {act.picker_name ? act.picker_name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <span>{act.picker_name || 'Unassigned'}</span>
                        </div>
                        {act.picking_assigned_at && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Assigned: {new Date(act.picking_assigned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>

                      {/* Current Product & Location Guidance */}
                      <td>
                        {act.current_item ? (
                          <div>
                            <div className="font-bold text-xs text-slate-900 flex items-center gap-1">
                              <span>{act.current_item.product_name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({act.current_item.allocated_quantity} qty)</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1">
                              <MapPin size={12} className={act.current_item.is_assigned ? 'text-primary-600' : 'text-amber-500'} />
                              <span className={`text-[11px] font-mono ${
                                act.current_item.is_assigned 
                                  ? 'font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200' 
                                  : 'text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold'
                              }`}>
                                {act.current_item.location_display}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">All items picked</span>
                        )}
                      </td>

                      {/* Progress: Completed / Remaining */}
                      <td>
                        <div className="text-xs font-semibold text-slate-800">
                          {act.picked_items} of {act.total_items} items
                        </div>
                        <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                          <div 
                            className="bg-primary-600 h-full rounded-full transition-all"
                            style={{ width: `${act.total_items > 0 ? (act.picked_items / act.total_items) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {act.remaining_items} remaining
                        </div>
                      </td>

                      {/* Waiting Time Before Picking Started */}
                      <td>
                        <span className="text-xs font-mono font-medium text-slate-700">
                          {formatSecs(act.waiting_time_seconds)}
                        </span>
                        {act.waiting_time_seconds > 300 && act.status === 'picking_queue' && (
                          <div className="text-[10px] text-red-600 font-semibold">Queue SLA warning</div>
                        )}
                      </td>

                      {/* Current Item Duration (Live) */}
                      <td>
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {formatSecs(act.current_item_duration_seconds)}
                        </span>
                        {act.current_item?.status === 'PAUSED' && (
                          <span className="block text-[10px] text-amber-700 font-bold uppercase">PAUSED</span>
                        )}
                      </td>

                      {/* Total Active Picking Duration */}
                      <td>
                        <span className="text-xs font-mono font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                          {formatSecs(act.total_active_seconds)}
                        </span>
                      </td>

                      {/* Total Elapsed Picking Duration */}
                      <td>
                        <span className={`text-xs font-mono font-bold ${
                          act.total_elapsed_seconds > 600 && act.status === 'picking_in_progress'
                            ? 'text-red-600'
                            : 'text-slate-700'
                        }`}>
                          {formatSecs(act.total_elapsed_seconds)}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          act.status === 'picking_in_progress' ? 'bg-amber-100 text-amber-800' :
                          act.status === 'picked' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {act.status?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Action: Inspect History & Open Station */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onInspectHistory(act.order_id)}
                            className="btn btn-secondary btn-sm text-xs py-1 px-2 flex items-center gap-1"
                            title="Inspect Item-by-Item Picking History & Event Log"
                          >
                            <Eye size={12} /> Inspect
                          </button>
                          <button
                            onClick={() => onOpenPickingStation(act.order_id)}
                            className="btn btn-primary btn-sm text-xs py-1 px-2 flex items-center gap-1"
                            title="Open Picking Station"
                          >
                            Station <ArrowRight size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
