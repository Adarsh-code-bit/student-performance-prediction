import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Plus, Eye, X, Loader2, AlertCircle, MapPin, 
  CheckCircle2, AlertTriangle, Layers, Building2, Package, Barcode
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import BarcodeScannerInput from '../components/shared/BarcodeScannerInput';

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
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState(null);
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filter & Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  
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

  const createEmptyItem = (index, dateStr, defaultLocationId = '') => ({
    product_id: '',
    quantity: '',
    unit_price: '',
    batch_code: generateBatchCode(dateStr, index),
    manufacturing_date: dateStr || getTodayDate(),
    expiry_date: '',
    location_id: defaultLocationId ? String(defaultLocationId) : '',
    selected_warehouse: '',
    selected_rack: ''
  });

  const [form, setForm] = useState(initialFormState);
  const [items, setItems] = useState([createEmptyItem(0, getTodayDate())]);
  const [saving, setSaving] = useState(false);
  const routeLocation = useLocation();

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    setLocationsLoading(true);
    setError(null);
    setLocationsError(null);

    try {
      const [purchasesRes, suppliersRes, productsRes, locationsRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/suppliers'),
        api.get('/products'),
        api.get('/locations')
      ]);
      
      if (purchasesRes.data.success) setPurchases(purchasesRes.data.data || []);
      if (suppliersRes.data.success) setSuppliers(suppliersRes.data.data || []);
      if (productsRes.data.success) setProducts(productsRes.data.data || []);
      
      if (locationsRes.data.success) {
        const activeLocs = (locationsRes.data.data || []).filter(l => Boolean(l.is_active));
        setLocations(activeLocs);
      } else {
        setLocationsError('Failed to load storage locations.');
      }
      
    } catch (err) {
      console.error('Failed to fetch data', err);
      setError('Failed to load purchases data. Please try again.');
      setLocationsError('Error communicating with locations API.');
    } finally {
      setLoading(false);
      setLocationsLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      const res = await api.get('/purchases');
      if (res.data.success) setPurchases(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch purchases', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      if (res.data.success) setProducts(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  const handleProductDetectedInPurchase = (product, meta) => {
    if (meta?.source === 'external_confirmed') {
      fetchProducts();
    }

    const pId = String(product.product_id ?? product.id);
    const pPrice = product.unit_price ? String(product.unit_price) : '';

    setItems(prevItems => {
      // Find first empty item without a product_id
      const emptyIdx = prevItems.findIndex(it => !it.product_id);
      if (emptyIdx !== -1) {
        const updated = [...prevItems];
        updated[emptyIdx] = {
          ...updated[emptyIdx],
          product_id: pId,
          unit_price: pPrice || updated[emptyIdx].unit_price,
          quantity: updated[emptyIdx].quantity || '1'
        };
        return updated;
      } else {
        // Append a new item row
        const newItem = createEmptyItem(prevItems.length, form.purchase_date, form.location_id);
        newItem.product_id = pId;
        newItem.unit_price = pPrice;
        newItem.quantity = '1';
        return [...prevItems, newItem];
      }
    });

    addToast(`Identified "${product.product_name}". Form populated automatically.`, 'success');
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle route state navigation (e.g. from Restock or Products shortcut)
  useEffect(() => {
    if (routeLocation.state?.autoOpenCreate) {
      setCreateModalOpen(true);
      if (routeLocation.state?.prefillProductId) {
        const pid = String(routeLocation.state.prefillProductId);
        const price = routeLocation.state.prefillUnitPrice ?? '';
        const todayStr = getTodayDate();
        const prefillLocId = routeLocation.state?.prefillLocationId ? String(routeLocation.state.prefillLocationId) : '';
        setItems([
          {
            product_id: pid,
            quantity: routeLocation.state.prefillQuantity || 50,
            unit_price: price,
            batch_code: generateBatchCode(todayStr, 0),
            manufacturing_date: todayStr,
            expiry_date: '',
            location_id: prefillLocId,
            selected_warehouse: '',
            selected_rack: ''
          }
        ]);
        if (prefillLocId) {
          setForm(prev => ({ ...prev, location_id: prefillLocId }));
        }
      }
    }
  }, [routeLocation.state]);

  // Derived location groupings
  const uniqueWarehouses = useMemo(() => {
    const names = new Set();
    locations.forEach(loc => {
      const name = (loc.store_name || 'Main Warehouse').trim();
      if (name) names.add(name);
    });
    return Array.from(names);
  }, [locations]);

  // Location map lookup helper
  const locationById = useMemo(() => {
    const map = new Map();
    locations.forEach(loc => {
      map.set(String(loc.location_id), loc);
    });
    return map;
  }, [locations]);

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
    setForm(prev => ({ ...prev, [name]: value }));

    // Update batch codes if purchase_date changes
    if (name === 'purchase_date') {
      const updatedItems = items.map((item, index) => ({
        ...item,
        batch_code: generateBatchCode(value, index)
      }));
      setItems(updatedItems);
    }

    // If default order location changes and items don't have location yet, apply it
    if (name === 'location_id' && value) {
      setItems(prevItems => prevItems.map(item => ({
        ...item,
        location_id: item.location_id || value
      })));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const handleItemLocationSelect = (index, locationId) => {
    const updatedItems = [...items];
    const loc = locationById.get(String(locationId));
    updatedItems[index] = {
      ...updatedItems[index],
      location_id: String(locationId || ''),
      selected_warehouse: loc ? (loc.store_name || 'Main Warehouse') : '',
      selected_rack: loc ? (loc.rack_number || '') : ''
    };
    setItems(updatedItems);
  };

  const handleAddItem = () => {
    setItems([...items, createEmptyItem(items.length, form.purchase_date, form.location_id)]);
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
    if (items.length === 0) return 'At least one purchase item is required';
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) return `Item #${i + 1}: Product selection is required`;
      if (!item.quantity || Number(item.quantity) <= 0) return `Item #${i + 1}: Quantity must be greater than 0`;
      if (!item.unit_price || Number(item.unit_price) <= 0) return `Item #${i + 1}: Unit price must be greater than 0`;
      if (!item.batch_code) return `Item #${i + 1}: Batch code is required`;
      if (!item.manufacturing_date) return `Item #${i + 1}: Manufacturing date is required`;
      if (!item.expiry_date) return `Item #${i + 1}: Expiry date is required`;

      // Storage location validation per line item
      const effectiveLocId = item.location_id || form.location_id;
      if (!effectiveLocId) {
        return `Item #${i + 1}: Storage location assignment is required`;
      }

      const assignedLoc = locationById.get(String(effectiveLocId));
      if (!assignedLoc) {
        return `Item #${i + 1}: Selected storage location is invalid or inactive`;
      }

      // Capacity validation if tracked
      if (assignedLoc.max_capacity !== null && assignedLoc.max_capacity !== undefined) {
        const availableCap = assignedLoc.available_capacity ?? Math.max(0, Number(assignedLoc.max_capacity) - Number(assignedLoc.total_units_stored || 0));
        const requestedQty = Number(item.quantity);
        if (requestedQty > availableCap) {
          const locCode = assignedLoc.complete_location_code || assignedLoc.location_name;
          return `Item #${i + 1}: Storage position ${locCode} has insufficient capacity. Available: ${availableCap} units, Requested: ${requestedQty} units`;
        }
      }
    }
    
    return null; // Valid
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
      // Prepare payload with explicit per-item location_id
      const payload = {
        supplier_id: Number(form.supplier_id),
        purchase_date: form.purchase_date,
        location_id: form.location_id ? Number(form.location_id) : (items[0]?.location_id ? Number(items[0].location_id) : null),
        notes: form.notes || null,
        items: items.map(item => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          cost_price: Number(item.unit_price),
          batch_code: item.batch_code,
          manufacturing_date: item.manufacturing_date,
          expiry_date: item.expiry_date,
          location_id: Number(item.location_id || form.location_id)
        }))
      };
      
      const res = await api.post('/purchases', payload);
      
      if (res.data.success) {
        addToast('Purchase order created and stock received successfully!', 'success');
        setCreateModalOpen(false);
        resetForm();
        fetchPurchases();
      } else {
        addToast(res.data.message || 'Failed to create purchase order', 'danger');
      }
    } catch (err) {
      console.error('Submit error:', err);
      addToast(err.response?.data?.message || 'An error occurred while saving the purchase', 'danger');
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

  const filteredPurchases = purchases.filter(p => {
    const term = searchTerm.toLowerCase().trim();
    const purchaseIdStr = (p.purchase_id ?? p.id ?? '').toString();
    const matchesSearch = !searchTerm ||
      purchaseIdStr.includes(term) ||
      (p.supplier_name || '').toLowerCase().includes(term);

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && (p.status || '').toLowerCase() === statusFilter.toLowerCase();
  });

  const totalPages = Math.ceil(filteredPurchases.length / pageSize) || 1;
  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#17211B' }}>
              Purchases & Inbound Receiving
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#e8f5e9', color: '#168A45', border: '1px solid #bbf7d0' }}>
              {purchases.length} Purchase Orders
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#68736B' }}>
            Manage supplier replenishment, physical batch generation, and dark-store rack storage position assignment.
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setCreateModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            Create Purchase Order
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E9E4',
        borderRadius: '10px',
        padding: '12px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All Inbound' },
            { id: 'received', label: 'Received' },
            { id: 'pending', label: 'Pending' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
              style={{
                border: 'none',
                background: statusFilter === tab.id ? '#168A45' : '#F1F3F1',
                color: statusFilter === tab.id ? '#FFFFFF' : '#4A544D',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '240px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by PO# or supplier..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          />
        </div>
      </div>

      {/* Purchases Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Purchase Date</th>
                <th>Items Count</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPurchases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    No purchase orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedPurchases.map((purchase) => {
                  const poId = purchase.purchase_id ?? purchase.id;
                  return (
                    <tr key={poId}>
                      <td className="font-semibold text-primary-600">
                        #{poId}
                      </td>
                      <td>{purchase.supplier_name || 'N/A'}</td>
                      <td>{formatDate(purchase.purchase_date)}</td>
                      <td>{purchase.items_count || '-'} items</td>
                      <td className="font-semibold">{formatCurrency(purchase.total_amount)}</td>
                      <td>
                        <span className={`badge ${
                          purchase.status === 'received' ? 'success' :
                          purchase.status === 'pending' ? 'warning' :
                          purchase.status === 'cancelled' ? 'danger' : 'secondary'
                        }`}>
                          {purchase.status || 'received'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-icon btn-sm"
                          title="View Details & Storage Locations"
                          onClick={() => handleViewDetail(poId)}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="card-footer flex-between py-2 px-3">
            <span className="text-xs text-muted">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredPurchases.length)} of {filteredPurchases.length} purchases
            </span>
            <div className="flex gap-1">
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Purchase Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedPurchase ? `Purchase Order #${selectedPurchase.purchase_id ?? selectedPurchase.id}` : 'Purchase Details'}
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
                  <span className="detail-value font-bold">#{selectedPurchase.purchase_id ?? selectedPurchase.id}</span>
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
                  <span className="detail-value font-bold text-emerald-700">{formatCurrency(selectedPurchase.total_amount)}</span>
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

              <h4 className="mb-2 font-bold text-slate-800">Purchased Items & Assigned Storage Positions</h4>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Assigned Storage Location</th>
                      <th>Unit Price</th>
                      <th>Total Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchase.items && selectedPurchase.items.length > 0 ? (
                      selectedPurchase.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-medium">
                            <div>{item.product_name || `Product #${item.product_id}`}</div>
                            {item.sku && <span className="text-xs text-muted">SKU: {item.sku}</span>}
                          </td>
                          <td className="font-bold">{item.quantity} {item.unit || 'units'}</td>
                          <td>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FFF0B8] border border-[#F8CB46]/60 text-[#12372A] font-mono font-bold text-xs">
                              <MapPin size={12} className="text-[#12372A]" />
                              <span>{item.complete_location_code || item.location_name || 'Location Not Assigned'}</span>
                            </div>
                            {(item.rack_number || item.shelf) && (
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                Rack: {item.rack_number || '-'} | Row: {item.shelf || '-'} | Pos: {item.bin || '-'}
                              </div>
                            )}
                          </td>
                          <td>{formatCurrency(item.unit_price)}</td>
                          <td className="font-semibold">{formatCurrency(item.quantity * item.unit_price)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center py-3 text-muted">No line items recorded</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-4 danger-text">
              Failed to load purchase details.
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
        title="Add Purchase & Inbound Receiving"
        size="xl"
      >
        <div className="modal-body">
          <form id="purchase-form" onSubmit={handleSubmit}>
            {/* Purchase Header Details */}
            <div className="form-grid mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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
                  {suppliers.map(sup => {
                    const sId = sup.supplier_id ?? sup.id;
                    const sName = sup.supplier_name ?? sup.name;
                    return (
                      <option key={sId} value={sId}>{sName}</option>
                    );
                  })}
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
                <label className="form-label">Default Order Location (Optional)</label>
                <select 
                  className="form-select" 
                  name="location_id"
                  value={form.location_id}
                  onChange={handleFormChange}
                  disabled={locationsLoading}
                >
                  <option value="">
                    {locationsLoading ? 'Loading locations from database...' : 'Select default location for items'}
                  </option>
                  {locations.map(loc => (
                    <option key={loc.location_id} value={loc.location_id}>
                      {loc.complete_location_code || loc.location_name} ({loc.store_name || 'Main Warehouse'}) - {loc.is_occupied ? 'Occupied' : 'Available'}
                    </option>
                  ))}
                </select>
                {locationsError && (
                  <span className="text-xs text-red-500 mt-1">{locationsError}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input 
                  type="text"
                  className="form-input" 
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  placeholder="Optional delivery / vendor reference notes"
                />
              </div>
            </div>

            {/* Line Items Section Header */}
            <div className="purchase-items-header flex-between mb-3 border-b pb-2">
              <div>
                <h4 className="font-bold text-slate-800 m-0">Purchase Products & Storage Positions</h4>
                <p className="text-xs text-muted m-0">Each line item can be assigned to a specific warehouse rack and storage position.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
                <Plus size={14} className="mr-1" /> Add Another Product
              </button>
            </div>

            {/* Quick Barcode Scan Section for Purchase Products */}
            <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3.5 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-900">
                  <Barcode size={15} className="text-emerald-700" />
                  <span>Scan Barcode to Auto-Populate Product</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-medium">
                  Hardware Scanner & Camera Ready
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-2.5">
                Scan with a USB/Bluetooth scanner or device camera to identify and populate product details. Then confirm quantity, batch code, and storage position below.
              </p>
              <BarcodeScannerInput
                onProductDetected={handleProductDetectedInPurchase}
                autoFocus={false}
                autoClearOnSuccess={true}
                showMatchCard={false}
                placeholder="Scan product barcode (e.g. 8901234567890) or type here..."
              />
            </div>

            {/* Purchase Line Items List */}
            <div className="purchase-items-list mb-4 space-y-4">
              {items.map((item, index) => {
                const assignedLoc = locationById.get(String(item.location_id || form.location_id));
                const itemWarehouse = item.selected_warehouse || (assignedLoc ? assignedLoc.store_name : (uniqueWarehouses[0] || 'Main Warehouse'));
                
                // Racks for this item's chosen warehouse
                const warehouseLocations = locations.filter(l => (l.store_name || 'Main Warehouse') === itemWarehouse);
                const availableRacks = Array.from(new Set(warehouseLocations.map(l => l.rack_number).filter(Boolean)));
                const itemRack = item.selected_rack || (assignedLoc ? assignedLoc.rack_number : (availableRacks[0] || ''));
                
                // Positions for this rack
                const rackPositions = warehouseLocations.filter(l => l.rack_number === itemRack);

                return (
                  <div 
                    key={index} 
                    className="purchase-item-row p-3.5 mb-3 border border-slate-200 rounded-xl bg-slate-50/70 shadow-sm relative"
                  >
                    {/* Item Index & Delete Button */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="font-bold text-slate-800 text-sm">
                          Item Line #{index + 1}
                        </span>
                      </div>
                      {items.length > 1 && (
                        <button 
                          type="button"
                          className="btn-icon btn-sm danger text-red-600 hover:bg-red-50 p-1 rounded" 
                          onClick={() => handleRemoveItem(index)}
                          title="Remove item"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    
                    {/* Product & Pricing Grid */}
                    <div className="form-grid mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                      <div className="form-group">
                        <label className="form-label">Product *</label>
                        <select 
                          className="form-select font-medium" 
                          value={item.product_id}
                          onChange={(e) => {
                            const pId = e.target.value;
                            const prod = products.find(p => String(p.product_id ?? p.id) === String(pId));
                            const updatedItems = [...items];
                            updatedItems[index] = {
                              ...updatedItems[index],
                              product_id: pId,
                              unit_price: prod?.unit_price ? String(prod.unit_price) : updatedItems[index].unit_price
                            };
                            setItems(updatedItems);
                          }}
                          required
                        >
                          <option value="">Select Product</option>
                          {products.map(prod => {
                            const pId = prod.product_id ?? prod.id;
                            const pName = prod.product_name ?? prod.name;
                            return (
                              <option key={pId} value={pId}>
                                {pName} {prod.unit ? `(${prod.unit})` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Batch Code *</label>
                        <input 
                          type="text" 
                          className="form-input font-mono text-xs" 
                          value={item.batch_code}
                          onChange={(e) => handleItemChange(index, 'batch_code', e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Quantity *</label>
                        <input 
                          type="number" 
                          className="form-input font-semibold" 
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          min="1"
                          placeholder="e.g. 50"
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
                          placeholder="e.g. 20"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Mfg Date *</label>
                        <input 
                          type="date" 
                          className="form-input text-xs" 
                          value={item.manufacturing_date}
                          onChange={(e) => handleItemChange(index, 'manufacturing_date', e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Expiry Date *</label>
                        <input 
                          type="date" 
                          className="form-input text-xs" 
                          value={item.expiry_date}
                          onChange={(e) => handleItemChange(index, 'expiry_date', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* DEDICATED STORAGE LOCATION SELECTOR SECTION */}
                    <div className="storage-assignment-card p-3 rounded-xl bg-white border border-slate-200 shadow-sm mt-2">
                      <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                          <MapPin size={14} className="text-emerald-600" />
                          <span>Storage Location Assignment (Rack & Position)</span>
                        </div>
                        {assignedLoc && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            assignedLoc.is_occupied 
                              ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}>
                            {assignedLoc.is_occupied ? `Occupied (${assignedLoc.total_units_stored} units)` : 'Available (Empty)'}
                          </span>
                        )}
                      </div>

                      {/* Dropdowns Grid: Warehouse -> Rack -> Position */}
                      <div className="form-grid mb-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                        {/* 1. Warehouse Dropdown */}
                        <div className="form-group mb-1">
                          <label className="form-label text-xs">Warehouse</label>
                          <select 
                            className="form-select text-xs"
                            value={itemWarehouse}
                            onChange={(e) => {
                              const wh = e.target.value;
                              const racksInWh = Array.from(new Set(
                                locations.filter(l => (l.store_name || 'Main Warehouse') === wh).map(l => l.rack_number).filter(Boolean)
                              ));
                              const firstRack = racksInWh[0] || '';
                              const firstPos = locations.find(l => (l.store_name || 'Main Warehouse') === wh && l.rack_number === firstRack);
                              
                              const updated = [...items];
                              updated[index] = {
                                ...updated[index],
                                selected_warehouse: wh,
                                selected_rack: firstRack,
                                location_id: firstPos ? String(firstPos.location_id) : updated[index].location_id
                              };
                              setItems(updated);
                            }}
                          >
                            {uniqueWarehouses.map(wh => (
                              <option key={wh} value={wh}>{wh}</option>
                            ))}
                          </select>
                        </div>

                        {/* 2. Rack Dropdown */}
                        <div className="form-group mb-1">
                          <label className="form-label text-xs">Warehouse Rack *</label>
                          <select 
                            className="form-select text-xs font-mono font-bold"
                            value={itemRack}
                            onChange={(e) => {
                              const rk = e.target.value;
                              const firstPos = locations.find(l => 
                                (l.store_name || 'Main Warehouse') === itemWarehouse && l.rack_number === rk
                              );
                              const updated = [...items];
                              updated[index] = {
                                ...updated[index],
                                selected_rack: rk,
                                location_id: firstPos ? String(firstPos.location_id) : updated[index].location_id
                              };
                              setItems(updated);
                            }}
                          >
                            <option value="">Select Rack</option>
                            {availableRacks.map(rk => (
                              <option key={rk} value={rk}>Rack {rk}</option>
                            ))}
                          </select>
                        </div>

                        {/* 3. Storage Position Dropdown */}
                        <div className="form-group mb-1">
                          <label className="form-label text-xs">Storage Position (Row & Bin) *</label>
                          <select 
                            className="form-select text-xs font-medium"
                            value={item.location_id || ''}
                            onChange={(e) => handleItemLocationSelect(index, e.target.value)}
                            required
                          >
                            <option value="">Select Position</option>
                            {rackPositions.map(pos => {
                              const capInfo = pos.max_capacity !== null 
                                ? ` | Cap: ${pos.available_capacity ?? '-'}/${pos.max_capacity}` 
                                : '';
                              return (
                                <option key={pos.location_id} value={pos.location_id}>
                                  Row {pos.shelf || '-'}, Pos {pos.bin || '-'} [{pos.complete_location_code}] - {pos.is_occupied ? 'Occupied' : 'Empty'}{capInfo}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>

                      {/* Prominent Complete Location Code Banner */}
                      {assignedLoc ? (
                        <div className="mt-2 p-2.5 rounded-lg bg-[#FFF0B8]/80 border border-[#F8CB46] flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#F8CB46]/30 flex items-center justify-center flex-shrink-0 text-[#12372A]">
                              <Building2 size={20} />
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                Assigned Storage Position Code
                              </div>
                              <div className="font-mono text-xl font-extrabold text-[#12372A] tracking-tight">
                                {assignedLoc.complete_location_code}
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-xs text-slate-700 flex flex-col items-end">
                            <span className="font-semibold">
                              Rack: <strong>{assignedLoc.rack_number || '-'}</strong> | Row: <strong>{assignedLoc.shelf || '-'}</strong> | Position: <strong>{assignedLoc.bin || '-'}</strong>
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Warehouse: {assignedLoc.store_name} {assignedLoc.zone ? `(${assignedLoc.zone})` : ''}
                            </span>
                            {assignedLoc.max_capacity !== null && (
                              <span className="text-[11px] font-bold text-slate-600 mt-0.5">
                                Capacity: {assignedLoc.available_capacity ?? (assignedLoc.max_capacity - assignedLoc.total_units_stored)} of {assignedLoc.max_capacity} units available
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                          <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
                          <span>Please select a valid warehouse rack and storage position for this item.</span>
                        </div>
                      )}

                      {/* Capacity Exceeded Warning */}
                      {assignedLoc && assignedLoc.max_capacity !== null && item.quantity && Number(item.quantity) > (assignedLoc.available_capacity ?? Infinity) && (
                        <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 font-semibold">
                          <AlertCircle size={15} className="text-red-600 flex-shrink-0" />
                          <span>
                            Warning: Item quantity ({item.quantity}) exceeds available capacity ({assignedLoc.available_capacity}) for location {assignedLoc.complete_location_code}.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Amount Summary */}
            <div className="purchase-total text-right h5 py-3 px-4 bg-light rounded d-flex justify-content-end align-items-center gap-3 border">
              <span className="purchase-total-label font-bold text-slate-700">Total Purchase Amount:</span>
              <span className="purchase-total-value primary-text font-black text-xl text-emerald-700">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </form>
        </div>

        <div className="modal-footer flex-end gap-2 border-t pt-3">
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
            className="btn btn-primary font-bold px-4 py-2 flex items-center gap-2"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="spinner mr-1" />
                Saving & Receiving Stock...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Confirm & Receive Purchase
              </>
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Purchases;
