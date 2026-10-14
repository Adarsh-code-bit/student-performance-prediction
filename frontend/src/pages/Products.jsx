import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, XCircle, Search, AlertCircle, Database, Eye, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const defaultFormState = {
  product_name: '',
  sku: '',
  category_id: '',
  unit: 'pcs',
  unit_price: '',
  reorder_level: 10,
  description: '',
  is_active: true
};

const Products = () => {
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
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setForm({
      product_name: product.product_name,
      sku: product.sku,
      category_id: product.category_id,
      unit: product.unit,
      unit_price: product.unit_price,
      reorder_level: product.reorder_level,
      description: product.description || '',
      is_active: product.is_active
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        ...form,
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
          addToast('Product added successfully', 'success');
          setModalOpen(false);
          fetchProducts();
        } else {
          addToast(res.data?.message || 'Failed to add product', 'error');
        }
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving product', 'error');
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Products</h1>
      </div>

      <div className="page-actions">
        <div className="filters-row" style={{ display: 'flex', gap: '1rem', flex: 1 }}>
          <div className="filter-search" style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search products or SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '35px' }}
            />
          </div>
          
          <select 
            className="filter-select form-select" 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>
            ))}
          </select>
          
          <select 
            className="filter-select form-select" 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} />
          Add Product
        </button>
      </div>

      <div className="content-card">
        {loading ? (
          <div className="empty-state">
            <p>Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
            <h3>No products found</h3>
            <p>Try adjusting your filters or add a new product.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU / Barcode</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Price (₹)</th>
                  <th>Reorder Level</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.product_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.product_name} className="w-10 h-10 object-contain rounded bg-white border" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 flex items-center justify-center rounded text-gray-400 border"><Package size={16}/></div>
                        )}
                        <div>
                          <strong>{product.product_name}</strong>
                          <div className="text-xs text-gray-500 mt-1">{product.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{product.sku}</div>
                      {product.barcode && <div className="text-xs text-gray-500 mt-1">BC: {product.barcode}</div>}
                    </td>
                    <td>{product.category_name}</td>
                    <td>{product.brand || 'N/A'}</td>
                    <td>₹{Number(product.unit_price).toLocaleString('en-IN')}</td>
                    <td>{product.reorder_level}</td>
                    <td>
                      {product.is_active ? (
                        <span className="status-badge status-success">Active</span>
                      ) : (
                        <span className="status-badge status-danger">Inactive</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          to={`/products/${product.product_id}`}
                          className="btn-icon" 
                          title="View Details"
                        >
                          <Eye size={18} />
                        </Link>
                        <button 
                          className="btn-icon" 
                          onClick={() => openEditModal(product)}
                          title="Edit"
                        >
                          <Pencil size={18} />
                        </button>
                        {product.is_active && (
                          <button 
                            className="btn-icon danger" 
                            onClick={() => setDeactivateTarget(product)}
                            title="Deactivate"
                          >
                            <XCircle size={18} />
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

      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editingProduct ? "Edit Product" : "Add Product"}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Product Name *</label>
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
              <label className="form-label">SKU *</label>
              <input 
                type="text" 
                className="form-input" 
                name="sku"
                value={form.sku} 
                onChange={handleInputChange} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Category *</label>
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
              <label className="form-label">Unit *</label>
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
              <label className="form-label">Unit Price (₹) *</label>
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
              <label className="form-label">Reorder Level *</label>
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
              <label className="form-label">Description</label>
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
                <label className="form-checkbox-group">
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
          
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

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
