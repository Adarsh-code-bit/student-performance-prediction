import React from 'react';
import { 
  BellRing, Volume2, VolumeX, Eye, CheckCircle2, 
  MapPin, Clock, Package, Layers, X, ShieldAlert,
  AlertTriangle, ArrowRight
} from 'lucide-react';

export default function PickerMobileAlertModal({
  isOpen,
  order,
  onAccept,
  onView,
  onClose,
  soundEnabled,
  onToggleSound,
  onAcknowledgeSound,
  isSirenPlaying,
  isClaiming = false
}) {
  if (!isOpen || !order) return null;

  const items = order.items || [];
  const distinctCount = order.distinct_products_count || items.length;
  const totalQuantity = order.total_item_quantity || items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const createdTime = order.created_time || (order.order_date ? new Date(order.order_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now');

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* Mobile-first card container: Dark Forest Green monitor styling */}
      <div 
        className="w-full max-w-lg bg-[#12372A] text-white rounded-2xl shadow-2xl border-2 border-[#F8CB46] overflow-hidden flex flex-col max-h-[92vh] animate-modalSlideUp"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
      >
        {/* Siren / Audio Control Top Bar */}
        <div className="bg-[#0b241b] text-white px-5 py-3 flex items-center justify-between border-b border-[#1b4d3b]">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isSirenPlaying ? 'bg-[#F8CB46] animate-ping' : 'bg-[#168A45]'}`} />
            <span className="text-xs font-bold tracking-wider uppercase text-[#E5E9E4]">
              QUICKSTOCK WAREHOUSE TERMINAL
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Siren Silence/Acknowledge */}
            {isSirenPlaying && (
              <button
                type="button"
                onClick={onAcknowledgeSound}
                className="bg-[#F8CB46] hover:bg-yellow-400 text-[#12372A] text-xs font-black px-3 py-1.5 rounded-md flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                title="Silence siren audio"
              >
                <VolumeX size={14} />
                <span>SILENCE</span>
              </button>
            )}

            {/* Mute/Unmute Toggle */}
            <button
              type="button"
              onClick={onToggleSound}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1 transition-all ${
                soundEnabled
                  ? 'bg-[#168A45] text-white hover:bg-emerald-700'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
              title={soundEnabled ? 'Siren sound enabled. Tap to mute.' : 'Sound muted. Tap to enable siren.'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{soundEnabled ? 'Audio ON' : 'Muted'}</span>
            </button>

            {/* Dismiss X */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Dismiss alert modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* High-Visibility Header: Readable at a distance */}
        <div className="bg-[#12372A] px-6 py-6 text-center border-b border-[#1b4d3b] relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F8CB46] text-[#12372A] text-xs font-black tracking-widest uppercase mb-3 shadow">
            <BellRing size={14} className={isSirenPlaying ? 'animate-bounce' : ''} />
            DARK STORE DISPATCH DISPATCH ALERT
          </div>
          <h2 id="alert-modal-title" className="text-2xl sm:text-3xl font-black tracking-tight text-white m-0">
            NEW ORDER ARRIVED
          </h2>
          <div className="mt-2 text-3xl sm:text-4xl font-extrabold text-[#F8CB46] tracking-tight">
            #{order.order_number || `ORD-${order.order_id}`}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 bg-[#143d2f]">
          {/* Large Metadata Tiles */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#12372A] p-3 rounded-xl border border-[#1b4d3b] text-center">
              <span className="text-[10px] font-bold text-slate-300 uppercase block tracking-wider">
                ITEM COUNT
              </span>
              <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
                {totalQuantity} <span className="text-xs font-normal text-slate-300">units</span>
              </span>
            </div>

            <div className="bg-[#12372A] p-3 rounded-xl border border-[#1b4d3b] text-center">
              <span className="text-[10px] font-bold text-slate-300 uppercase block tracking-wider">
                ORDER TIME
              </span>
              <span className="text-base sm:text-lg font-bold text-white mt-1 block">
                {createdTime}
              </span>
            </div>

            <div className="bg-[#12372A] p-3 rounded-xl border border-[#1b4d3b] text-center">
              <span className="text-[10px] font-bold text-slate-300 uppercase block tracking-wider">
                PRIORITY
              </span>
              <span className="text-sm font-extrabold text-[#F8CB46] bg-[#0b241b] px-2 py-0.5 rounded mt-1 inline-block border border-[#F8CB46]/30">
                10-MIN SLA
              </span>
            </div>
          </div>

          {/* Customer reference */}
          <div className="flex items-center justify-between bg-[#12372A] px-4 py-2.5 rounded-xl border border-[#1b4d3b] text-xs">
            <span className="text-slate-300">Customer: <strong className="text-white">{order.customer_name || 'Quick Commerce Customer'}</strong></span>
            <span className="text-slate-400 font-mono text-[11px]">{order.city || 'Standard Dark Store Hub'}</span>
          </div>

          {/* Item Routing with Rack / Shelf Locations */}
          <div>
            <div className="text-xs font-bold text-[#F8CB46] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Pick Routing ({items.length} SKUs)</span>
              <span className="text-[11px] text-slate-300">FEFO Allocated</span>
            </div>

            <div className="divide-y divide-[#1b4d3b] rounded-xl border border-[#1b4d3b] bg-[#12372A] overflow-hidden shadow-sm max-h-48 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 italic">
                  Order lines ready for picking terminal claim.
                </div>
              ) : (
                items.map((it, idx) => (
                  <div key={it.product_id || idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-bold text-[#F8CB46] w-5 text-right flex-shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-white block truncate" title={it.product_name}>
                          {it.product_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          SKU: {it.sku || it.product_id}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono font-black text-[#12372A] bg-[#F8CB46] px-2 py-0.5 rounded text-xs">
                        x{it.quantity}
                      </span>
                      <span className="bg-[#0b241b] text-[#86efac] font-bold px-2 py-0.5 rounded text-[11px] flex items-center gap-1 border border-[#168A45]/40" title={it.location}>
                        <MapPin size={11} className="text-[#F8CB46] flex-shrink-0" />
                        <span className="truncate">{it.location || 'Dark Store Rack'}</span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions: High Touch Target */}
        <div className="p-5 bg-[#0b241b] border-t border-[#1b4d3b] flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => onView(order.order_id)}
            disabled={isClaiming}
            className="w-full sm:w-auto py-3.5 px-5 rounded-xl text-xs font-bold text-slate-200 bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Eye size={16} />
            <span>VIEW DETAILS</span>
          </button>

          <button
            type="button"
            onClick={() => onAccept(order.order_id)}
            disabled={isClaiming}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-xl text-sm font-black text-white bg-[#168A45] hover:bg-emerald-600 active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 transition-all min-h-[50px] touch-manipulation disabled:opacity-50"
          >
            {isClaiming ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>CLAIMING ORDER...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={20} className="text-[#F8CB46]" />
                <span className="tracking-wide">START PICKING</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
