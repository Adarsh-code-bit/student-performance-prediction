import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Pencil, XCircle, Search, AlertCircle, Database, 
  Eye, Package, Camera, CheckCircle, PackagePlus, ArrowRight,
  Globe, RefreshCw, Trash2, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import CameraBarcodeScannerModal from '../components/shared/CameraBarcodeScannerModal';

const defaultFormState = {
  product_name: '',
  brand: '',
  sku: '',
  barcode: '',
  category_id: '',
  unit: 'pcs',
  unit_price: '',
  reorder_level: 10,
  description: '',
  image_url: '',
  is_active: true
};

const Products = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(defaultFormState);
  const [saving, setSaving] = useState(false);
  const [fetchingExternal, setFetchingExternal] = useState(false);
  const [previewImgError, setPreviewImgError] = useState(false);
  const [overwriteModal, setOverwriteModal] = useState(null);
  
  // Camera Barcode Scanner
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Stock Receiving Navigation Prompt
  const [createdProductPrompt, setCreatedProductPrompt] = useState(null);

  // Deactivate state
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  
  const { addToast } = useToast();

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      if (response.data?.success) {
        setCategories(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter) params.append('category_id', categoryFilter);
      if (statusFilter) params.append('active', statusFilter === 'active' ? 'true' : 'false');
      
      const url = `/products?${params.toString()}`;
      const response = await api.get(url);
      
      if (response.data?.success) {
        setProducts(response.data.data || []);
      } else {
        addToast(response.data?.message || 'Failed to fetch products', 'error');
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error fetching products', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, statusFilter, addToast]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setForm(defaultFormState);
    setPreviewImgError(false);
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setForm({
      product_name: product.product_name || '',
      brand: product.brand || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      category_id: product.category_id || '',
      unit: product.unit || 'pcs',
      unit_price: product.unit_price || '',
      reorder_level: product.reorder_level ?? 10,
      description: product.description || '',
      image_url: product.image_url || '',
      is_active: product.is_active
    });
    setPreviewImgError(false);
    setModalOpen(true);
  };

  const handleCameraScan = (scannedCode) => {
    setForm(prev => ({
      ...prev,
      barcode: scannedCode
    }));
    addToast(`Scanned barcode: ${scannedCode}`, 'success');
  };

  const handleFetchExternalDetails = async () => {
    const rawBarcode = form.barcode?.trim();
    if (!rawBarcode) {
      addToast('Please enter or scan a barcode first to fetch details', 'warning');
      return;
    }

    setFetchingExternal(true);
    try {
      const res = await api.get(`/products/external/barcode/${encodeURIComponent(rawBarcode)}`);
      if (res.data?.success && res.data?.data) {
        const ext = res.data.data;

        // Auto-match category if possible
        let matchedCategoryId = form.category_id;
        if (ext.category && categories.length > 0) {
          const matched = categories.find(c => 
            c.category_name.toLowerCase() === ext.category.toLowerCase() ||
            ext.category.toLowerCase().includes(c.category_name.toLowerCase()) ||
            c.category_name.toLowerCase().includes(ext.category.toLowerCase())
          );
          if (matched) {
            matchedCategoryId = matched.category_id;
          }
        }

        // Auto-generate a clean SKU if empty and creating a new product
        let generatedSku = form.sku;
        if (!generatedSku && ext.barcode) {
          const brandPrefix = (ext.brand || 'PRD').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
          generatedSku = `${brandPrefix || 'PRD'}-${ext.barcode.slice(-6)}`;
        }

        const applyData = (includeImage = true) => {
          setForm(prev => ({
            ...prev,
            product_name: ext.product_name || prev.product_name,
            brand: ext.brand && ext.brand !== 'Unknown Brand' ? ext.brand : prev.brand,
            barcode: ext.barcode || prev.barcode,
            category_id: matchedCategoryId || prev.category_id,
            unit: ext.unit || prev.unit,
            sku: generatedSku || prev.sku,
            image_url: includeImage ? (ext.image_url || prev.image_url) : prev.image_url
          }));
          setPreviewImgError(false);
        };

        // Check if product already has an existing image and fetched image differs
        if (form.image_url && ext.image_url && form.image_url !== ext.image_url) {
          setOverwriteModal({
            isOpen: true,
            fetchedData: ext,
            oldImage: form.image_url,
            newImage: ext.image_url,
            onKeep: () => {
              applyData(false);
              setOverwriteModal(null);
              addToast('Product details updated (retained existing image)', 'success');
            },
            onReplace: () => {
              applyData(true);
              setOverwriteModal(null);
              addToast('Product details and new image applied', 'success');
            }
          });
        } else {
          applyData(true);
          if (ext.has_image) {
            addToast('Product details & image retrieved from Open Food Facts', 'success');
          } else {
            addToast('Product details retrieved. No image on Open Food Facts (you can enter an image URL manually)', 'info');
          }
        }
      } else {
        addToast(res.data?.message || 'Product not found in Open Food Facts database', 'warning');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        addToast(err.response?.data?.message || `Barcode ${rawBarcode} not found in Open Food Facts`, 'warning');
      } else if (err.response?.status === 429) {
        addToast('Open Food Facts API rate limit reached. Please try again shortly.', 'warning');
      } else if (err.response?.status === 504) {
        addToast('Open Food Facts request timed out. Please try again or enter image URL manually.', 'warning');
      } else {
        addToast(err.response?.data?.message || 'Failed to fetch details from Open Food Facts', 'error');
      }
    } finally {
      setFetchingExternal(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        ...form,
        brand: form.brand?.trim() || null,
        barcode: form.barcode?.trim() || null,
        image_url: form.image_url?.trim() || null,
        unit_price: parseFloat(form.unit_price),
        reorder_level: parseInt(form.reorder_level, 10)
      };

      if (editingProduct) {
        const res = await api.put(`/products/${editingProduct.product_id}`, payload);
        if (res.data?.success) {
          addToast('Product updated successfully', 'success');
          setModalOpen(false);
          fetchProducts();
        } else {
          addToast(res.data?.message || 'Failed to update product', 'error');
        }
      } else {
        const res = await api.post('/products', payload);
        if (res.data?.success) {
          addToast('Product added to catalog successfully', 'success');
          setModalOpen(false);
          fetchProducts();

          const newId = res.data.data?.insertId || res.data.data?.product_id;
          setCreatedProductPrompt({
            product_id: newId,
            product_name: payload.product_name,
            sku: payload.sku,
            unit_price: payload.unit_price
          });
        } else {
          addToast(res.data?.message || 'Failed to add product', 'error');
        }
      }
    } catch (err) {
      if (err.response?.status === 409) {
        addToast(err.response?.data?.message || 'A product with this SKU or Barcode already exists (409 Conflict)', 'error');
      } else {
        addToast(err.response?.data?.message || 'Error saving product', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    
    setDeactivateLoading(true);
    try {
      const res = await api.delete(`/products/${deactivateTarget.product_id}`);
      if (res.data?.success) {
        addToast('Product deactivated successfully', 'success');
        setDeactivateTarget(null);
        fetchProducts();
      } else {
        addToast(res.data?.message || 'Failed to deactivate product', 'error');
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error deactivating product', 'error');
    } finally {
      setDeactivateLoading(false);
    }
  };

  // Pagination & Sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState('product_name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Filtered & Sorted products
  const filteredProducts = products.filter(product => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase().trim();
    const nameMatch = (product.product_name || '').toLowerCase().includes(term);
    const skuMatch = (product.sku || '').toLowerCase().includes(term);
    const barcodeMatch = (product.barcode || '').toLowerCase().includes(term);
    return nameMatch || skuMatch || barcodeMatch;
  }).sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#17211B' }}>
              Master Product Catalog
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#e8f5e9', color: '#168A45', border: '1px solid #bbf7d0' }}>
              {products.length} Active SKUs
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#68736B' }}>
            Manage dark store catalog items, SKUs, barcode mappings, and fulfillment units.
          </p>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={openAddModal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          Add Product
        </button>
      </div>

      {/* Catalog vs Stock Explanatory Banner */}
      <div style={{
        backgroundColor: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: '10px',
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
        color: '#92400e'
      }}>
        <AlertCircle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
        <div style={{ lineHeight: 1.5 }}>
          <strong>Quick Commerce Dark Store Rule:</strong> Creating a product registers its master catalog definition. Physical units with batch codes, expiry dates, and rack locations must be received via the <Link to="/purchases" style={{ color: '#168A45', fontWeight: 700, textDecoration: 'underline' }}>Stock Receiving / Purchases Hub</Link>.
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="page-actions" style={{
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
        <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search by Product, SKU, or Barcode */}
          <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#68736B' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search by product name, SKU, or barcode..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
            />
          </div>
          
          <select 
            className="filter-select form-select" 
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{ height: '38px', fontSize: '13px', minWidth: '160px' }}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>
            ))}
          </select>
          
          <select 
            className="filter-select form-select" 
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{ height: '38px', fontSize: '13px', minWidth: '140px' }}
          >
            <option value="">All Status</option>
            <option value="active">Active Status</option>
            <option value="inactive">Inactive Status</option>
          </select>
        </div>

        {/* Quick Barcode Scanner button */}
        <button
          type="button"
          onClick={() => setIsCameraOpen(true)}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '38px' }}
          title="Scan barcode with device camera"
        >
          <Camera size={16} color="#168A45" />
          <span>Barcode Scan</span>
        </button>
      </div>

      {/* Catalog Table Card */}
      <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state" style={{ padding: '60px 0', textAlign: 'center' }}>
            <div className="loading-spinner"></div>
            <p style={{ marginTop: '12px', color: '#68736B', fontSize: '13px' }}>Loading catalog products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <AlertCircle size={40} style={{ color: '#68736B', margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#17211B' }}>No products found</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#68736B' }}>Try adjusting your search query, barcode, or category filter.</p>
          </div>
        ) : (
          <div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('product_name')} style={{ cursor: 'pointer' }}>
                      Product {sortField === 'product_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => toggleSort('sku')} style={{ cursor: 'pointer' }}>
                      SKU / Barcode {sortField === 'sku' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Category</th>
                    <th onClick={() => toggleSort('unit_price')} style={{ cursor: 'pointer' }}>
                      Price (₹) {sortField === 'unit_price' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Safety Buffer</th>
                    <th>Catalog Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map(product => (
                    <tr key={product.product_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {product.image_url ? (
                            <img 
                              src={product.image_url} 
                              alt={product.product_name} 
                              style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E5E9E4', padding: '2px' }} 
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div style={{
                            display: product.image_url ? 'none' : 'flex',
                            width: '38px',
                            height: '38px',
                            backgroundColor: '#F7F8F5',
                            borderRadius: '6px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#68736B',
                            border: '1px solid #E5E9E4'
                          }}>
                            <Package size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#17211B', fontSize: '13px' }}>
                              {product.product_name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#68736B', marginTop: '2px' }}>
                              Unit: <span style={{ fontWeight: 600 }}>{product.unit}</span>
                              {product.brand && ` • ${product.brand}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px', color: '#17211B' }}>
                          {product.sku}
                        </div>
                        {product.barcode ? (
                          <div style={{ fontSize: '11px', color: '#68736B', fontFamily: 'monospace', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '9px', backgroundColor: '#F7F8F5', border: '1px solid #E5E9E4', borderRadius: '3px', padding: '1px 4px' }}>BC</span>
                            {product.barcode}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>No barcode assigned</div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          color: '#12372A',
                          backgroundColor: '#e8f5e9',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 600,
                          border: '1px solid #c8e6c9'
                        }}>
                          {product.category_name}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#168A45', fontSize: '13px' }}>
                          ₹{Number(product.unit_price).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#17211B', fontWeight: 600 }}>
                          {product.reorder_level} {product.unit}
                        </span>
                      </td>
                      <td>
                        {product.is_active ? (
                          <span className="status-badge status-success">Active Catalog</span>
                        ) : (
                          <span className="status-badge status-danger">Inactive</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {/* Quick stock receiving action */}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#168A45' }}
                            onClick={() => navigate('/purchases', {
                              state: {
                                autoOpenCreate: true,
                                prefillProductId: product.product_id,
                                prefillProductName: product.product_name,
                                prefillUnitPrice: product.unit_price
                              }
                            })}
                            title="Receive Physical Stock (Purchases)"
                          >
                            <PackagePlus size={14} /> Stock In
                          </button>
                          <Link
                            to={`/products/${product.product_id}`}
                            className="btn-icon" 
                            title="View Product Profile"
                            style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                          >
                            <Eye size={15} />
                          </Link>
                          <button 
                            className="btn-icon" 
                            onClick={() => openEditModal(product)}
                            title="Edit Catalog Details"
                            style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                          >
                            <Pencil size={15} />
                          </button>
                          {product.is_active && (
                            <button 
                              className="btn-icon danger" 
                              onClick={() => setDeactivateTarget(product)}
                              title="Deactivate SKU"
                              style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', color: '#DC3545' }}
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
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
                Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredProducts.length)}</strong> of <strong>{filteredProducts.length}</strong> items
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
                  <option value={10}>10</option>
                  <option value={25}>25</option>
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

      {/* Add / Edit Product Modal */}
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editingProduct ? "Edit Product" : "Add Product to Catalog"}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label font-medium">Product Name *</label>
              <input 
                type="text" 
                className="form-input" 
                name="product_name"
                value={form.product_name} 
                onChange={handleInputChange} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label font-medium flex items-center justify-between">
                <span>Brand</span>
                <span className="text-xs text-gray-500 font-normal">Optional</span>
              </label>
              <input 
                type="text" 
                className="form-input" 
                name="brand"
                placeholder="e.g. Amul, Britannia, Nestlé"
                value={form.brand} 
                onChange={handleInputChange} 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label font-medium">SKU *</label>
              <input 
                type="text" 
                className="form-input font-mono" 
                name="sku"
                value={form.sku} 
                onChange={handleInputChange} 
                required 
              />
            </div>

            {/* Barcode with Open Food Facts Integration & Camera Scanner */}
            <div className="form-group md:col-span-2">
              <label className="form-label font-medium flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Database size={14} className="text-emerald-600" />
                  <span>Barcode (EAN-13, UPC, Code 128)</span>
                </span>
                <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-normal">
                  Open Food Facts Connected
                </span>
              </label>
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input 
                  type="text" 
                  className="form-input font-mono flex-1 min-w-[180px]" 
                  name="barcode"
                  placeholder="Enter or scan barcode (e.g. 5449000000996)..."
                  value={form.barcode} 
                  onChange={handleInputChange} 
                />
                <button
                  type="button"
                  onClick={handleFetchExternalDetails}
                  disabled={fetchingExternal}
                  className="btn btn-primary flex items-center gap-1.5 whitespace-nowrap text-xs px-3"
                  title="Retrieve product details, name, brand, and image from Open Food Facts API"
                >
                  {fetchingExternal ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Globe size={14} />
                  )}
                  <span>{fetchingExternal ? 'Fetching...' : 'Fetch Product Details'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="btn btn-secondary flex items-center gap-1.5 whitespace-nowrap text-xs px-3"
                  title="Scan barcode with camera"
                >
                  <Camera size={15} />
                  <span>Scan</span>
                </button>
              </div>
            </div>

            {/* Product Image Section with Live Preview Container & Manual URL Fallback */}
            <div className="form-group form-grid-full border border-gray-200 rounded-lg p-3 bg-gray-50/70">
              <div className="flex items-center justify-between mb-2">
                <label className="form-label font-medium m-0 flex items-center gap-1.5 text-xs text-gray-700">
                  <Package size={14} className="text-emerald-600" />
                  <span>Product Image Preview & Storage</span>
                </label>
                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm(prev => ({ ...prev, image_url: '' }));
                      setPreviewImgError(false);
                    }}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-medium bg-transparent border-0 cursor-pointer p-0"
                  >
                    <Trash2 size={12} /> Clear Image
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3.5 items-center sm:items-start">
                {/* 100x100 Consistent Image Preview Container with object-fit: contain */}
                <div 
                  className="w-[100px] h-[100px] min-w-[100px] min-h-[100px] rounded-lg border border-gray-300 bg-white flex flex-col items-center justify-center p-1.5 overflow-hidden shadow-xs relative"
                  style={{ backgroundColor: '#FFFFFF' }}
                >
                  {form.image_url && !previewImgError ? (
                    <img 
                      src={form.image_url} 
                      alt="Product Preview" 
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onError={() => setPreviewImgError(true)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 gap-1 text-center p-1">
                      <Package size={28} className="text-gray-300" />
                      <span className="text-[10px] font-semibold text-gray-400 leading-tight">Image unavailable</span>
                    </div>
                  )}
                </div>

                {/* Input for Validated Image URL */}
                <div className="flex-1 w-full space-y-1.5">
                  <input 
                    type="url" 
                    className="form-input text-xs" 
                    name="image_url"
                    placeholder="https://images.openfoodfacts.org/... or public image URL"
                    value={form.image_url} 
                    onChange={(e) => {
                      handleInputChange(e);
                      setPreviewImgError(false);
                    }}
                  />
                  <p className="text-[11px] text-gray-500 m-0 leading-normal">
                    Automatically retrieved from Open Food Facts API when barcode is fetched, or enter a validated public HTTP/HTTPS image URL manually.
                  </p>
                  {form.image_url && (
                    <div className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                      <CheckCircle size={12} /> Image ready for catalog preview and mobile picking station
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label font-medium">Category *</label>
              <select 
                className="form-select" 
                name="category_id"
                value={form.category_id} 
                onChange={handleInputChange} 
                required
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label font-medium">Unit *</label>
              <select 
                className="form-select" 
                name="unit"
                value={form.unit} 
                onChange={handleInputChange} 
                required
              >
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="litre">litre</option>
                <option value="pack">pack</option>
                <option value="bottle">bottle</option>
                <option value="can">can</option>
                <option value="box">box</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label font-medium">Unit Price (₹) *</label>
              <input 
                type="number" 
                className="form-input" 
                name="unit_price"
                value={form.unit_price} 
                onChange={handleInputChange} 
                min="0"
                step="0.01"
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label font-medium">Reorder Level *</label>
              <input 
                type="number" 
                className="form-input" 
                name="reorder_level"
                value={form.reorder_level} 
                onChange={handleInputChange} 
                min="0"
                required 
              />
            </div>
            
            <div className="form-group form-grid-full">
              <label className="form-label font-medium">Description</label>
              <textarea 
                className="form-input" 
                name="description"
                value={form.description} 
                onChange={handleInputChange} 
                rows="3"
              ></textarea>
            </div>

            {editingProduct && (
              <div className="form-group form-grid-full">
                <label className="form-checkbox-group flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    name="is_active"
                    checked={form.is_active} 
                    onChange={handleInputChange} 
                  />
                  <span>Active Status</span>
                </label>
              </div>
            )}
          </div>

          <div className="text-xs text-gray-500 mt-4 mb-2 bg-gray-50 p-2.5 rounded border">
            💡 <strong>Note:</strong> Creating a product only sets up its catalog profile. Physical stock must be received through Stock Receiving / Purchases.
          </div>
          
          <div className="modal-actions flex justify-end gap-2 mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Overwrite Confirmation Modal */}
      {overwriteModal && (
        <Modal
          isOpen={Boolean(overwriteModal)}
          onClose={() => setOverwriteModal(null)}
          title="Product Image Overwrite Confirmation"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-lg text-sm flex items-start gap-2.5">
              <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <strong className="block font-semibold">Existing Product Image Detected</strong>
                <span className="text-xs text-amber-800">
                  This product already has a saved image. Open Food Facts returned a new image. Would you like to replace the existing image or keep it?
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-2.5 text-center bg-gray-50">
                <div className="text-xs font-semibold text-gray-600 mb-2">Current Image</div>
                <div className="w-24 h-24 mx-auto bg-white rounded border flex items-center justify-center p-1">
                  <img src={overwriteModal.oldImage} alt="Current" className="w-full h-full object-contain" />
                </div>
              </div>

              <div className="border rounded-lg p-2.5 text-center bg-emerald-50/50 border-emerald-200">
                <div className="text-xs font-semibold text-emerald-800 mb-2">New Open Food Facts Image</div>
                <div className="w-24 h-24 mx-auto bg-white rounded border flex items-center justify-center p-1">
                  <img src={overwriteModal.newImage} alt="New" className="w-full h-full object-contain" />
                </div>
              </div>
            </div>

            <div className="modal-actions flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={overwriteModal.onKeep}
              >
                Keep Existing Image
              </button>
              <button
                type="button"
                className="btn btn-primary text-xs"
                onClick={overwriteModal.onReplace}
              >
                Replace With New Image
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Post-Creation Stock Receiving Guidance Modal */}
      {createdProductPrompt && (
        <Modal
          isOpen={Boolean(createdProductPrompt)}
          onClose={() => setCreatedProductPrompt(null)}
          title="Product Created — Receive Initial Stock?"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-lg text-sm flex items-start gap-2.5">
              <CheckCircle size={20} className="text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="block font-semibold">{createdProductPrompt.product_name}</strong>
                <span className="text-xs text-emerald-700">SKU: {createdProductPrompt.sku} • Catalog profile created successfully.</span>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              In quick commerce operations, creating a product catalog entry does <strong>not</strong> automatically create stock. This product currently has <strong>0 physical units</strong> in the dark store.
            </p>

            <p className="text-sm text-gray-600 leading-relaxed">
              Would you like to navigate to <strong>Stock Receiving</strong> now to receive an initial batch with expiry date, batch code, and storage rack location?
            </p>

            <div className="modal-actions flex justify-end gap-2 pt-2 border-t mt-4">
              <button 
                type="button" 
                className="btn btn-secondary text-sm" 
                onClick={() => setCreatedProductPrompt(null)}
              >
                Later (Keep 0 Stock)
              </button>
              <button 
                type="button" 
                className="btn btn-primary text-sm flex items-center gap-1.5"
                onClick={() => {
                  const p = createdProductPrompt;
                  setCreatedProductPrompt(null);
                  navigate('/purchases', {
                    state: {
                      autoOpenCreate: true,
                      prefillProductId: p.product_id,
                      prefillProductName: p.product_name,
                      prefillUnitPrice: p.unit_price
                    }
                  });
                }}
              >
                <PackagePlus size={16} />
                <span>Receive Stock Now</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Camera Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={handleCameraScan}
        title="Scan Barcode for Product Form"
      />

      <ConfirmDialog 
        isOpen={!!deactivateTarget} 
        onClose={() => setDeactivateTarget(null)} 
        onConfirm={handleDeactivate} 
        title="Deactivate Product?" 
        message={`This will mark "${deactivateTarget?.product_name}" as inactive.`}
        loading={deactivateLoading}
        confirmLabel="Deactivate"
      />
    </div>
  );
};

export default Products;
