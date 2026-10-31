import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import api from '../services/api';
import { initSocket, getSocket } from '../services/socket';
import { audioAlert } from '../utils/audioAlert.util';
import { initNotificationService, triggerOrderNotification, requestNotificationPermission } from '../utils/notification.util';
import PickerMobileAlertModal from '../components/orders/PickerMobileAlertModal';
import PickingStationModal from '../components/orders/PickingStationModal';
import Modal from '../components/shared/Modal';
import { MapPin, Package, Clock, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';

const PickerAlertContext = createContext(null);

export const PickerAlertProvider = ({ children }) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Alert queue of new orders awaiting picker attention
  const [alertQueue, setAlertQueue] = useState([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('picker_sound_enabled') !== 'false';
    } catch (e) {
      return true;
    }
  });

  // Active modals controlled from picker alerts
  const [pickingStationOrderId, setPickingStationOrderId] = useState(null);
  const [viewOrderDetails, setViewOrderDetails] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Set to track alerted order IDs and prevent duplicate alerts
  const alertedOrderIdsRef = useRef(new Set());
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const isPicker = (user?.role === 'STAFF' && (user?.active_assignment || user?.staff_subrole) === 'PICKER') ||
                   user?.role === 'ADMIN' || 
                   user?.role === 'STORE_MANAGER';

  // Initialize Service Worker for background push/notifications
  useEffect(() => {
    initNotificationService();
    // Pre-request notification permission on picker login if default
    if (isPicker && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      requestNotificationPermission();
    }
  }, [isPicker]);

  // Connect and bind Socket.IO listeners
  useEffect(() => {
    if (!user || !isPicker) {
      audioAlert.stopSiren();
      setIsSirenPlaying(false);
      return;
    }

    const socket = initSocket();
    if (!socket) return;

    // Handle incoming real-time order alert strictly for this picker's store
    const handleNewOrderAlert = (alertData) => {
      if (!alertData || !alertData.order_id) return;

      // Prevent duplicate alert triggers for the same order ID
      if (alertedOrderIdsRef.current.has(alertData.order_id)) {
        return;
      }
      alertedOrderIdsRef.current.add(alertData.order_id);

      // Add to alert queue
      setAlertQueue(prev => [...prev, alertData]);

      // Play alert sound if enabled
      if (soundEnabledRef.current) {
        audioAlert.startSiren().then(() => {
          setIsSirenPlaying(true);
        });
      }

      // Trigger mobile background notification if document is hidden
      if (document.visibilityState !== 'visible') {
        triggerOrderNotification(alertData);
      }
    };

    // Handle order claimed by any picker (auto-dismiss on all other picker screens)
    const handleOrderClaimed = ({ order_id, picker_id }) => {
      const numOrderId = Number(order_id);
      setAlertQueue(prev => {
        const updated = prev.filter(item => Number(item.order_id) !== numOrderId);
        if (updated.length === 0) {
          audioAlert.stopSiren();
          setIsSirenPlaying(false);
        }
        return updated;
      });

      // If claimed by another picker while visible, inform user
      if (Number(picker_id) !== Number(user.user_id)) {
        alertedOrderIdsRef.current.add(numOrderId);
      }
    };

    socket.on('new_order_alert', handleNewOrderAlert);
    socket.on('order_claimed', handleOrderClaimed);

    return () => {
      socket.off('new_order_alert', handleNewOrderAlert);
      socket.off('order_claimed', handleOrderClaimed);
      audioAlert.stopSiren();
      setIsSirenPlaying(false);
    };
  }, [user, isPicker]);

  // Toggle siren sound mute/unmute
  const toggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('picker_sound_enabled', String(next));
    } catch (e) {}

    if (next) {
      await audioAlert.init();
      addToast('Alert siren enabled', 'info');
      if (alertQueue.length > 0) {
        audioAlert.startSiren();
        setIsSirenPlaying(true);
      }
    } else {
      audioAlert.stopSiren();
      setIsSirenPlaying(false);
      addToast('Alert siren muted', 'info');
    }
  };

  // Silence current siren sound (without dismissing the order or cancelling)
  const acknowledgeSound = () => {
    audioAlert.stopSiren();
    setIsSirenPlaying(false);
  };

  // Dismiss current alert from modal
  const dismissCurrentAlert = () => {
    acknowledgeSound();
    setAlertQueue(prev => {
      const remaining = prev.slice(1);
      if (remaining.length === 0) {
        audioAlert.stopSiren();
        setIsSirenPlaying(false);
      }
      return remaining;
    });
  };

  // Accept Order: claims picking via existing backend workflow & opens picking station
  const acceptOrder = async (orderId) => {
    if (isClaiming) return;
    setIsClaiming(true);
    acknowledgeSound();

    try {
      const res = await api.post(`/orders/${orderId}/claim-picking`);
      if (res.data?.success) {
        addToast(res.data.message || `Order #${orderId} accepted for picking!`, 'success');

        // Remove from queue
        setAlertQueue(prev => prev.filter(o => Number(o.order_id) !== Number(orderId)));

        // Open picking station with barcode scanner immediately
        setPickingStationOrderId(orderId);
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Failed to accept order';

      if (status === 409) {
        addToast(`Order #${orderId} was already accepted by another picker.`, 'warning');
      } else {
        addToast(message, 'error');
      }

      // Remove conflicting/unclaimable order from active queue
      setAlertQueue(prev => prev.filter(o => Number(o.order_id) !== Number(orderId)));
    } finally {
      setIsClaiming(false);
    }
  };

  // View Order: opens detailed modal for inspecting items and locations
  const viewOrder = async (orderId) => {
    acknowledgeSound();
    setViewLoading(true);
    try {
      const res = await api.get(`/orders/${orderId}`);
      if (res.data?.success) {
        setViewOrderDetails(res.data.data);
      }
    } catch (err) {
      addToast('Failed to load order details', 'error');
    } finally {
      setViewLoading(false);
    }
  };

  const activeAlert = alertQueue[0] || null;

  return (
    <PickerAlertContext.Provider
      value={{
        alertQueue,
        activeAlert,
        soundEnabled,
        isSirenPlaying,
        isClaiming,
        toggleSound,
        acknowledgeSound,
        dismissCurrentAlert,
        acceptOrder,
        viewOrder,
        openPickingStation: setPickingStationOrderId
      }}
    >
      {children}

      {/* Prominent Picker Mobile Order Alert Modal */}
      {isPicker && (
        <PickerMobileAlertModal
          isOpen={!!activeAlert}
          order={activeAlert}
          onAccept={acceptOrder}
          onView={viewOrder}
          onClose={dismissCurrentAlert}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          onAcknowledgeSound={acknowledgeSound}
          isSirenPlaying={isSirenPlaying}
          isClaiming={isClaiming}
        />
      )}

      {/* Picking Station Modal with Barcode Scanning */}
      <PickingStationModal
        isOpen={!!pickingStationOrderId}
        onClose={() => setPickingStationOrderId(null)}
        orderId={pickingStationOrderId}
        onOrderUpdated={() => {
          // Trigger order refresh event if needed
          window.dispatchEvent(new CustomEvent('order-updated'));
        }}
      />

      {/* Order Details Modal (when View Order is tapped) */}
      {viewOrderDetails && (
        <Modal
          isOpen={!!viewOrderDetails}
          onClose={() => setViewOrderDetails(null)}
          title={`Order #${viewOrderDetails.order_id} Details`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg text-xs">
              <div>
                <span className="text-slate-500 block font-medium">Status</span>
                <span className="font-bold uppercase text-amber-700">{viewOrderDetails.status}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Customer</span>
                <span className="font-bold text-slate-800">{viewOrderDetails.customer_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Total Amount</span>
                <span className="font-bold text-slate-900">₹{Number(viewOrderDetails.total_amount).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Items</span>
                <span className="font-bold text-slate-900">{viewOrderDetails.items?.length || 0} items</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin size={14} className="text-indigo-600" />
                <span>Warehouse Storage & Rack Locations</span>
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5">Location</th>
                      <th className="p-2.5">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewOrderDetails.items?.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium text-slate-900">
                          {it.product_name}
                          <div className="text-[11px] text-slate-400 font-mono">{it.barcode || it.sku}</div>
                        </td>
                        <td className="p-2.5">
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 w-fit">
                            <MapPin size={11} />
                            {it.location_display || 'Location not assigned'}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold font-mono">
                          x {it.allocated_quantity || it.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200 gap-2">
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => setViewOrderDetails(null)}
              >
                Close
              </button>

              {['pending', 'confirmed', 'picking_queue'].includes(viewOrderDetails.status) && (
                <button
                  type="button"
                  className="btn btn-primary text-xs font-bold flex items-center gap-1.5"
                  disabled={isClaiming}
                  onClick={() => {
                    const id = viewOrderDetails.order_id;
                    setViewOrderDetails(null);
                    acceptOrder(id);
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>Accept & Start Picking</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </PickerAlertContext.Provider>
  );
};

export const usePickerAlert = () => useContext(PickerAlertContext);
