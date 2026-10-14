import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, Truck } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [search, setSearch] = useState('');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState({ 
    supplier_name: '', 
    contact_person: '', 
    email: '', 
    phone: '', 
    city: '', 
    address: '' 
  });
  const [saving, setSaving] = useState(false);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const { addToast } = useToast();

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/suppliers');
      if (response.data.success) {
        setSuppliers(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch suppliers');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching suppliers');
      addToast(err.message || 'Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(search.toLowerCase()))
    );
  }, [suppliers, search]);

  const handleOpenModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setForm({
        supplier_name: supplier.supplier_name,
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        city: supplier.city || '',
        address: supplier.address || ''
      });
    } else {
      setEditingSupplier(null);
      setForm({ 
        supplier_name: '', 
        contact_person: '', 
        email: '', 
        phone: '', 
        city: '', 
        address: '' 
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSupplier(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.supplier_name.trim()) {
      addToast('Supplier name is required', 'error');
      return;
    }

    try {
      setSaving(true);
      let response;
      if (editingSupplier) {
        response = await api.put(`/suppliers/${editingSupplier.supplier_id}`, form);
      } else {
        response = await api.post('/suppliers', form);
      }

      if (response.data.success) {
        addToast(`Supplier ${editingSupplier ? 'updated' : 'added'} successfully`, 'success');
        handleCloseModal();
        fetchSuppliers();
      } else {
        throw new Error(response.data.message || 'Failed to save supplier');
      }
    } catch (err) {
      addToast(err.message || 'Failed to save supplier', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);
      const response = await api.delete(`/suppliers/${deleteTarget.supplier_id}`);
      
      if (response.data.success) {
        addToast('Supplier deleted successfully', 'success');
        setDeleteTarget(null);
        fetchSuppliers();
      } else {
        throw new Error(response.data.message || 'Failed to delete supplier');
      }
    } catch (err) {
      addToast(err.message || 'Failed to delete supplier', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Suppliers</h1>
        <p>Manage product suppliers</p>
      </div>
      
      <div className="page-actions">
        <div className="page-actions-left">
          <div className="filter-search">
            <Search size={16} />
            <input 
              placeholder="Search suppliers..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="page-actions-right">
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={16} /> Add Supplier
          </button>
        </div>
      </div>
      
      <div className="content-card">
        {loading ? (
          <div className="loading-state">Loading suppliers...</div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="empty-state">No suppliers found.</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>City</th>
                  <th>Purchases</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map(supplier => (
                  <tr key={supplier.supplier_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Truck size={16} style={{ color: '#9ca3af' }} />
                        {supplier.supplier_name}
                      </div>
                    </td>
                    <td>{supplier.contact_person || '-'}</td>
                    <td>{supplier.phone || '-'}</td>
                    <td>{supplier.email || '-'}</td>
                    <td>{supplier.city || '-'}</td>
                    <td>{supplier.purchase_count || 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn-icon" 
                          onClick={() => handleOpenModal(supplier)}
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          className="btn-icon" 
                          onClick={() => setDeleteTarget(supplier)}
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
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
        size="lg"
      >
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Supplier Name</label>
              <input 
                type="text" 
                name="supplier_name"
                className="form-input" 
                value={form.supplier_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input 
                type="text" 
                name="contact_person"
                className="form-input" 
                value={form.contact_person}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="email" 
                name="email"
                className="form-input" 
                value={form.email}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input 
                type="text" 
                name="phone"
                className="form-input" 
                value={form.phone}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input 
                type="text" 
                name="city"
                className="form-input" 
                value={form.city}
                onChange={handleChange}
              />
            </div>
            <div className="form-group form-grid-full">
              <label className="form-label">Address</label>
              <textarea 
                name="address"
                className="form-textarea" 
                value={form.address}
                onChange={handleChange}
                rows="2"
              />
            </div>
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
        title="Delete Supplier"
        message={`Are you sure you want to delete the supplier "${deleteTarget?.supplier_name}"?`}
        loading={deleteLoading}
      />
    </div>
  );
};

export default Suppliers;
