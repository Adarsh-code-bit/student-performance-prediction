import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Eye, Trash2, CheckCircle, PackageCheck, 
  Clock, ArrowRight, UserCheck, Layers, MapPin, AlertCircle,
  Play, Activity, History, ShieldAlert, AlertTriangle,
  Volume2, VolumeX, Bell, WifiOff, X, Package
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import PickingStationModal from '../components/orders/PickingStationModal';
import PickingHistoryModal from '../components/orders/PickingHistoryModal';
import ManagerPickingDashboard from '../components/orders/ManagerPickingDashboard';
import OrderNotificationAlert from '../components/orders/OrderNotificationAlert';
import { audioAlert } from '../utils/audioAlert.util';

const Orders = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const isPicker = (user?.role === 'STAFF' && (user?.active_assignment || user?.staff_subrole) === 'PICKER') || user?.role === 'ADMIN' || user?.role === 'STORE_MANAGER';
  const isPacker = (user?.role === 'STAFF' && (user?.active_assignment || user?.staff_subrole) === 'PACKER') || user?.role === 'ADMIN' || user?.role === 'STORE_MANAGER';
  const isManager = user?.role === 'ADMIN' || user?.role === 'STORE_MANAGER';

  const defaultTab = (user?.role === 'STAFF' && (user?.active_assignment || user?.staff_subrole) === 'PACKER') 
    ? 'packing' 
    : (user?.role === 'STAFF' && (user?.active_assignment || user?.staff_subrole) === 'PICKER' ? 'picking' : 'all');

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [orders, setOrders] = useState([]);
  const [pickingQueue, setPickingQueue] = useState([]);
  const [packingQueue, setPackingQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Notifications & Sound State
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('picker_sound_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const alertedOrderIdsRef = useRef(new Set());
  const isSilencedRef = useRef(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  // Picking Station & Manager Audit Modals
  const [pickingStationOrderId, setPickingStationOrderId] = useState(null);
  const [historyInspectionOrderId, setHistoryInspectionOrderId] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    items: [{ product_id: '', quantity: 1, unit_price: 0 }]
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [ordRes, pickRes, packRes] = await Promise.all([
        api.get('/orders'),
        isPicker ? api.get('/orders/queue/picking').catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        isPacker ? api.get('/orders/queue/packing').catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } })
      ]);

      if (ordRes.data?.success) setOrders(ordRes.data.data || []);
      if (pickRes.data?.success) setPickingQueue(pickRes.data.data || []);
      if (packRes.data?.success) setPackingQueue(packRes.data.data || []);
    } catch (err) {
      addToast('Error loading orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        api.get('/customers'),
        api.get('/products')
      ]);
      setCustomers(custRes.data?.data || []);
      setProducts(prodRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load dependencies', err);
    }
  };

  // Actionable orders available for picking (not claimed yet)
  const actionableOrders = pickingQueue.filter(o => 
    ['pending', 'confirmed', 'picking_queue'].includes(o.status) && !o.assigned_picker_id
  );

  // Auto-polling for picker queue & automated newly actionable order detection
  useEffect(() => {
    fetchOrders();
    fetchDependencies();
  }, []);

  useEffect(() => {
    if (!isPicker) return;

    let isSubscribed = true;

    const pollPickingQueue = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const pickRes = await api.get('/orders/queue/picking');
        if (!isSubscribed) return;

        if (pickRes.data?.success) {
          const freshQueue = pickRes.data.data || [];
          setPickingQueue(freshQueue);
          setNetworkError(false);

          // Check actionable orders
          const currentActionables = freshQueue.filter(o => 
            ['pending', 'confirmed', 'picking_queue'].includes(o.status) && !o.assigned_picker_id
          );

          if (currentActionables.length === 0) {
            audioAlert.stopSiren();
            setIsSirenPlaying(false);
          } else {
            // Find unseen actionable orders
            const unseenOrders = currentActionables.filter(o => !alertedOrderIdsRef.current.has(o.order_id));
            if (unseenOrders.length > 0) {
              unseenOrders.forEach(o => alertedOrderIdsRef.current.add(o.order_id));
              if (soundEnabled && !isSilencedRef.current) {
                audioAlert.startSiren();
                setIsSirenPlaying(true);
              }
            }
          }
        }
      } catch (err) {
        if (!isSubscribed) return;
        console.warn('Picking queue poll error:', err.message);
        setNetworkError(true);
      }
    };

    const interval = setInterval(pollPickingQueue, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pollPickingQueue();
      }
    };

    const handleOnline = () => {
      setNetworkError(false);
      pollPickingQueue();
    };

    const handleOffline = () => {
      setNetworkError(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      audioAlert.stopSiren();
    };
  }, [isPicker, soundEnabled]);

  const handleToggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('picker_sound_enabled', String(next));
    } catch (e) {}

    if (next) {
      isSilencedRef.current = false;
      await audioAlert.init();
      addToast('Audio alert sound enabled', 'info');
      if (actionableOrders.length > 0) {
        audioAlert.startSiren();
        setIsSirenPlaying(true);
      }
    } else {
      audioAlert.stopSiren();
      setIsSirenPlaying(false);
      addToast('Audio alert sound muted', 'info');
    }
  };

  const handleSilenceAlert = () => {
    audioAlert.stopSiren();
    setIsSirenPlaying(false);
    isSilencedRef.current = true;
  };

  const handleViewDetails = async (id) => {
    try {
      const res = await api.get(`/orders/${id}`);
      if (res.data?.success) {
        setSelectedOrderDetails(res.data.data);
        setShowDetailsModal(true);
      }
    } catch (err) {
      addToast('Failed to load order details', 'error');
    }
  };

  // Picking Workflow Handlers
  const handleClaimPicking = async (orderId) => {
    try {
      const res = await api.post(`/orders/${orderId}/claim-picking`);
      if (res.data?.success) {
        addToast(res.data.message || 'Picking claimed', 'success');
        // Stop audible siren immediately when backend confirms claim
        audioAlert.stopSiren();
        setIsSirenPlaying(false);
        fetchOrders();
        // Automatically open the picking station for the picker
        setPickingStationOrderId(orderId);
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to claim picking', 'error');
    }
  };

  const handleCompletePicking = async (orderId) => {
    try {
      const res = await api.post(`/orders/${orderId}/complete-picking`);
      if (res.data?.success) {
        addToast(res.data.message || 'Picking completed! Sent to packing queue.', 'success');
        fetchOrders();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to complete picking', 'error');
    }
  };

  // Packing Workflow Handlers
  const handleClaimPacking = async (orderId) => {
    try {
      const res = await api.post(`/orders/${orderId}/claim-packing`);
      if (res.data?.success) {
        addToast(res.data.message || 'Packing claimed', 'success');
        fetchOrders();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to claim packing', 'error');
    }
  };

  const handleCompletePacking = async (orderId) => {
    try {
      const res = await api.post(`/orders/${orderId}/complete-packing`);
      if (res.data?.success) {
        addToast(res.data.message || 'Packing completed! Ready for dispatch.', 'success');
        fetchOrders();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to complete packing', 'error');
    }
  };

  // Create Order Handlers
  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: 1, unit_price: 0 }]
    }));
  };

  const handleRemoveItem = (idx) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleItemChange = (idx, field, val) => {
    const updated = [...formData.items];
    if (field === 'product_id') {
      const prod = products.find(p => p.product_id.toString() === val.toString());
      updated[idx] = {
        ...updated[idx],
        product_id: val,
        unit_price: prod ? Number(prod.unit_price) : 0
      };
    } else {
      updated[idx] = { ...updated[idx], [field]: val };
    }
    setFormData({ ...formData, items: updated });
  };

  const calculateTotal = () => {
    return formData.items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_id || formData.items.length === 0) {
      addToast('Please select customer and at least one product', 'error');
      return;
    }
    try {
      const res = await api.post('/orders', {
        customer_id: formData.customer_id,
        shipping_address: 'Quick Commerce Express Delivery',
        items: formData.items
      });
      if (res.data?.success) {
        addToast('Order created and sent to dark-store queue!', 'success');
        setShowCreateModal(false);
        setFormData({ customer_id: '', items: [{ product_id: '', quantity: 1, unit_price: 0 }] });
        fetchOrders();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create order', 'error');
    }
  };

  // Status Filter: 'ALL' | 'pending' | 'picking' | 'packed' | 'shipped' | 'delivered' | 'cancelled'
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'delivered':
        return <span className="status-badge status-success">Delivered</span>;
      case 'shipped':
      case 'dispatched':
        return <span className="status-badge status-info">Shipped</span>;
      case 'packed':
      case 'ready_for_dispatch':
        return <span className="status-badge status-picked">Packed</span>;
      case 'picking_in_progress':
      case 'picking_queue':
      case 'processing':
        return <span className="status-badge status-warning">In Picking</span>;
      case 'cancelled':
        return <span className="status-badge status-danger">Cancelled</span>;
      case 'pending':
      case 'confirmed':
      default:
        return <span className="status-badge badge-yellow">Pending</span>;
    }
  };

  const getPriorityBadge = (order) => {
    const s = (order.status || '').toLowerCase();
    if (s === 'delivered' || s === 'cancelled') {
      return <span style={{ fontSize: '11px', color: '#68736B', fontWeight: 500, whiteSpace: 'nowrap' }}>Standard</span>;
    }
    return (
      <span style={{
        fontSize: '10px',
        fontWeight: 800,
        backgroundColor: '#FEF3C7',
        color: '#B45309',
        border: '1px solid #FDE68A',
        padding: '2px 7px',
        borderRadius: '4px',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px'
      }}>
        10-MIN SLA
      </span>
    );
  };

  // Status counts for All Orders view
  const statusCounts = {
    ALL: orders.length,
    pending: orders.filter(o => ['pending', 'confirmed'].includes((o.status || '').toLowerCase())).length,
    picking: orders.filter(o => ['picking_in_progress', 'picking_queue', 'processing'].includes((o.status || '').toLowerCase())).length,
    packed: orders.filter(o => ['packed', 'ready_for_dispatch'].includes((o.status || '').toLowerCase())).length,
    shipped: orders.filter(o => ['shipped', 'dispatched'].includes((o.status || '').toLowerCase())).length,
    delivered: orders.filter(o => (o.status || '').toLowerCase() === 'delivered').length,
    cancelled: orders.filter(o => (o.status || '').toLowerCase() === 'cancelled').length,
  };

  // Workflow counts for Picking Queue view
  const pickingCounts = {
    ALL: pickingQueue.length,
    actionable: actionableOrders.length,
    in_progress: pickingQueue.filter(o => (o.status || '').toLowerCase() === 'picking_in_progress').length,
  };

  // Workflow counts for Packing Queue view
  const packingCounts = {
    ALL: packingQueue.length,
    awaiting: packingQueue.filter(o => (o.status || '').toLowerCase() === 'picked').length,
    in_progress: packingQueue.filter(o => (o.status || '').toLowerCase() === 'packing_in_progress').length,
  };

  const baseOrders = activeTab === 'picking' ? pickingQueue : activeTab === 'packing' ? packingQueue : orders;

  const filteredOrders = baseOrders.filter(o => {
    // Search matching order id, order number, customer name, and city
    const term = search.toLowerCase().trim();
    const matchesSearch = !search ||
      o.order_id?.toString().includes(term) ||
      o.order_number?.toLowerCase().includes(term) ||
      o.customer_name?.toLowerCase().includes(term) ||
      o.city?.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    // View-specific status filter
    if (activeTab === 'all') {
      if (statusFilter === 'ALL') return true;
      const st = (o.status || '').toLowerCase();
      if (statusFilter === 'pending') return st === 'pending' || st === 'confirmed';
      if (statusFilter === 'picking') return st === 'picking_in_progress' || st === 'picking_queue' || st === 'processing';
      if (statusFilter === 'packed') return st === 'packed' || st === 'ready_for_dispatch';
      if (statusFilter === 'shipped') return st === 'shipped' || st === 'dispatched';
      if (statusFilter === 'delivered') return st === 'delivered';
      if (statusFilter === 'cancelled') return st === 'cancelled';
      return true;
    } else if (activeTab === 'picking') {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'actionable') return !o.assigned_picker_id && ['pending', 'confirmed', 'picking_queue'].includes((o.status || '').toLowerCase());
      if (statusFilter === 'in_progress') return (o.status || '').toLowerCase() === 'picking_in_progress';
      return true;
    } else if (activeTab === 'packing') {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'awaiting') return (o.status || '').toLowerCase() === 'picked';
      if (statusFilter === 'in_progress') return (o.status || '').toLowerCase() === 'packing_in_progress';
      return true;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setStatusFilter('ALL');
    setCurrentPage(1);
  };

  return (
    <div className="page-container" style={{ width: '100%', minWidth: 0 }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#17211B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PackageCheck color="#168A45" size={24} />
              Order Management & Fulfillment
            </h1>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#12372A', color: '#F8CB46', letterSpacing: '0.04em' }}>
              10-MIN QUICK-COMMERCE
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#68736B' }}>
            Real-time dark store fulfillment stream: FEFO picking, packing station, and dispatch verification.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isPicker && (
            <button
              type="button"
              onClick={handleToggleSound}
              className="btn btn-secondary btn-sm"
              style={{
                height: '34px',
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: soundEnabled ? '#168A45' : '#68736B',
                borderColor: soundEnabled ? 'rgba(22, 138, 69, 0.4)' : '#E5E9E4',
                backgroundColor: soundEnabled ? '#E8F5ED' : '#FFFFFF'
              }}
              title={soundEnabled ? 'Alert sirens are enabled. Click to mute.' : 'Alert sirens are muted. Click to enable sound.'}
            >
              {soundEnabled ? <Volume2 size={15} color="#168A45" /> : <VolumeX size={15} color="#68736B" />}
              <span>{soundEnabled ? 'Sound ON' : 'Muted'}</span>
            </button>
          )}

          <button 
            onClick={() => setShowCreateModal(true)} 
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', fontSize: '12px' }}
          >
            <Plus size={15} /> Create Order
          </button>
        </div>
      </div>

      {/* Real-time Picker Order Siren & Notification Banner */}
      {isPicker && (
        <OrderNotificationAlert
          actionableOrders={actionableOrders}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          onClaim={handleClaimPicking}
          onSilence={handleSilenceAlert}
          isSirenPlaying={isSirenPlaying}
        />
      )}

      {/* Network Reconnection Indicator */}
      {networkError && (
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '12px', padding: '8px 14px', borderRadius: '8px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <WifiOff size={14} className="spin" color="#d97706" />
          <span>Connection interrupted. Retrying live queue synchronization...</span>
        </div>
      )}

      {/* Primary Queue Tabs (View Switcher) */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '2px solid #E5E9E4',
        marginBottom: '12px',
        flexWrap: 'wrap'
      }}>
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '6px 6px 0 0',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'all' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'all' ? '#168A45' : '#68736B',
            borderBottom: activeTab === 'all' ? '3px solid #168A45' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
          onClick={() => handleTabChange('all')}
        >
          <span>All Orders</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '9999px',
            fontWeight: 700,
            backgroundColor: activeTab === 'all' ? '#E8F5ED' : '#F0F2EE',
            color: activeTab === 'all' ? '#168A45' : '#68736B'
          }}>
            {orders.length}
          </span>
        </button>

        {isPicker && (
          <button 
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '6px 6px 0 0',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'picking' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'picking' ? '#168A45' : '#68736B',
              borderBottom: activeTab === 'picking' ? '3px solid #168A45' : '3px solid transparent',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
            onClick={() => handleTabChange('picking')}
          >
            <span>Picking Queue</span>
            {pickingQueue.length > 0 && (
              <span style={{
                fontSize: '11px',
                padding: '1px 8px',
                borderRadius: '9999px',
                fontWeight: 800,
                backgroundColor: actionableOrders.length > 0 ? '#F8CB46' : (activeTab === 'picking' ? '#E8F5ED' : '#F0F2EE'),
                color: '#12372A'
              }}>
                {pickingQueue.length}
              </span>
            )}
          </button>
        )}

        {isPacker && (
          <button 
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '6px 6px 0 0',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'packing' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'packing' ? '#168A45' : '#68736B',
              borderBottom: activeTab === 'packing' ? '3px solid #168A45' : '3px solid transparent',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
            onClick={() => handleTabChange('packing')}
          >
            <span>Packing Queue</span>
            {packingQueue.length > 0 && (
              <span style={{
                fontSize: '11px',
                padding: '1px 7px',
                borderRadius: '9999px',
                fontWeight: 700,
                backgroundColor: activeTab === 'packing' ? '#E8F5ED' : '#F0F2EE',
                color: activeTab === 'packing' ? '#168A45' : '#68736B'
              }}>
                {packingQueue.length}
              </span>
            )}
          </button>
        )}

        {isManager && (
          <button 
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '6px 6px 0 0',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'manager-activity' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'manager-activity' ? '#12372A' : '#68736B',
              borderBottom: activeTab === 'manager-activity' ? '3px solid #F8CB46' : '3px solid transparent',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
            onClick={() => handleTabChange('manager-activity')}
          >
            <Activity size={15} color="#168A45" />
            <span>Live Picking Activity</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#168A45' }} />
          </button>
        )}
      </div>

      {/* When Manager Activity Tab is Active */}
      {activeTab === 'manager-activity' ? (
        <ManagerPickingDashboard 
          onInspectHistory={orderId => setHistoryInspectionOrderId(orderId)}
          onOpenPickingStation={orderId => setPickingStationOrderId(orderId)}
        />
      ) : (
        <>
          {/* Sub-Filter Toolbar: Contextual Pills on Left, Search Input on Right */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '12px',
            backgroundColor: '#FFFFFF',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #E5E9E4'
          }}>
            {/* Contextual Status Filters */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
                Filter:
              </span>

              {activeTab === 'all' && [
                { id: 'ALL', label: 'All Statuses', count: statusCounts.ALL },
                { id: 'pending', label: 'Pending', count: statusCounts.pending },
                { id: 'picking', label: 'In Picking', count: statusCounts.picking },
                { id: 'packed', label: 'Packed', count: statusCounts.packed },
                { id: 'shipped', label: 'Shipped', count: statusCounts.shipped },
                { id: 'delivered', label: 'Delivered', count: statusCounts.delivered },
                { id: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled }
              ].map(tab => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: '9999px',
                      border: '1px solid',
                      borderColor: isActive ? '#168A45' : '#E5E9E4',
                      backgroundColor: isActive ? '#168A45' : '#F7F8F5',
                      color: isActive ? '#FFFFFF' : '#68736B',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{
                      fontSize: '10px',
                      opacity: isActive ? 0.9 : 0.7,
                      fontWeight: 700
                    }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}

              {activeTab === 'picking' && [
                { id: 'ALL', label: 'All in Queue', count: pickingCounts.ALL },
                { id: 'actionable', label: 'Actionable (Unassigned)', count: pickingCounts.actionable },
                { id: 'in_progress', label: 'In Progress', count: pickingCounts.in_progress }
              ].map(tab => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: '9999px',
                      border: '1px solid',
                      borderColor: isActive ? '#168A45' : '#E5E9E4',
                      backgroundColor: isActive ? '#168A45' : '#F7F8F5',
                      color: isActive ? '#FFFFFF' : '#68736B',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{ fontSize: '10px', opacity: isActive ? 0.9 : 0.7, fontWeight: 700 }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}

              {activeTab === 'packing' && [
                { id: 'ALL', label: 'All in Queue', count: packingCounts.ALL },
                { id: 'awaiting', label: 'Awaiting Pack', count: packingCounts.awaiting },
                { id: 'in_progress', label: 'In Packing', count: packingCounts.in_progress }
              ].map(tab => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: '9999px',
                      border: '1px solid',
                      borderColor: isActive ? '#168A45' : '#E5E9E4',
                      backgroundColor: isActive ? '#168A45' : '#F7F8F5',
                      color: isActive ? '#FFFFFF' : '#68736B',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{ fontSize: '10px', opacity: isActive ? 0.9 : 0.7, fontWeight: 700 }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input with Clear Button and Result Counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 260px', justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#68736B' }} />
                <input 
                  type="text" 
                  placeholder="Search Order ID, customer, city..." 
                  className="form-input"
                  style={{
                    paddingLeft: '32px',
                    paddingRight: search ? '28px' : '10px',
                    height: '32px',
                    fontSize: '12px',
                    width: '100%'
                  }}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setCurrentPage(1); }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9AA39D',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Clear search query"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <span style={{ fontSize: '11px', color: '#68736B', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
              </span>
            </div>
          </div>

          {/* Orders Table Card */}
          <div className="content-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E5E9E4', borderRadius: '10px', backgroundColor: '#FFFFFF' }}>
            {loading ? (
              <div className="empty-state" style={{ padding: '60px 0', textAlign: 'center' }}>
                <div className="loading-spinner"></div>
                <p style={{ marginTop: '12px', color: '#68736B', fontSize: '13px' }}>Loading dark store orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
                <PackageCheck size={40} style={{ color: '#9AA39D', margin: '0 auto 12px' }} />
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#17211B' }}>No orders found</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#68736B' }}>
                  {search ? `No orders match "${search}". Try clearing search or status filter.` : 'No orders found matching selected filter.'}
                </p>
              </div>
            ) : (
              <div>
                <div className="table-responsive" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table className="data-table table-compact" style={{ width: '100%', minWidth: '960px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '100px' }}>Order ID</th>
                        <th style={{ width: '190px' }}>Customer Reference</th>
                        <th style={{ width: '120px' }}>Created At</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Items</th>
                        <th className="col-currency" style={{ width: '110px', textAlign: 'right' }}>Order Value</th>
                        <th style={{ width: '105px', textAlign: 'center' }}>Priority</th>
                        <th style={{ width: '130px' }}>Fulfillment Status</th>
                        <th style={{ width: '145px' }}>Assigned Staff</th>
                        <th className="col-actions" style={{ width: '160px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.map(o => (
                        <tr key={o.order_id}>
                          {/* Order ID */}
                          <td>
                            <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: '#17211B', letterSpacing: '-0.02em' }}>
                              #{o.order_number || (`ORD-${o.order_id}`)}
                            </strong>
                          </td>

                          {/* Customer Reference */}
                          <td>
                            <div style={{ fontWeight: 600, color: '#17211B', fontSize: '13px', lineHeight: 1.3 }}>
                              {o.customer_name || 'Quick Commerce Customer'}
                            </div>
                            {o.city && (
                              <div style={{ fontSize: '11px', color: '#68736B', marginTop: '2px' }}>
                                {o.city}
                              </div>
                            )}
                          </td>

                          {/* Creation Time */}
                          <td>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#17211B', whiteSpace: 'nowrap' }}>
                              {new Date(o.order_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div style={{ fontSize: '11px', color: '#68736B', marginTop: '1px', whiteSpace: 'nowrap' }}>
                              {new Date(o.order_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </td>

                          {/* Item Count */}
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 600, color: '#17211B', fontSize: '12px', whiteSpace: 'nowrap' }}>
                              {o.items_count || 1} {(o.items_count === 1) ? 'item' : 'items'}
                            </span>
                          </td>

                          {/* Order Value (Right-Aligned) */}
                          <td className="col-currency" style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 800, color: '#168A45', fontSize: '13px', whiteSpace: 'nowrap' }}>
                              ₹{Number(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* Priority */}
                          <td style={{ textAlign: 'center' }}>
                            {getPriorityBadge(o)}
                          </td>

                          {/* Fulfillment Status */}
                          <td>
                            {getStatusBadge(o.status)}
                          </td>

                          {/* Assigned Staff */}
                          <td>
                            <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                              {o.picker_name && (
                                <div style={{ color: '#B45309', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  Picker: {o.picker_name}
                                </div>
                              )}
                              {o.packer_name && (
                                <div style={{ color: '#1D4ED8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  Packer: {o.packer_name}
                                </div>
                              )}
                              {!o.picker_name && !o.packer_name && (
                                <span style={{ color: '#9AA39D', fontWeight: 500 }}>Unassigned</span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="col-actions">
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                              <button 
                                onClick={() => handleViewDetails(o.order_id)} 
                                className="btn btn-secondary btn-sm"
                                style={{ height: '28px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="View Order Details & Allocations"
                              >
                                <Eye size={12} /> View
                              </button>

                              {/* Manager History Audit */}
                              {isManager && (
                                <button
                                  onClick={() => setHistoryInspectionOrderId(o.order_id)}
                                  className="btn-icon"
                                  title="Inspect Picking History"
                                  style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                >
                                  <History size={13} />
                                </button>
                              )}

                              {/* Picking Actions */}
                              {isPicker && (o.status === 'confirmed' || o.status === 'pending' || o.status === 'picking_queue') && (
                                <button 
                                  onClick={() => handleClaimPicking(o.order_id)} 
                                  className="btn btn-brand btn-sm"
                                  style={{ height: '28px', padding: '0 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800 }}
                                >
                                  <Play size={11} fill="currentColor" /> Claim
                                </button>
                              )}

                              {isPicker && o.status === 'picking_in_progress' && (
                                <button 
                                  onClick={() => setPickingStationOrderId(o.order_id)} 
                                  className="btn btn-primary btn-sm"
                                  style={{ height: '28px', padding: '0 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                                >
                                  <MapPin size={11} /> Station
                                </button>
                              )}

                              {/* Packing Actions */}
                              {isPacker && o.status === 'picked' && (
                                <button 
                                  onClick={() => handleClaimPacking(o.order_id)} 
                                  className="btn btn-secondary btn-sm"
                                  style={{ height: '28px', padding: '0 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#168A45', borderColor: '#168A45' }}
                                >
                                  Claim Packing
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderTop: '1px solid #E5E9E4',
                  backgroundColor: '#FFFFFF',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '12px', color: '#68736B' }}>
                    Showing <strong>{filteredOrders.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0}</strong> to <strong>{Math.min(currentPage * pageSize, filteredOrders.length)}</strong> of <strong>{filteredOrders.length}</strong> orders
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#68736B' }}>Rows:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="form-select"
                      style={{ height: '28px', padding: '2px 8px', fontSize: '12px', width: 'auto' }}
                    >
                      <option value={15}>15</option>
                      <option value={30}>30</option>
                      <option value={50}>50</option>
                    </select>

                    <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                      >
                        Previous
                      </button>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', fontSize: '12px', fontWeight: 600, color: '#17211B' }}>
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Picking Station Modal (Phase 2C Picker Guidance & Execution) */}
      <PickingStationModal
        isOpen={!!pickingStationOrderId}
        onClose={() => setPickingStationOrderId(null)}
        orderId={pickingStationOrderId}
        onOrderUpdated={fetchOrders}
      />

      {/* Manager Inspection Modal (Phase 2D Item & Event Audit Trail) */}
      <PickingHistoryModal
        isOpen={!!historyInspectionOrderId}
        onClose={() => setHistoryInspectionOrderId(null)}
        orderId={historyInspectionOrderId}
      />

      {/* Create Order Modal */}
      <Modal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        title="Create Quick-Commerce Order" 
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Customer *</label>
            <select 
              className="form-select" 
              value={formData.customer_id} 
              onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
              required
            >
              <option value="">Select customer...</option>
              {customers.map(c => (
                <option key={c.customer_id} value={c.customer_id}>{c.customer_name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <label className="form-label font-bold">Order Items</label>
          <div className="space-y-2">
            {formData.items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select 
                  className="form-select flex-1"
                  value={item.product_id}
                  onChange={e => handleItemChange(idx, 'product_id', e.target.value)}
                  required
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.product_id} value={p.product_id}>{p.product_name} (₹{p.unit_price})</option>
                  ))}
                </select>
                <input 
                  type="number" 
                  min="1" 
                  className="form-input w-24" 
                  placeholder="Qty"
                  value={item.quantity} 
                  onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                  required 
                />
                <button 
                  type="button" 
                  onClick={() => handleRemoveItem(idx)}
                  className="btn-icon danger" 
                  disabled={formData.items.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={handleAddItem} className="btn btn-secondary btn-sm flex items-center gap-1">
            <Plus size={14} /> Add Another Product
          </button>

          <div className="pt-4 border-t flex justify-between items-center">
            <div className="text-lg font-bold">Total: ₹{calculateTotal().toLocaleString('en-IN')}</div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Order</button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Order Details & Location Guide Modal */}
      <Modal 
        isOpen={showDetailsModal} 
        onClose={() => setShowDetailsModal(false)} 
        title={`Order #${selectedOrderDetails?.order_id} Details & Allocated Locations`} 
        size="lg"
      >
        {selectedOrderDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              padding: '14px 16px',
              backgroundColor: '#F7F8F5',
              borderRadius: '8px',
              border: '1px solid #E5E9E4',
              fontSize: '12px'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#68736B', textTransform: 'uppercase', fontWeight: 600 }}>Customer</span>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#17211B', marginTop: '2px' }}>{selectedOrderDetails.customer_name}</div>
                {selectedOrderDetails.city && (
                  <div style={{ fontSize: '11px', color: '#68736B' }}>{selectedOrderDetails.city}</div>
                )}
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#68736B', textTransform: 'uppercase', fontWeight: 600 }}>Status</span>
                <div style={{ marginTop: '2px' }}>
                  {getStatusBadge(selectedOrderDetails.status)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#68736B', textTransform: 'uppercase', fontWeight: 600 }}>Total Amount</span>
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#168A45', marginTop: '2px' }}>
                  ₹{Number(selectedOrderDetails.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#68736B', textTransform: 'uppercase', fontWeight: 600 }}>Assigned Dark Store</span>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#17211B', marginTop: '2px' }}>
                  {selectedOrderDetails.store_name || `Store #${selectedOrderDetails.store_id || 1}`}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '13px', fontWeight: 700, color: '#17211B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={15} style={{ color: '#168A45' }} />
              <span>Exact Rack-Level Storage Allocations:</span>
            </div>
            
            <div className="table-responsive" style={{ border: '1px solid #E5E9E4', borderRadius: '8px' }}>
              <table className="data-table table-compact" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Storage Location</th>
                    <th>Batch</th>
                    <th style={{ textAlign: 'center' }}>Allocated Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrderDetails.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            minWidth: '36px',
                            borderRadius: '6px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E5E9E4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            padding: '2px'
                          }}>
                            {it.image_url ? (
                              <img 
                                src={it.image_url} 
                                alt={it.product_name} 
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div style={{
                              display: it.image_url ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#68736B'
                            }}>
                              <Package size={16} />
                            </div>
                          </div>
                          <div>
                            <strong style={{ fontSize: '12px', color: '#17211B' }}>{it.product_name}</strong>
                            <div style={{ fontSize: '11px', color: '#68736B', fontFamily: 'monospace' }}>{it.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {it.is_location_assigned ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#EBF5FF',
                            color: '#1E40AF',
                            fontWeight: 600
                          }}>
                            <MapPin size={11} /> {it.location_display}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#FEF3C7',
                            color: '#B45309',
                            fontWeight: 600
                          }}>
                            <AlertCircle size={11} /> Location not assigned
                          </span>
                        )}
                      </td>
                      <td>
                        {it.batch_code ? (
                          <span style={{
                            fontFamily: 'monospace',
                            color: '#6B21A8',
                            backgroundColor: '#F3E8FF',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600
                          }}>
                            {it.batch_code}
                          </span>
                        ) : (
                          <span style={{ color: '#9AA39D' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <strong style={{ fontSize: '12px' }}>{it.allocated_quantity || it.quantity} {it.unit || 'pcs'}</strong>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        ₹{Number(it.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#168A45' }}>
                        ₹{Number(it.total_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #E5E9E4' }}>
              {isPicker && selectedOrderDetails.status === 'picking_in_progress' && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, height: '32px' }}
                  onClick={() => {
                    setShowDetailsModal(false);
                    setPickingStationOrderId(selectedOrderDetails.order_id);
                  }}
                >
                  <MapPin size={14} /> Open in Picking Station
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Orders;
