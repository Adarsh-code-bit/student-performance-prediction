import React, { useState, useEffect } from 'react';
import { 
  History, Clock, CheckCircle, AlertTriangle, User, 
  MapPin, Layers, RefreshCw, Calendar, Tag, ShieldCheck
} from 'lucide-react';
import api from '../../services/api';
import Modal from '../shared/Modal';

export default function PickingHistoryModal({ isOpen, onClose, orderId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchHistory();
    } else {
      setData(null);
    }
  }, [isOpen, orderId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${orderId}/picking-history`);
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load picking history', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const allocations = data?.allocations || [];
  const events = data?.events || [];
  const order = data?.order;

  const getEventBadge = (type) => {
    switch (type) {
      case 'ASSIGNED': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'PICK_STARTED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ITEM_STARTED': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'ITEM_PAUSED': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ITEM_RESUMED': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'ITEM_CONFIRMED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'ITEM_SHORTAGE': return 'bg-red-100 text-red-800 border-red-200';
      case 'ORDER_COMPLETED': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manager Audit • Picking History for Order #${orderId}`}
      size="xl"
    >
      {loading || !data ? (
        <div className="empty-state py-8">
          <RefreshCw className="animate-spin text-primary-500 mx-auto mb-2" size={24} />
          Loading audit trail & item lifecycle...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Order Header Summary */}
          {order && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-500">Picker</span>
                <div className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                  <User size={13} className="text-primary-600" />
                  {order.picker_name || 'Unassigned'}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Order Status</span>
                <div className="font-bold text-slate-800 uppercase mt-0.5">
                  {order.status?.replace(/_/g, ' ')}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Assigned At</span>
                <div className="font-semibold text-slate-700 mt-0.5">
                  {order.picking_assigned_at ? new Date(order.picking_assigned_at).toLocaleTimeString() : '—'}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Started At</span>
                <div className="font-semibold text-slate-700 mt-0.5">
                  {order.picking_started_at ? new Date(order.picking_started_at).toLocaleTimeString() : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Item Allocation & Resolution Table */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Layers size={16} className="text-primary-600" />
              Allocated Items & Exact Storage Locations
            </h3>
            <div className="table-responsive border border-slate-200 rounded-lg overflow-hidden">
              <table className="data-table text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th>Product & SKU</th>
                    <th>Storage Location (Aisle-Rack-Shelf-Bin)</th>
                    <th>Batch & Expiry</th>
                    <th className="text-center">Allocated</th>
                    <th className="text-center">Picked</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a, i) => (
                    <tr key={a.allocation_id || i}>
                      <td>
                        <strong className="text-slate-900">{a.product_name}</strong>
                        <div className="text-[11px] text-slate-500 font-mono">{a.sku}</div>
                      </td>
                      <td>
                        {a.is_location_assigned ? (
                          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-800">
                            <MapPin size={12} className="text-primary-600 flex-shrink-0" />
                            <span>
                              {a.aisle ? `Aisle: ${a.aisle} • ` : ''}
                              {a.rack_number ? `Rack: ${a.rack_number} • ` : ''}
                              {a.shelf ? `Shelf: ${a.shelf} • ` : ''}
                              {a.bin ? `Bin: ${a.bin}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold">
                            Location not assigned
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="text-slate-700 font-mono text-[11px]">
                          {a.batch_code ? `Batch: ${a.batch_code}` : 'No batch'}
                        </div>
                        {a.expiry_date && (
                          <div className="text-[10px] text-slate-400">
                            Exp: {new Date(a.expiry_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="text-center font-bold text-slate-800">{a.allocated_quantity}</td>
                      <td className="text-center">
                        <span className={`font-bold ${
                          a.shortage_quantity > 0 ? 'text-amber-600' : 
                          a.picked_quantity > 0 ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          {a.picked_quantity}
                          {a.shortage_quantity > 0 && ` (-${a.shortage_quantity})`}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          a.status === 'PICKED' ? 'bg-emerald-100 text-emerald-800' :
                          a.status === 'SHORTAGE' ? 'bg-amber-100 text-amber-800' :
                          a.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                          a.status === 'PAUSED' ? 'bg-orange-100 text-orange-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Append-Only Event Audit Trail */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <History size={16} className="text-primary-600" />
              Append-Only Picking Event History
            </h3>
            {events.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                No picking events recorded yet.
              </div>
            ) : (
              <div className="space-y-2 border border-slate-200 rounded-lg p-3 max-h-56 overflow-y-auto bg-white">
                {events.map((evt, idx) => (
                  <div 
                    key={evt.event_id || idx}
                    className="flex items-start justify-between p-2 rounded bg-slate-50 hover:bg-slate-100/80 transition-colors text-xs gap-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${getEventBadge(evt.event_type)}`}>
                        {evt.event_type?.replace(/_/g, ' ')}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-800">
                          {evt.picker_name ? `Picker: ${evt.picker_name}` : 'System'}
                        </div>
                        <div className="text-slate-600 text-[11px] mt-0.5">
                          {evt.details}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 text-[11px] text-slate-400">
                      <div>{new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      {evt.duration_seconds > 0 && (
                        <div className="text-primary-600 font-mono font-medium">
                          +{evt.duration_seconds}s
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t">
            <button className="btn btn-secondary" onClick={onClose}>
              Close Audit
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
