import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [search, setSearch] = useState('');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState({ category_name: '', description: '' });
  const [saving, setSaving] = useState(false);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const { addToast } = useToast();

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/categories');
      if (response.data.success) {
        setCategories(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch categories');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching categories');
      addToast(err.message || 'Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => 
      c.category_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [categories, search]);

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setForm({
        category_name: category.category_name,
        description: category.description || ''
      });
    } else {
      setEditingCategory(null);
      setForm({ category_name: '', description: '' });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.category_name.trim()) {
      addToast('Category name is required', 'error');
      return;
    }

    try {
      setSaving(true);
      let response;
      if (editingCategory) {
        response = await api.put(`/categories/${editingCategory.category_id}`, form);
      } else {
        response = await api.post('/categories', form);
      }

      if (response.data.success) {
        addToast(`Category ${editingCategory ? 'updated' : 'added'} successfully`, 'success');
        handleCloseModal();
        fetchCategories();
      } else {
        throw new Error(response.data.message || 'Failed to save category');
      }
    } catch (err) {
      addToast(err.message || 'Failed to save category', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);
      const response = await api.delete(`/categories/${deleteTarget.category_id}`);
      
      if (response.data.success) {
        addToast('Category deleted successfully', 'success');
        setDeleteTarget(null);
        fetchCategories();
      } else {
        throw new Error(response.data.message || 'Failed to delete category');
      }
    } catch (err) {
      addToast(err.message || 'Failed to delete category', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Categories</h1>
        <p>Manage product categories</p>
      </div>
      
      <div className="page-actions">
        <div className="page-actions-left">
          <div className="filter-search">
            <Search size={16} />
            <input 
              placeholder="Search categories..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="page-actions-right">
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={16} /> Add Category
          </button>
        </div>
      </div>
      
      <div className="content-card">
        {loading ? (
          <div className="loading-state">Loading categories...</div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : filteredCategories.length === 0 ? (
          <div className="empty-state">No categories found.</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map(category => (
                  <tr key={category.category_id}>
                    <td>{category.category_name}</td>
                    <td>{category.description || '-'}</td>
                    <td>{category.product_count || 0}</td>
                    <td>
                      {category.is_active ? (
                        <span className="status-badge status-success">Active</span>
                      ) : (
                        <span className="status-badge status-danger">Inactive</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn-icon" 
                          onClick={() => handleOpenModal(category)}
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          className="btn-icon" 
                          onClick={() => setDeleteTarget(category)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
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
        onClose={handleCloseModal} 
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        size="md"
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Category Name</label>
            <input 
              type="text" 
              name="category_name"
              className="form-input" 
              value={form.category_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">Description</label>
            <textarea 
              name="description"
              className="form-textarea" 
              value={form.description}
              onChange={handleChange}
              rows="3"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        message={`Are you sure you want to delete the category "${deleteTarget?.category_name}"?`}
        loading={deleteLoading}
      />
    </div>
  );
};

export default Categories;
