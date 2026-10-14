import React, { useState, useEffect } from 'react';
import { Plus, Eye, X, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';

const Purchases = () => {
  const { addToast } = useToast();
  
  // Data states
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dropdown states
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Form states
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const initialFormState = {
    supplier_id: '',
    purchase_date: getTodayDate(),
    location_id: '',
    notes: ''
  };
  
  const generateBatchCode = (dateStr, index) => {
    const datePart = (dateStr || getTodayDate()).replace(/-/g, '');
    return `BCH-${datePart}-${String(index + 1).padStart(3, '0')}`;
  };

  const createEmptyItem = (index, dateStr) => ({
    product_id: '',
    quantity: '',
    unit_price: '',
    batch_code: generateBatchCode(dateStr, index),
    manufacturing_date: '',
    expiry_date: ''
  });

  const [form, setForm] = useState(initialFormState);
  const [items, setItems] = useState([createEmptyItem(0, getTodayDate())]);
  const [saving, setSaving] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [purchasesRes, suppliersRes, productsRes, locationsRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/suppliers'),
        api.get('/products'),
        api.get('/locations')
      ]);
      
      if (purchasesRes.data.success) setPurchases(purchasesRes.data.data);
      if (suppliersRes.data.success) setSuppliers(suppliersRes.data.data);
      if (productsRes.data.success) setProducts(productsRes.data.data);
      if (locationsRes.data.success) setLocations(locationsRes.data.data);
      
    } catch (err) {
      console.error('Failed to fetch data', err);
      setError('Failed to load purchases data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      const res = await api.get('/purchases');
      if (res.data.success) setPurchases(res.data.data);
    } catch (err) {
      console.error('Failed to fetch purchases', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers for Detail View
  const handleViewDetail = async (id) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setSelectedPurchase(null);
    
    try {
      const res = await api.get(`/purchases/${id}`);
      if (res.data.success) {
        setSelectedPurchase(res.data.data);
      } else {
        addToast(res.data.message || 'Failed to load purchase details', 'danger');
        setDetailModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to fetch purchase details', err);
      addToast(err.response?.data?.message || 'Failed to load purchase details', 'danger');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Handlers for Form
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Update batch codes if purchase_date changes
    if (name === 'purchase_date') {
      const updatedItems = items.map((item, index) => ({
        ...item,
        batch_code: generateBatchCode(value, index)
      }));
      setItems(updatedItems);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const handleAddItem = () => {
    setItems([...items, createEmptyItem(items.length, form.purchase_date)]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return; // Prevent removing last item
    const updatedItems = items.filter((_, i) => i !== index);
    // Re-generate batch codes to keep them sequential
    const reindexedItems = updatedItems.map((item, i) => ({
      ...item,
      batch_code: generateBatchCode(form.purchase_date, i)
    }));
    setItems(reindexedItems);
  };

  const resetForm = () => {
    setForm(initialFormState);
    setItems([createEmptyItem(0, initialFormState.purchase_date)]);
  };

  const validateForm = () => {
    if (!form.supplier_id) return 'Supplier is required';
    if (!form.purchase_date) return 'Purchase date is required';
    if (!form.location_id) return 'Location is required';
    if (items.length === 0) return 'At least one item is required';
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) return `Item ${i + 1}: Product is required`;
      if (!item.quantity || Number(item.quantity) <= 0) return `Item ${i + 1}: Quantity must be greater than 0`;
      if (!item.unit_price || Number(item.unit_price) <= 0) return `Item ${i + 1}: Unit price must be greater than 0`;
      if (!item.batch_code) return `Item ${i + 1}: Batch code is required`;
      if (!item.manufacturing_date) return `Item ${i + 1}: Manufacturing date is required`;
      if (!item.expiry_date) return `Item ${i + 1}: Expiry date is required`;
    }
    
    return null; // No errors
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errorMsg = validateForm();
    if (errorMsg) {
      addToast(errorMsg, 'warning');
      return;
    }

    setSaving(true);
    
    try {
      // Prepare payload, adding cost_price = unit_price
      const payload = {
        ...form,
        items: items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          cost_price: Number(item.unit_price)
        }))
      };
      
      const res = await api.post('/purchases', payload);
      
      if (res.data.success) {
        addToast('Purchase created successfully', 'success');
        setCreateModalOpen(false);
        resetForm();
        fetchPurchases();
      } else {
        addToast(res.data.message || 'Failed to create purchase', 'danger');
      }
    } catch (err) {
      console.error('Submit error:', err);
      addToast(err.response?.data?.message || 'An error occurred while saving', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Utilities for formatting
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  const formatCurrency = (amount) => {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
  };

  const totalAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    return sum + (qty * price);
  }, 0);

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100%', minHeight: '300px' }}>
        <Loader2 className="spinner" size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <AlertCircle size={48} className="danger-text mb-2" />
        <h3>Error</h3>
        <p>{error}</p>
        <button className="btn btn-primary mt-3" onClick={fetchData}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchases</h1>
          <p className="page-subtitle">Manage inventory incoming stock</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={18} />
            Add Purchase
          </button>
        </div>
      </div>

      <div className="content-card">
        {purchases.length === 0 ? (
          <div className="empty-state">
            <p>No purchases found.</p>
            <button className="btn btn-secondary mt-3" onClick={() => setCreateModalOpen(true)}>
              Create your first purchase
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID (#)</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Total (₹)</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(purchase => (
                  <tr key={purchase.id}>
                    <td>#{purchase.id}</td>
                    <td>{purchase.supplier_name || 'Unknown Supplier'}</td>
                    <td>{formatDate(purchase.purchase_date)}</td>
                    <td>{formatCurrency(purchase.total_amount)}</td>
                    <td>
                      <span className={`badge ${
                        purchase.status === 'received' ? 'success' :
                        purchase.status === 'pending' ? 'warning' :
                        purchase.status === 'cancelled' ? 'danger' : 'secondary'
                      }`}>
                        {purchase.status || 'unknown'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button 
                        className="btn-icon" 
                        title="View Details"
                        onClick={() => handleViewDetail(purchase.id)}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal 
        isOpen={detailModalOpen} 
        onClose={() => setDetailModalOpen(false)}
        title="Purchase Details"
        size="lg"
      >
        <div className="modal-body">
          {detailLoading ? (
            <div className="flex-center py-4">
              <Loader2 className="spinner" size={32} />
            </div>
          ) : selectedPurchase ? (
            <>
              <div className="detail-grid mb-4">
                <div className="detail-item">
                  <span className="detail-label">Purchase ID</span>
                  <span className="detail-value">#{selectedPurchase.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Supplier</span>
                  <span className="detail-value">{selectedPurchase.supplier_name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Date</span>
                  <span className="detail-value">{formatDate(selectedPurchase.purchase_date)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Total Amount</span>
                  <span className="detail-value">{formatCurrency(selectedPurchase.total_amount)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span className="detail-value">
                    <span className={`badge ${
                      selectedPurchase.status === 'received' ? 'success' :
                      selectedPurchase.status === 'pending' ? 'warning' :
                      selectedPurchase.status === 'cancelled' ? 'danger' : 'secondary'
                    }`}>
                      {selectedPurchase.status}
                    </span>
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Notes</span>
                  <span className="detail-value">{selectedPurchase.notes || '-'}</span>
                </div>
              </div>

              <h4 className="mb-2">Items</h4>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Total Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchase.items && selectedPurchase.items.length > 0 ? (
                      selectedPurchase.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.product_name || `Product #${item.product_id}`}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unit_price)}</td>
                          <td>{formatCurrency(item.quantity * item.unit_price)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center py-3 text-muted">No items found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-4 danger-text">
              Failed to load details.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setDetailModalOpen(false)}>Close</button>
        </div>
      </Modal>

      {/* Create Purchase Modal */}
      <Modal 
        isOpen={createModalOpen} 
        onClose={() => !saving && setCreateModalOpen(false)}
        title="Add Purchase"
        size="xl"
      >
        <div className="modal-body">
          <form id="purchase-form" onSubmit={handleSubmit}>
            <div className="form-grid mb-4">
              <div className="form-group">
                <label className="form-label">Supplier *</label>
                <select 
                  className="form-select" 
                  name="supplier_id"
                  value={form.supplier_id}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Purchase Date *</label>
                <input 
                  type="date" 
                  className="form-input" 
                  name="purchase_date"
                  value={form.purchase_date}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location *</label>
                <select 
                  className="form-select" 
                  name="location_id"
                  value={form.location_id}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select Location</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea 
                  className="form-textarea" 
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  rows="2"
                  placeholder="Optional notes"
                ></textarea>
              </div>
            </div>

            <div className="purchase-items-header flex-between mb-3">
              <h4>Items</h4>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="purchase-items-list mb-4">
              {items.map((item, index) => (
                <div key={index} className="purchase-item-row p-3 mb-3 border rounded" style={{ position: 'relative' }}>
                  {items.length > 1 && (
                    <button 
                      type="button"
                      className="btn-icon btn-sm danger purchase-item-remove" 
                      onClick={() => handleRemoveItem(index)}
                      style={{ position: 'absolute', top: '10px', right: '10px' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  
                  <div className="form-grid mb-0" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className="form-group">
                      <label className="form-label">Product *</label>
                      <select 
                        className="form-select" 
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        required
                      >
                        <option value="">Select Product</option>
                        {products.map(prod => (
                          <option key={prod.id} value={prod.id}>{prod.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Batch Code *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={item.batch_code}
                        onChange={(e) => handleItemChange(index, 'batch_code', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Quantity *</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        min="1"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit Price (₹) *</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Manufacturing Date *</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={item.manufacturing_date}
                        onChange={(e) => handleItemChange(index, 'manufacturing_date', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Expiry Date *</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={item.expiry_date}
                        onChange={(e) => handleItemChange(index, 'expiry_date', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="purchase-total text-right h5 py-3 px-4 bg-light rounded d-flex justify-content-end align-items-center gap-3">
              <span className="purchase-total-label font-weight-bold">Total Amount:</span>
              <span className="purchase-total-value primary-text">{formatCurrency(totalAmount)}</span>
            </div>
          </form>
        </div>
        <div className="modal-footer flex-end gap-2">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => setCreateModalOpen(false)}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="purchase-form" 
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="spinner mr-2" />
                Saving...
              </>
            ) : (
              'Create Purchase'
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Purchases;
