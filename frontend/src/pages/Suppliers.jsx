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
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#17211B' }}>
              Suppliers & Vendor Governance
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#e8f5e9', color: '#168A45', border: '1px solid #bbf7d0' }}>
              {suppliers.length} Certified Vendors
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#68736B' }}>
            Manage inbound procurement partners, contact points, and dark-store supply agreements.
          </p>
        </div>
        
        <div>
          <button 
            className="btn btn-primary" 
            onClick={() => handleOpenModal()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> Add Supplier
          </button>
        </div>
      </div>
      
      {/* Search Bar */}
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
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#68736B' }} />
          <input 
            type="text"
            placeholder="Search suppliers by name or contact..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '36px', height: '36px', fontSize: '13px' }}
          />
        </div>

        <div style={{ fontSize: '12px', color: '#68736B' }}>
          Showing <strong>{filteredSuppliers.length}</strong> supplier partners
        </div>
      </div>
      
      <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state" style={{ padding: '60px 0', textAlign: 'center' }}>
            <div className="loading-spinner"></div>
            <p style={{ marginTop: '12px', color: '#68736B', fontSize: '13px' }}>Loading vendor partners...</p>
          </div>
        ) : error ? (
          <div className="error-state" style={{ padding: '40px 20px', textAlign: 'center', color: '#DC3545' }}>{error}</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Truck size={40} style={{ color: '#68736B', margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#17211B' }}>No suppliers found</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#68736B' }}>Add a new vendor partner to start issuing purchase orders.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor Partner</th>
                  <th>Contact Person</th>
                  <th>Phone & Email</th>
                  <th>Location City</th>
                  <th>Fulfilled Orders</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map(supplier => (
                  <tr key={supplier.supplier_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#168A45', border: '1px solid #c8e6c9' }}>
                          <Truck size={16} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '13px', color: '#17211B' }}>{supplier.supplier_name}</strong>
                          {supplier.address && (
                            <div style={{ fontSize: '11px', color: '#68736B', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {supplier.address}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', color: '#17211B', fontWeight: 600 }}>
                        {supplier.contact_person || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <div>
                        {supplier.phone && (
                          <div style={{ fontSize: '12px', color: '#17211B', fontFamily: 'monospace' }}>
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div style={{ fontSize: '11px', color: '#68736B' }}>
                            {supplier.email}
                          </div>
                        )}
                        {!supplier.phone && !supplier.email && <span style={{ color: '#9ca3af', fontSize: '11px' }}>No contact</span>}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#17211B' }}>
                        {supplier.city || 'Standard Hub'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#12372A', fontSize: '12px' }}>
                        {supplier.purchase_count || 0} POs
                      </span>
                    </td>
                    <td>
                      <span className="status-badge status-success">Active Partner</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn-icon" 
                          onClick={() => handleOpenModal(supplier)}
                          title="Edit Supplier Details"
                          style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button 
                          className="btn-icon danger" 
                          onClick={() => setDeleteTarget(supplier)}
                          title="Delete Supplier"
                          style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={14} />
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
