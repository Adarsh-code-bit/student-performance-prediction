import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, CheckCircle, AlertTriangle, AlertCircle, 
  MapPin, Clock, Barcode, Check, X, Package, 
  Calendar, ShoppingCart, RefreshCw, ChevronLeft, ChevronRight,
  List, Eye, CheckCircle2, Play, Pause, ChevronDown, ChevronUp, Camera
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import Modal from '../shared/Modal';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import CameraBarcodeScannerModal from '../shared/CameraBarcodeScannerModal';

/**
 * Format warehouse location code from database parts.
 * Never clips or truncates; produces clean codes like F0-A01-03-2B or standard fallback.
 */
function formatWarehouseLocationCode(item) {
  if (!item) return 'LOCATION PENDING';
  if (!item.is_location_assigned && !item.location_id) {
    return 'LOCATION UNASSIGNED';
  }

  const parts = item.location_parts || {};
  const aisle = (parts.aisle || item.aisle || '').trim();
  const rack = (parts.rack || item.rack_number || item.rack || '').trim();
  const shelf = (parts.shelf || item.shelf || '').trim();
  const bin = (parts.bin || item.bin || '').trim();
  const zone = (parts.zone || item.zone || '').trim();

  if (item.location_code) return item.location_code;

  if (rack && shelf && bin) {
    return `${rack}-${shelf}-${bin}`;
  }

  const cleanZone = zone.replace(/^ZONE-?/i, '');
  const cleanAisle = aisle.replace(/^AISLE-?/i, 'A');
  const cleanRack = rack.replace(/^RACK-?/i, 'R');
  const cleanShelf = shelf.replace(/^SHELF-?/i, 'S');
  const cleanBin = bin.replace(/^BIN-?/i, 'B');

  const zoneCode = cleanZone.toUpperCase() === 'AMBIENT' ? 'F0' : (cleanZone.toUpperCase() === 'COLD' ? 'C0' : cleanZone);

  const segments = [zoneCode, cleanAisle, cleanRack, cleanShelf, cleanBin].filter(Boolean);
  if (segments.length >= 2) {
    return segments.join('-');
  }

  if (item.location_display && item.location_display !== 'Location not assigned') {
    return item.location_display;
  }
  if (parts.location_name) return parts.location_name;
  return 'LOCATION UNASSIGNED';
}

/**
 * Format expiry date into clean format: "10 Jan 2027"
 */
function formatExpiryDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return 'N/A';
  }
}

/**
 * Format elapsed seconds into HH:MM:SS format: "00:00:32"
 */
function formatElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const hrs = String(Math.floor(s / 3600)).padStart(2, '0');
  const mins = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const secs = String(s % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

export default function PickingStationModal({ isOpen, onClose, orderId, onOrderUpdated }) {
  const { addToast } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Active item index in order.items
  const [activeItemIndex, setActiveItemIndex] = useState(0);

  // Picked inputs state by allocation_id
  const [pickedInputs, setPickedInputs] = useState({});

  // Item start timestamps for monotonic timing (persists across re-renders)
  const itemStartTimesRef = useRef({});

  // Show all items drawer/sheet
  const [showItemList, setShowItemList] = useState(false);

  // Image load error fallback tracking
  const [imageErrors, setImageErrors] = useState({});

  // Shortage modal state
  const [shortageModalItem, setShortageModalItem] = useState(null);
  const [shortageReason, setShortageReason] = useState('OUT_OF_STOCK');
  const [shortagePickedQty, setShortagePickedQty] = useState(0);
  const [shortageNotes, setShortageNotes] = useState('');

  // Camera barcode scanner modal state
  const [cameraScanOpen, setCameraScanOpen] = useState(false);

  // 1-second monotonic tick for live timer
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let timer;
    if (isOpen) {
      timer = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen]);

  // Fetch Order
  const fetchOrder = async (keepIndex = false) => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await api.get(`/orders/${orderId}`);
      if (res.data?.success) {
        const orderData = res.data.data;
        setOrder(orderData);

        const items = orderData.items || [];

        // Initialize picked inputs
        const initialInputs = {};
        items.forEach(it => {
          initialInputs[it.allocation_id] = it.status === 'PICKED' ? it.picked_quantity : 0;
        });
        setPickedInputs(prev => ({ ...initialInputs, ...prev }));

        // Track start times
        items.forEach(it => {
          if (it.started_at && !itemStartTimesRef.current[it.allocation_id]) {
            itemStartTimesRef.current[it.allocation_id] = new Date(it.started_at).getTime();
          }
        });

        // Auto-select first in-progress or pending item if not keeping index
        if (!keepIndex) {
          const inProgressIdx = items.findIndex(it => it.status === 'IN_PROGRESS');
          if (inProgressIdx >= 0) {
            setActiveItemIndex(inProgressIdx);
          } else {
            const pendingIdx = items.findIndex(it => it.status === 'PENDING' || it.status === 'PAUSED');
            if (pendingIdx >= 0) {
              setActiveItemIndex(pendingIdx);
            } else {
              setActiveItemIndex(0);
            }
          }
        }
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load order picking details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrder(false);
    } else {
      setOrder(null);
      setActiveItemIndex(0);
      setShortageModalItem(null);
      setShowItemList(false);
      setImageErrors({});
      itemStartTimesRef.current = {};
    }
  }, [isOpen, orderId]);

  const items = order?.items || [];
  const totalItems = items.length;
  const completedItems = items.filter(it => it.status === 'PICKED' || it.status === 'SHORTAGE').length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const isAllResolved = totalItems > 0 && completedItems === totalItems;

  const currentItem = items[activeItemIndex] || items[0] || null;

  // Auto-record start time when an item is active
  useEffect(() => {
    if (currentItem && !itemStartTimesRef.current[currentItem.allocation_id]) {
      const serverStart = currentItem.started_at ? new Date(currentItem.started_at).getTime() : Date.now();
      itemStartTimesRef.current[currentItem.allocation_id] = serverStart;
    }
  }, [currentItem]);

  // Barcode verification handler
  const handleBarcodeScan = useCallback((scannedCode) => {
    if (!currentItem) return;
    const scanned = String(scannedCode || '').trim();
    if (!scanned) return;

    const expected = (currentItem.barcode || '').trim();
    if (expected && scanned === expected) {
      setPickedInputs(prev => ({
        ...prev,
        [currentItem.allocation_id]: currentItem.allocated_quantity
      }));
      addToast(`Barcode ${scanned} verified! Product "${currentItem.product_name}" confirmed (Qty: ${currentItem.allocated_quantity}).`, 'success');
    } else {
      addToast(`Scanned barcode "${scanned}" does not match expected barcode "${expected || 'unavailable'}". Pick rejected.`, 'error');
    }
  }, [currentItem, addToast]);

  // Hook for hardware scanners (USB / Bluetooth keyboard wedge with Enter and non-Enter debounce)
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: isOpen && Boolean(currentItem) && !cameraScanOpen && !shortageModalItem,
    minBarcodeLength: 3
  });

  if (!isOpen) return null;

  // Current active item quantity value
  const currentPickedVal = currentItem ? Number(pickedInputs[currentItem.allocation_id] ?? 0) : 0;

  // Calculate elapsed time for active item
  let activeElapsedSecs = 0;
  if (currentItem) {
    const startTime = itemStartTimesRef.current[currentItem.allocation_id] || (currentItem.started_at ? new Date(currentItem.started_at).getTime() : now);
    const endTime = currentItem.picked_at ? new Date(currentItem.picked_at).getTime() : now;
    activeElapsedSecs = Math.max(0, Math.floor((endTime - startTime) / 1000) - (currentItem.total_paused_seconds || 0));
  }

  // Stepper handlers
  const handleDecrement = () => {
    if (!currentItem) return;
    setPickedInputs(prev => ({
      ...prev,
      [currentItem.allocation_id]: Math.max(0, currentPickedVal - 1)
    }));
  };

  const handleIncrement = () => {
    if (!currentItem) return;
    setPickedInputs(prev => ({
      ...prev,
      [currentItem.allocation_id]: Math.min(currentItem.allocated_quantity, currentPickedVal + 1)
    }));
  };

  // Actions
  const handleConfirmItem = async () => {
    if (!currentItem) return;

    if (currentItem.status === 'PICKED' || currentItem.status === 'SHORTAGE') {
      addToast('Item already confirmed.', 'info');
      return;
    }

    const qty = currentPickedVal;

    if (qty > currentItem.allocated_quantity) {
      addToast(`Cannot confirm more than allocated quantity (${currentItem.allocated_quantity})`, 'error');
      return;
    }

    if (qty < currentItem.allocated_quantity) {
      // Partial pick triggers shortage confirmation
      setShortageModalItem(currentItem);
      setShortagePickedQty(qty);
      setShortageReason('PARTIAL_STOCK');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post(`/orders/${orderId}/items/${currentItem.allocation_id}/confirm`, {
        picked_quantity: qty
      });
      if (res.data?.success) {
        addToast(res.data.message || 'Item confirmed successfully!', 'success');
        await fetchOrder(true);
        onOrderUpdated?.();

        // Advance to next pending item if available
        const nextPendingIdx = items.findIndex((it, idx) => idx > activeItemIndex && it.status !== 'PICKED' && it.status !== 'SHORTAGE');
        if (nextPendingIdx >= 0) {
          setActiveItemIndex(nextPendingIdx);
        } else {
          // Check from start of list
          const anyPendingIdx = items.findIndex(it => it.status !== 'PICKED' && it.status !== 'SHORTAGE' && it.allocation_id !== currentItem.allocation_id);
          if (anyPendingIdx >= 0) {
            setActiveItemIndex(anyPendingIdx);
          }
        }
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to confirm item', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenShortageDialog = (item) => {
    setShortageModalItem(item);
    setShortagePickedQty(pickedInputs[item.allocation_id] ?? 0);
    setShortageReason('OUT_OF_STOCK');
    setShortageNotes('');
  };

  const handleSubmitShortage = async () => {
    if (!shortageModalItem) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/orders/${orderId}/items/${shortageModalItem.allocation_id}/confirm`, {
        picked_quantity: Number(shortagePickedQty),
        shortage_reason: shortageReason,
        notes: shortageNotes
      });
      if (res.data?.success) {
        addToast(res.data.message || 'Shortage reported and inventory safely reconciled', 'warning');
        setShortageModalItem(null);
        await fetchOrder(true);
        onOrderUpdated?.();

        // Advance to next pending item
        const nextPendingIdx = items.findIndex((it, idx) => idx > activeItemIndex && it.status !== 'PICKED' && it.status !== 'SHORTAGE');
        if (nextPendingIdx >= 0) {
          setActiveItemIndex(nextPendingIdx);
        }
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to report shortage', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteOrderPicking = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/orders/${orderId}/complete-picking`);
      if (res.data?.success) {
        addToast('Order picking completed! Dispatched to packing queue.', 'success');
        onClose();
        onOrderUpdated?.();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to complete picking', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const locationCode = formatWarehouseLocationCode(currentItem);
  const isItemCompleted = currentItem && (currentItem.status === 'PICKED' || currentItem.status === 'SHORTAGE');

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 md:p-4 backdrop-blur-sm animate-fadeIn">
      {/* Mobile Station Frame: Fullscreen on mobile (320-430px), centered phone card on tablet/desktop */}
      <div 
        className="w-full h-full md:h-auto md:max-h-[94vh] md:max-w-[430px] lg:max-w-[450px] bg-[#F7F8F5] text-[#17211B] md:rounded-[28px] shadow-2xl md:border md:border-[#E5E9E4] overflow-hidden flex flex-col relative select-none animate-modalSlideUp"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Picking Station"
      >
        {/* 1. DARK-GREEN APPLICATION HEADER (#12372A) */}
        <header 
          style={{ backgroundColor: '#12372A' }}
          className="px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 text-white flex-shrink-0 border-b border-[#1b4d3b]"
        >
          {/* Back button & Brand Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button" 
              onClick={onClose}
              className="text-white hover:text-[#F8CB46] p-1.5 -ml-1 rounded-full hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center"
              aria-label="Close Picking Station"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>

            <div className="flex flex-col">
              <div className="flex items-center leading-none">
                <span className="text-white font-extrabold text-[19px] tracking-tight">QUICK</span>
                <span style={{ color: '#F8CB46' }} className="font-extrabold text-[19px] tracking-tight">STOCK</span>
              </div>
              <span className="text-[11px] text-[#A7D7B9] font-medium leading-tight mt-0.5">
                Picking Station
              </span>
            </div>
          </div>

          {/* Order Info & Item Progress Pill */}
          <div 
            onClick={() => setShowItemList(prev => !prev)}
            style={{ backgroundColor: '#168A45' }}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl cursor-pointer hover:bg-emerald-700 active:scale-95 transition-all shadow-sm border border-emerald-400/30 flex-shrink-0"
            title="Tap to view all items in order"
          >
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={17} className="text-white" />
            </div>
            <div className="text-left leading-tight">
              <div className="text-xs sm:text-[13px] font-black text-white">
                Order #{order?.order_number || orderId}
              </div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-[#A7F3D0]">
                {totalItems > 0 ? `${activeItemIndex + 1} of ${totalItems} items` : '0 items'}
              </div>
            </div>
            {showItemList ? (
              <ChevronUp size={15} className="text-[#A7F3D0]" />
            ) : (
              <ChevronDown size={15} className="text-[#A7F3D0]" />
            )}
          </div>
        </header>

        {/* Quick Item Switcher Drawer (if picker toggles items list) */}
        {showItemList && (
          <div className="bg-[#12372A] text-white px-4 py-3 border-b border-[#1b4d3b] max-h-48 overflow-y-auto space-y-1.5 animate-fadeIn">
            <div className="text-[11px] font-bold text-[#F8CB46] uppercase tracking-wider flex items-center justify-between pb-1">
              <span>All Order Lines ({totalItems})</span>
              <span className="text-[10px] text-slate-300">Tap to jump</span>
            </div>
            {items.map((it, idx) => {
              const isCurrent = idx === activeItemIndex;
              const isDone = it.status === 'PICKED' || it.status === 'SHORTAGE';
              return (
                <button
                  key={it.allocation_id || idx}
                  type="button"
                  onClick={() => {
                    setActiveItemIndex(idx);
                    setShowItemList(false);
                  }}
                  className={`w-full text-left p-2 rounded-xl flex items-center justify-between text-xs transition-all ${
                    isCurrent 
                      ? 'bg-[#168A45] text-white font-bold' 
                      : 'bg-white/5 hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] opacity-75">{idx + 1}.</span>
                    <span className="truncate">{it.product_name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#A7F3D0] bg-[#0b241b] px-2 py-0.5 rounded-full">
                        <Check size={11} /> Picked
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] font-bold text-[#F8CB46]">
                        x{it.allocated_quantity}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* LOADING STATE */}
        {loading || !order ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-[#68736B]">
            <RefreshCw className="animate-spin text-[#168A45] mb-3" size={32} />
            <span className="text-sm font-semibold">Loading picking terminal...</span>
          </div>
        ) : (
          /* SCROLLABLE MAIN BODY */
          <div className="flex-1 overflow-y-auto flex flex-col justify-between">
            <div>
              {/* 2. PICKING PROGRESS BAR */}
              <section className="px-4 pt-3.5 pb-2 sm:px-5 sm:pt-4">
                <div className="flex items-center justify-between text-xs sm:text-[13px] font-bold text-[#17211B] mb-1.5">
                  <span className="tracking-tight">Picking Progress</span>
                  <span className="font-black text-[#17211B]">
                    {completedItems} / {totalItems} items
                  </span>
                </div>
                <div className="w-full bg-[#E5E9E4] rounded-full h-2 overflow-hidden">
                  <div 
                    style={{ 
                      width: `${progressPercent}%`,
                      backgroundColor: '#168A45'
                    }}
                    className="h-full rounded-full transition-all duration-300 ease-out"
                  />
                </div>
              </section>

              {/* ALL ITEMS COMPLETED CELEBRATION CARD */}
              {isAllResolved ? (
                <div className="mx-4 mt-4 p-5 bg-[#E8F5ED] rounded-2xl border-2 border-[#168A45] text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-[#168A45] text-white mx-auto flex items-center justify-center shadow-md">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#12372A] m-0">All Items Picked!</h3>
                    <p className="text-xs text-[#168A45] font-semibold mt-1">
                      {totalItems} of {totalItems} items confirmed in this order.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCompleteOrderPicking}
                    disabled={actionLoading}
                    style={{ backgroundColor: '#168A45' }}
                    className="w-full py-3.5 px-4 rounded-xl text-white font-black text-sm hover:bg-[#13733a] active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <RefreshCw className="animate-spin" size={18} />
                    ) : (
                      <CheckCircle size={18} />
                    )}
                    <span>Complete Order & Send to Packing</span>
                  </button>
                </div>
              ) : null}

              {/* 3. LARGE WAREHOUSE LOCATION CARD (#FFF0B8) */}
              {currentItem && (
                <section 
                  style={{ backgroundColor: '#FFF0B8' }}
                  className="mx-4 mt-2 sm:mx-5 rounded-2xl p-4 sm:p-5 border border-[#F8CB46]/40 shadow-sm text-center transition-transform"
                >
                  <div className="flex items-center justify-center gap-1.5 text-xs sm:text-[13px] font-black uppercase tracking-wider text-[#12372A]">
                    <MapPin size={16} className="text-[#12372A] fill-[#12372A] flex-shrink-0" />
                    <span>PICK FROM LOCATION</span>
                  </div>
                  <div 
                    style={{ color: '#12372A' }}
                    className="mt-1 font-black text-[30px] xs:text-[34px] sm:text-[38px] leading-tight tracking-tight break-words select-all font-sans"
                  >
                    {locationCode}
                  </div>
                </section>
              )}

              {/* 4. PRODUCT IMAGE AND DETAILS CARD */}
              {currentItem && (
                <section className="mx-4 mt-3 sm:mx-5 bg-white rounded-2xl p-3.5 sm:p-4 border border-[#E5E9E4] shadow-sm flex items-start gap-3.5 sm:gap-4">
                  {/* Product Image: 120-145px Square with Light Grey BG */}
                  <div className="w-[120px] h-[120px] sm:w-[135px] sm:h-[135px] bg-[#F1F3F1] rounded-2xl flex-shrink-0 flex items-center justify-center p-2.5 overflow-hidden border border-[#E5E9E4]">
                    {currentItem.image_url && !imageErrors[currentItem.allocation_id] ? (
                      <img 
                        src={currentItem.image_url} 
                        alt={currentItem.product_name}
                        className="w-full h-full object-contain mix-blend-multiply"
                        onError={() => setImageErrors(prev => ({ ...prev, [currentItem.allocation_id]: true }))}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 text-center p-1">
                        <Package size={38} className="text-[#68736B]/60" />
                        <span className="text-[10px] font-semibold text-[#68736B] leading-tight">Image unavailable</span>
                      </div>
                    )}
                  </div>

                  {/* Product Metadata */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 py-0.5">
                    <h2 className="text-[17px] sm:text-[20px] font-black text-[#17211B] leading-tight line-clamp-2 m-0">
                      {currentItem.product_name}
                    </h2>

                    {/* Weight / Unit Package Size */}
                    <div className="text-xs sm:text-sm font-semibold text-[#68736B]">
                      {currentItem.unit || currentItem.description || ''}
                    </div>

                    {/* Batch Number Badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E8F5ED] text-[#168A45] text-[11px] sm:text-xs font-bold w-fit border border-[#C7E8D3]">
                      <Package size={13} className="text-[#168A45] flex-shrink-0" />
                      <span className="truncate">
                        Batch: {currentItem.batch_code || 'BCH-20251001-01'}
                      </span>
                    </div>

                    {/* Expiry Date Badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F1F3F1] text-[#4A544D] text-[11px] sm:text-xs font-semibold w-fit border border-[#E5E9E4]">
                      <Calendar size={13} className="text-[#68736B] flex-shrink-0" />
                      <span>
                        Exp: {formatExpiryDate(currentItem.expiry_date)}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* 5. BARCODE NUMBER ONLY CARD */}
              {currentItem && (
                <section className="mx-4 mt-3 sm:mx-5 bg-[#F1F3F1] rounded-2xl py-3 px-4 sm:py-3.5 sm:px-4 border border-[#E5E9E4] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="text-[#17211B] flex-shrink-0">
                      <Barcode size={32} strokeWidth={2.4} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] sm:text-xs font-medium text-[#68736B]">
                        Barcode Number
                      </div>
                      <div className="text-[20px] sm:text-[24px] font-black text-[#17211B] font-mono tracking-wider break-all leading-tight mt-0.5">
                        {currentItem.barcode ? (
                          currentItem.barcode
                        ) : (
                          <span className="text-[#68736B] font-sans font-semibold text-sm">
                            Barcode unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Camera Scan Button Trigger */}
                  <button
                    type="button"
                    onClick={() => setCameraScanOpen(true)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D1D5DB] text-[#12372A] font-bold text-xs hover:bg-[#E5E9E4] active:scale-95 transition-all shadow-sm"
                    title="Scan barcode using camera"
                  >
                    <Camera size={16} className="text-[#168A45]" />
                    <span className="hidden xs:inline">Scan</span>
                  </button>
                </section>
              )}

              {/* 6. QUANTITY CONTROLS & RUNNING TIMER PANEL */}
              {currentItem && (
                <section 
                  style={{ backgroundColor: '#F1F8F4', borderColor: '#D1E7DD' }}
                  className="mx-4 mt-3 sm:mx-5 rounded-2xl p-3.5 sm:p-4 border"
                >
                  {/* Top: Required Quantity Info */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm sm:text-[15px] font-extrabold text-[#17211B]">
                      Required Quantity
                    </span>
                    <span 
                      style={{ color: '#168A45' }}
                      className="text-lg sm:text-xl font-black"
                    >
                      {currentItem.allocated_quantity} {currentItem.unit || 'pcs'}
                    </span>
                  </div>

                  {/* Bottom: Stepper and Running Timer */}
                  <div className="flex items-center justify-between gap-3 mt-3 pt-1">
                    {/* Stepper Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDecrement}
                        disabled={currentPickedVal <= 0 || isItemCompleted}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#E5E9E4] text-[#17211B] font-black text-2xl flex items-center justify-center hover:bg-[#d9ded8] active:scale-95 transition-all disabled:opacity-40 shadow-sm"
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>

                      <div className="w-10 sm:w-12 text-center font-black text-2xl sm:text-3xl text-[#17211B] tracking-tight">
                        {currentPickedVal}
                      </div>

                      <button
                        type="button"
                        onClick={handleIncrement}
                        disabled={currentPickedVal >= currentItem.allocated_quantity || isItemCompleted}
                        style={{ backgroundColor: '#168A45' }}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl text-white font-black text-2xl flex items-center justify-center hover:bg-[#13733a] active:scale-95 transition-all disabled:opacity-40 shadow-sm"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    {/* Running Time-Taken Timer */}
                    <div className="flex items-center gap-2 pl-2">
                      <Clock size={28} className="text-[#168A45] flex-shrink-0" strokeWidth={2.4} />
                      <div className="text-left leading-none">
                        <span className="text-[10px] sm:text-[11px] font-semibold text-[#68736B] block mb-1">
                          Time Taken
                        </span>
                        <span 
                          style={{ color: '#168A45' }}
                          className="text-lg sm:text-[22px] font-black font-mono tracking-tight leading-none"
                        >
                          {formatElapsed(activeElapsedSecs)}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* 7. FULL-WIDTH CONFIRM PICK BUTTON */}
            {currentItem && (
              <div className="p-4 sm:p-5 pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleConfirmItem}
                  disabled={actionLoading || isItemCompleted}
                  style={{ backgroundColor: isItemCompleted ? '#68736B' : '#168A45' }}
                  className="w-full h-14 min-h-[56px] rounded-2xl text-white font-black text-base sm:text-lg tracking-wide shadow-md flex items-center justify-center gap-2.5 hover:bg-[#13733a] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="animate-spin text-white" size={20} />
                      <span>Confirming Pick...</span>
                    </>
                  ) : isItemCompleted ? (
                    <>
                      <CheckCircle size={22} className="text-white" strokeWidth={2.5} />
                      <span>Item Picked ({currentItem.picked_quantity} / {currentItem.allocated_quantity})</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={22} className="text-white" strokeWidth={2.5} />
                      <span>Confirm Pick ({currentPickedVal} / {currentItem.allocated_quantity})</span>
                    </>
                  )}
                </button>

                {/* Secondary Shortage and Navigation Controls */}
                <div className="flex items-center justify-between text-xs text-[#68736B] px-1 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenShortageDialog(currentItem)}
                    disabled={isItemCompleted}
                    className="text-[#D97706] font-bold hover:underline disabled:opacity-40"
                  >
                    Report Shelf Shortage
                  </button>

                  {totalItems > 1 && (
                    <div className="flex items-center gap-1 font-bold">
                      <button
                        type="button"
                        onClick={() => setActiveItemIndex(prev => Math.max(0, prev - 1))}
                        disabled={activeItemIndex === 0}
                        className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                        title="Previous item"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>{activeItemIndex + 1} / {totalItems}</span>
                      <button
                        type="button"
                        onClick={() => setActiveItemIndex(prev => Math.min(totalItems - 1, prev + 1))}
                        disabled={activeItemIndex >= totalItems - 1}
                        className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                        title="Next item"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SHORTAGE REPORTING POPOVER MODAL */}
      {shortageModalItem && (
        <Modal
          isOpen={!!shortageModalItem}
          onClose={() => setShortageModalItem(null)}
          title={`Report Shortage • ${shortageModalItem.product_name}`}
          size="md"
        >
          <div className="flex flex-col gap-3.5 text-xs text-[#17211B]">
            <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[#92400E]">
              <p className="font-bold flex items-center gap-1.5 m-0 mb-1 text-[#B45309]">
                <AlertTriangle size={15} className="text-[#D97706]" /> Safe Inventory Reconciliation
              </p>
              Allocated: <strong>{shortageModalItem.allocated_quantity} units</strong>. Any unpicked quantity will be automatically restored to warehouse inventory to prevent discrepancy.
            </div>

            <div className="form-group mb-0">
              <label className="font-bold text-xs text-[#17211B] block mb-1">
                Quantity Actually Found & Picked
              </label>
              <input
                type="number"
                min="0"
                max={shortageModalItem.allocated_quantity}
                className="form-input w-full h-9 font-black text-base"
                value={shortagePickedQty}
                onChange={e => setShortagePickedQty(Math.min(shortageModalItem.allocated_quantity, Math.max(0, parseInt(e.target.value, 10) || 0)))}
              />
              <span className="text-[11px] text-[#68736B] mt-1 block">
                Shortage: <strong className="text-[#D97706]">{Math.max(0, shortageModalItem.allocated_quantity - Number(shortagePickedQty))} units</strong> will be safely restored.
              </span>
            </div>

            <div className="form-group mb-0">
              <label className="font-bold text-xs text-[#17211B] block mb-1">
                Shortage Reason *
              </label>
              <select
                className="form-select w-full h-9 text-xs"
                value={shortageReason}
                onChange={e => setShortageReason(e.target.value)}
              >
                <option value="OUT_OF_STOCK">Out of Stock / Bin is Empty</option>
                <option value="PARTIAL_STOCK">Partial Stock on Shelf</option>
                <option value="DAMAGED_ITEM">Items Damaged / Unsellable</option>
                <option value="EXPIRED_BATCH">Batch Expired on Rack</option>
                <option value="WRONG_LOCATION">Product Not Found in Allocated Bin</option>
                <option value="OTHER">Other Reason</option>
              </select>
            </div>

            <div className="form-group mb-0">
              <label className="text-xs text-[#68736B] block mb-1">
                Notes / Discrepancy Observation
              </label>
              <textarea
                rows="2"
                className="form-input w-full text-xs resize-vertical"
                placeholder="Optional explanation for dark store supervisor..."
                value={shortageNotes}
                onChange={e => setShortageNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E9E4]">
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => setShortageModalItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                className="btn btn-primary text-xs font-black bg-[#D97706] border-[#D97706] text-white"
                onClick={handleSubmitShortage}
              >
                Confirm & Reconcile Inventory
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Camera Barcode Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={cameraScanOpen}
        onClose={() => setCameraScanOpen(false)}
        onScan={handleBarcodeScan}
        title="Scan Item to Confirm Pick"
      />
    </div>
  );
}
