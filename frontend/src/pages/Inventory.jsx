import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import { 
  Search, AlertCircle, Package, Eye, MapPin, 
  Layers, AlertTriangle, CalendarClock, CheckCircle2,
  RefreshCw, ArrowUpDown, ChevronRight, X, Barcode, Camera
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import CameraBarcodeScannerModal from '../components/shared/CameraBarcodeScannerModal';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Active Tab: 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NEAR_EXPIRY'
  const [activeTab, setActiveTab] = useState('ALL');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState('quantity');
  const [sortOrder, setSortOrder] = useState('asc');
  // Barcode scanning state
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const { addToast } = useToast();

  const handleBarcodeScan = useCallback((barcode) => {
    const cleaned = (barcode || '').trim();
    if (!cleaned) return;
    setSearchTerm(cleaned);
    setCurrentPage(1);
    addToast(`Filtered inventory by barcode: ${cleaned}`, 'info');
  }, [addToast]);

  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: !isModalOpen && !cameraModalOpen,
    minBarcodeLength: 3
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/inventory');
      if (response.data?.success) {
        setInventory(response.data.data || []);
      } else {
        setError('Failed to fetch dark store inventory');
      }
    } catch (err) {
      setError(err.message || 'Error fetching inventory');
      addToast('Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const getStockStatus = (item) => {
    const qty = Number(item.quantity);
    if (qty <= 0) return 'OUT_OF_STOCK';
    if (qty <= Number(item.reorder_level)) return 'LOW_STOCK';
    return 'IN_STOCK';
  };

  // Precomputed Tab Counts
  const tabCounts = useMemo(() => {
    let lowStock = 0;
    let outOfStock = 0;
    let nearExpiry = 0;

    inventory.forEach(item => {
      const status = getStockStatus(item);
      if (status === 'LOW_STOCK') lowStock++;
      if (status === 'OUT_OF_STOCK') outOfStock++;
      if (item.status === 'NEAR EXPIRY' || item.status === 'EXPIRED') nearExpiry++;
    });

    return {
      all: inventory.length,
      lowStock,
      outOfStock,
      nearExpiry
    };
  }, [inventory]);

  const categoryOptions = useMemo(() => {
    return [...new Set(inventory.map(item => item.category_name).filter(Boolean))].sort();
  }, [inventory]);

  const locationOptions = useMemo(() => {
    return [...new Map(
      inventory
        .filter(item => item.location_id && item.location_name)
        .map(item => [String(item.location_id), item.location_name])
    ).entries()];
  }, [inventory]);

  // Filtered & Sorted items
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // Tab constraint
      if (activeTab === 'LOW_STOCK' && getStockStatus(item) !== 'LOW_STOCK') return false;
      if (activeTab === 'OUT_OF_STOCK' && getStockStatus(item) !== 'OUT_OF_STOCK') return false;
      if (activeTab === 'NEAR_EXPIRY' && item.status !== 'NEAR EXPIRY' && item.status !== 'EXPIRED') return false;

      // Search constraint
      const matchesSearch = !searchTerm ||
        item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.batch_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = !categoryFilter || item.category_name === categoryFilter;
      const matchesLocation = !locationFilter || String(item.location_id) === locationFilter;
      const matchesStock = !stockFilter || getStockStatus(item) === stockFilter;
      const matchesExpiry = !expiryFilter || item.status === expiryFilter;

      return matchesSearch && matchesCategory && matchesLocation && matchesStock && matchesExpiry;
    }).sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'quantity' || sortField === 'reorder_level') {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      } else {
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [inventory, activeTab, searchTerm, categoryFilter, locationFilter, stockFilter, expiryFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredInventory.length / pageSize) || 1;
  const paginatedInventory = filteredInventory.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setLocationFilter('');
    setStockFilter('');
    setExpiryFilter('');
    setActiveTab('ALL');
    setCurrentPage(1);
  };

  const formatExpiry = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const now = new Date();
    const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    return {
      formatted: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      diffDays
    };
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#17211B' }}>
              Dark Store Inventory
            </h1>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: '#12372A',
              color: '#F8CB46'
            }}>
              LIVE RACK VISIBILITY
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#68736B' }}>
            Batch-level tracking, rack locations, safety buffers, and shelf-life monitoring.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/stock-movements" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            Stock Movements
          </Link>
          <Link to="/purchases" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            + Receive Stock
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={fetchInventory} disabled={loading} title="Refresh Inventory">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Operational Visibility Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '2px solid #E5E9E4',
        marginBottom: '20px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        <button
          onClick={() => { setActiveTab('ALL'); setCurrentPage(1); }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '6px 6px 0 0',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'ALL' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'ALL' ? '#168A45' : '#68736B',
            borderBottom: activeTab === 'ALL' ? '3px solid #168A45' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={15} />
          <span>All Stock</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '9999px',
            backgroundColor: activeTab === 'ALL' ? '#e8f5e9' : '#f1f5f9',
            color: activeTab === 'ALL' ? '#168A45' : '#64748b'
          }}>
            {tabCounts.all}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('LOW_STOCK'); setCurrentPage(1); }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '6px 6px 0 0',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'LOW_STOCK' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'LOW_STOCK' ? '#E9A23B' : '#68736B',
            borderBottom: activeTab === 'LOW_STOCK' ? '3px solid #E9A23B' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={15} />
          <span>Low Stock Buffers</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '9999px',
            backgroundColor: '#fef3c7',
            color: '#b45309'
          }}>
            {tabCounts.lowStock}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('OUT_OF_STOCK'); setCurrentPage(1); }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '6px 6px 0 0',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'OUT_OF_STOCK' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'OUT_OF_STOCK' ? '#DC3545' : '#68736B',
            borderBottom: activeTab === 'OUT_OF_STOCK' ? '3px solid #DC3545' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={15} />
          <span>Out of Stock</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '9999px',
            backgroundColor: '#fee2e2',
            color: '#991b1b'
          }}>
            {tabCounts.outOfStock}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('NEAR_EXPIRY'); setCurrentPage(1); }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '6px 6px 0 0',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'NEAR_EXPIRY' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'NEAR_EXPIRY' ? '#12372A' : '#68736B',
            borderBottom: activeTab === 'NEAR_EXPIRY' ? '3px solid #F8CB46' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CalendarClock size={15} />
          <span>Near Expiry (FEFO)</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '9999px',
            backgroundColor: '#F8CB46',
            color: '#12372A'
          }}>
            {tabCounts.nearExpiry}
          </span>
        </button>
      </div>

      {/* Search and Advanced Filters */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E9E4',
        borderRadius: '10px',
        padding: '12px 16px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '10px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#68736B' }} />
          <input 
            type="text" 
            placeholder="Search by product, barcode, SKU, batch, or rack..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="form-input"
            data-barcode-scanner="true"
            style={{ paddingLeft: '36px', paddingRight: '40px', height: '38px', fontSize: '13px' }}
          />
          <button
            type="button"
            onClick={() => setCameraModalOpen(true)}
            style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              border: 'none',
              background: 'transparent',
              color: '#168A45',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Scan barcode with camera"
          >
            <Camera size={18} />
          </button>
        </div>

        {/* Category filter */}
        <select 
          className="form-select" 
          value={categoryFilter} 
          onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          style={{ height: '38px', fontSize: '13px', minWidth: '150px' }}
        >
          <option value="">All Categories</option>
          {categoryOptions.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {/* Location filter */}
        <select 
          className="form-select" 
          value={locationFilter} 
          onChange={(e) => { setLocationFilter(e.target.value); setCurrentPage(1); }}
          style={{ height: '38px', fontSize: '13px', minWidth: '150px' }}
        >
          <option value="">All Locations / Racks</option>
          {locationOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        {/* Stock status filter */}
        <select 
          className="form-select" 
          value={stockFilter} 
          onChange={(e) => { setStockFilter(e.target.value); setCurrentPage(1); }}
          style={{ height: '38px', fontSize: '13px', minWidth: '140px' }}
        >
          <option value="">Stock Status</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>

        {/* Expiry filter */}
        <select 
          className="form-select" 
          value={expiryFilter} 
          onChange={(e) => { setExpiryFilter(e.target.value); setCurrentPage(1); }}
          style={{ height: '38px', fontSize: '13px', minWidth: '130px' }}
        >
          <option value="">Expiry Status</option>
          <option value="HEALTHY">Healthy</option>
          <option value="NEAR EXPIRY">Near Expiry</option>
          <option value="EXPIRED">Expired</option>
        </select>

        {(searchTerm || categoryFilter || locationFilter || stockFilter || expiryFilter) && (
          <button 
            className="btn btn-secondary btn-sm"
            onClick={resetFilters}
            style={{ height: '38px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Main Inventory Card */}
      <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state" style={{ padding: '60px 0', textAlign: 'center' }}>
            <div className="loading-spinner"></div>
            <p style={{ marginTop: '12px', color: '#68736B', fontSize: '13px' }}>Loading dark store inventory...</p>
          </div>
        ) : error ? (
          <div className="error-message" style={{ padding: '40px 20px', textAlign: 'center', color: '#DC3545' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{error}</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Package size={40} style={{ color: '#68736B', margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#17211B' }}>No inventory records matched</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#68736B' }}>Try clearing active filters or switch tabs.</p>
          </div>
        ) : (
          <div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('product_name')} style={{ cursor: 'pointer' }}>
                      Product & SKU {sortField === 'product_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Category</th>
                    <th onClick={() => toggleSort('batch_code')} style={{ cursor: 'pointer' }}>
                      Batch Number {sortField === 'batch_code' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Rack Location</th>
                    <th onClick={() => toggleSort('quantity')} style={{ cursor: 'pointer' }}>
                      Stock Quantity {sortField === 'quantity' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Expiry Date</th>
                    <th>Stock Health</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInventory.map(item => {
                    const status = getStockStatus(item);
                    const expiry = formatExpiry(item.expiry_date);
                    const isOutOfStock = status === 'OUT_OF_STOCK';
                    const isLowStock = status === 'LOW_STOCK';
                    const isNearExpiry = item.status === 'NEAR EXPIRY';
                    const isExpired = item.status === 'EXPIRED';

                    return (
                      <tr key={item.inventory_id} onClick={() => handleView(item)} className="clickable-row">
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              minWidth: '38px',
                              borderRadius: '6px',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E5E9E4',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              padding: '2px'
                            }}>
                              {item.image_url ? (
                                <img 
                                  src={item.image_url} 
                                  alt={item.product_name} 
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div style={{
                                display: item.image_url ? 'none' : 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#68736B'
                              }}>
                                <Package size={18} />
                              </div>
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#17211B', fontSize: '13px' }}>
                                {item.product_name}
                              </div>
                              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#68736B', marginTop: '2px' }}>
                                SKU: {item.sku}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: '#12372A', backgroundColor: '#e8f5e9', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                            {item.category_name || '-'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px', color: '#17211B' }}>
                            {item.batch_code}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#12372A', backgroundColor: '#F7F8F5', padding: '3px 8px', borderRadius: '6px', border: '1px solid #E5E9E4' }}>
                            <MapPin size={12} color="#168A45" />
                            <span>{item.location_name}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{
                              fontWeight: 800,
                              fontSize: '13px',
                              color: isOutOfStock ? '#DC3545' : isLowStock ? '#E9A23B' : '#168A45'
                            }}>
                              {item.quantity} units
                            </span>
                            <span style={{ fontSize: '11px', color: '#68736B' }}>
                              (Min: {item.reorder_level})
                            </span>
                          </div>
                        </td>
                        <td>
                          {expiry.formatted ? (
                            <div>
                              <div style={{ fontSize: '12px', color: '#17211B' }}>{expiry.formatted}</div>
                              {expiry.diffDays !== undefined && (
                                <div style={{
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  color: expiry.diffDays <= 0 ? '#DC3545' : expiry.diffDays <= 30 ? '#E9A23B' : '#68736B'
                                }}>
                                  {expiry.diffDays <= 0 ? 'Expired' : `${expiry.diffDays} days left`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>N/A</span>
                          )}
                        </td>
                        <td>
                          {isOutOfStock ? (
                            <span className="status-badge status-out-of-stock">Out of Stock</span>
                          ) : isLowStock ? (
                            <span className="status-badge status-low-stock">Low Stock</span>
                          ) : isExpired ? (
                            <span className="status-badge status-danger">Expired</span>
                          ) : isNearExpiry ? (
                            <span className="status-badge badge-yellow">Near Expiry</span>
                          ) : (
                            <span className="status-badge status-success">Healthy</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              onClick={(e) => { e.stopPropagation(); handleView(item); }}
                              style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={13} /> View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderTop: '1px solid #E5E9E4',
              backgroundColor: '#FFFFFF',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ fontSize: '12px', color: '#68736B' }}>
                Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredInventory.length)}</strong> of <strong>{filteredInventory.length}</strong> batch records
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
                  style={{ height: '30px', padding: '2px 8px', fontSize: '12px', width: 'auto' }}
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
                    style={{ padding: '4px 10px', fontSize: '12px' }}
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
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Item Detail Inspection Modal */}
      {isModalOpen && selectedItem && (
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title="Warehouse Batch Specification"
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              backgroundColor: '#F7F8F5',
              border: '1px solid #E5E9E4',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                minWidth: '64px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E9E4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '4px'
              }}>
                {selectedItem.image_url ? (
                  <img 
                    src={selectedItem.image_url} 
                    alt={selectedItem.product_name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div style={{
                  display: selectedItem.image_url ? 'none' : 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#68736B',
                  gap: '2px'
                }}>
                  <Package size={24} />
                  <span style={{ fontSize: '9px', fontWeight: 600 }}>No Image</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#68736B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Product Line</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#17211B', marginTop: '2px' }}>{selectedItem.product_name}</div>
                <div style={{ fontSize: '12px', color: '#68736B', marginTop: '2px' }}>
                  SKU: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedItem.sku}</span> • Category: {selectedItem.category_name}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ border: '1px solid #E5E9E4', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#68736B' }}>Batch Number</span>
                <p style={{ margin: '4px 0 0', fontWeight: 700, fontFamily: 'monospace', fontSize: '14px', color: '#17211B' }}>{selectedItem.batch_code}</p>
              </div>

              <div style={{ border: '1px solid #E5E9E4', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#68736B' }}>Rack Location</span>
                <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '13px', color: '#12372A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={14} color="#168A45" /> {selectedItem.location_name}
                </p>
              </div>

              <div style={{ border: '1px solid #E5E9E4', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#68736B' }}>Available Units</span>
                <p style={{ margin: '4px 0 0', fontWeight: 800, fontSize: '16px', color: '#168A45' }}>{selectedItem.quantity} units</p>
              </div>

              <div style={{ border: '1px solid #E5E9E4', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#68736B' }}>Reorder Buffer</span>
                <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '14px', color: '#17211B' }}>{selectedItem.reorder_level} units</p>
              </div>

              <div style={{ border: '1px solid #E5E9E4', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#68736B' }}>Expiry Date</span>
                <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '13px', color: '#17211B' }}>
                  {selectedItem.expiry_date ? new Date(selectedItem.expiry_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>

              <div style={{ border: '1px solid #E5E9E4', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#68736B' }}>Historical Sales</span>
                <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '14px', color: '#17211B' }}>{selectedItem.sales || 0} units sold</p>
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E5E9E4', paddingTop: '12px', marginTop: '4px' }}>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Camera Barcode Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onScan={handleBarcodeScan}
        title="Scan Barcode to Filter Inventory"
      />
    </div>
  );
};

export default Inventory;
