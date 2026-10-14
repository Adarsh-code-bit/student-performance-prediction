import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Eye, Trash2, CheckCircle, PackageCheck, 
  Clock, ArrowRight, UserCheck, Layers, MapPin, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';

const Orders = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const isPicker = (user?.role === 'STAFF' && (user?.active_assignment || user?.staff_subrole) === 'PICKER') || user?.role === 'ADMIN' || user?.role === 'STORE_MANAGER';
  const isPacker = (user?.role === 'STAFF' && (user?.active_assignment || user?.staff_subrole) === 'PACKER') || user?.role === 'ADMIN' || user?.role === 'STORE_MANAGER';

  const defaultTab = (user?.role === 'STAFF' && (user?.active_assignment || user?.staff_subrole) === 'PACKER') 
    ? 'packing' 
    : (user?.role === 'STAFF' && (user?.active_assignment || user?.staff_subrole) === 'PICKER' ? 'picking' : 'all');

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [orders, setOrders] = useState([]);
  const [pickingQueue, setPickingQueue] = useState([]);
  const [packingQueue, setPackingQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

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

  useEffect(() => {
    fetchOrders();
    fetchDependencies();
  }, []);

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
        fetchOrders();
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

  const getStatusBadge = (status) => {
    const map = {
      'pending': 'status-warning',
      'confirmed': 'status-info',
      'picking_queue': 'status-warning',
      'picking_in_progress': 'status-warning',
      'picked': 'status-info',
      'packing_in_progress': 'status-info',
      'packed': 'status-success',
      'ready_for_dispatch': 'status-success',
      'dispatched': 'status-success',
      'delivered': 'status-success',
      'cancelled': 'status-danger'
    };
    return map[status] || 'status-default';
  };

  const filteredOrders = (activeTab === 'picking' ? pickingQueue : activeTab === 'packing' ? packingQueue : orders)
    .filter(o => 
      !search || 
      o.order_id?.toString().includes(search) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <PackageCheck className="text-primary-600" size={28} />
            Order Fulfillment & Dispatch
          </h1>
          <p className="text-gray-500 mt-1">
            Real-time dark store order fulfillment pipeline: Picking $\rightarrow$ Packing $\rightarrow$ Dispatch.
          </p>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)} 
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Create Order
        </button>
      </div>

      {/* Queue Tabs */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        <button 
          className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'all' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('all')}
        >
          All Orders ({orders.length})
        </button>

        {isPicker && (
          <button 
            className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'picking' 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('picking')}
          >
            <span>Picking Queue</span>
            {pickingQueue.length > 0 && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {pickingQueue.length}
              </span>
            )}
          </button>
        )}

        {isPacker && (
          <button 
            className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'packing' 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('packing')}
          >
            <span>Packing Queue</span>
            {packingQueue.length > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {packingQueue.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="filter-search relative w-72">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search Order # or Customer..." 
            className="form-input pl-9 w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="content-card">
        {loading ? (
          <div className="empty-state">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state">No orders in this queue.</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Assigned Staff</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => (
                  <tr key={o.order_id}>
                    <td><strong>#{o.order_id}</strong></td>
                    <td>{o.customer_name}</td>
                    <td>{new Date(o.order_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</td>
                    <td>{o.items_count} items</td>
                    <td><strong>₹{Number(o.total_amount).toLocaleString('en-IN')}</strong></td>
                    <td>
                      <span className={`status-badge ${getStatusBadge(o.status)}`}>
                        {o.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div className="text-xs">
                        {o.picker_name && <div className="text-amber-700">Picker: {o.picker_name}</div>}
                        {o.packer_name && <div className="text-blue-700">Packer: {o.packer_name}</div>}
                        {!o.picker_name && !o.packer_name && <span className="text-gray-400">Unassigned</span>}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5 items-center">
                        <button 
                          onClick={() => handleViewDetails(o.order_id)} 
                          className="btn-icon"
                          title="View Order Details"
                        >
                          <Eye size={18} />
                        </button>

                        {/* Picking Queue Actions */}
                        {isPicker && (o.status === 'confirmed' || o.status === 'pending' || o.status === 'picking_queue') && (
                          <button 
                            onClick={() => handleClaimPicking(o.order_id)} 
                            className="btn btn-primary btn-sm flex items-center gap-1"
                          >
                            Claim Picking
                          </button>
                        )}
                        {isPicker && o.status === 'picking_in_progress' && (
                          <button 
                            onClick={() => handleCompletePicking(o.order_id)} 
                            className="btn btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1"
                          >
                            <CheckCircle size={14} /> Finish Picking
                          </button>
                        )}

                        {/* Packing Queue Actions */}
                        {isPacker && o.status === 'picked' && (
                          <button 
                            onClick={() => handleClaimPacking(o.order_id)} 
                            className="btn btn-secondary btn-sm text-blue-600 border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                          >
                            Claim Packing
                          </button>
                        )}
                        {isPacker && o.status === 'packing_in_progress' && (
                          <button 
                            onClick={() => handleCompletePacking(o.order_id)} 
                            className="btn btn-primary btn-sm bg-blue-600 hover:bg-blue-700 flex items-center gap-1"
                          >
                            <PackageCheck size={14} /> Finish Packing
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      {/* Order Details & Picking Guide Modal */}
      <Modal 
        isOpen={showDetailsModal} 
        onClose={() => setShowDetailsModal(false)} 
        title={`Order #${selectedOrderDetails?.order_id} Details`} 
        size="lg"
      >
        {selectedOrderDetails && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg text-xs">
              <div>
                <span className="text-gray-500">Customer</span>
                <div className="font-bold text-sm text-gray-800">{selectedOrderDetails.customer_name}</div>
              </div>
              <div>
                <span className="text-gray-500">Status</span>
                <div>
                  <span className={`status-badge ${getStatusBadge(selectedOrderDetails.status)}`}>
                    {selectedOrderDetails.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-gray-500">Total Amount</span>
                <div className="font-bold text-sm text-gray-800">₹{Number(selectedOrderDetails.total_amount).toLocaleString('en-IN')}</div>
              </div>
              <div>
                <span className="text-gray-500">Assigned Dark Store</span>
                <div className="font-bold text-sm text-gray-800">{selectedOrderDetails.store_name || 'Koramangala Dark Store'}</div>
              </div>
            </div>

            <div className="text-sm font-semibold">Picking & Item Location Guide:</div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Warehouse Rack / Location</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrderDetails.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{it.product_name}</strong>
                        <div className="text-xs text-gray-500">{it.sku}</div>
                      </td>
                      <td>
                        <span className="badge badge-info flex items-center gap-1 w-fit">
                          <MapPin size={12} /> {it.rack_number || 'RACK-A1'} ({it.zone || 'ZONE-AMBIENT'})
                        </span>
                      </td>
                      <td><strong>{it.quantity} {it.unit || 'pcs'}</strong></td>
                      <td>₹{Number(it.unit_price).toLocaleString('en-IN')}</td>
                      <td>₹{Number(it.total_price).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4">
              <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Orders;
