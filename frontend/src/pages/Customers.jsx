import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    customer_name: '', phone: '', email: '', address: '', city: ''
  });

  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, id: null });
  const { addToast } = useToast();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers');
      setCustomers(res.data.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load customers');
      addToast('Error loading customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenModal = (customer = null) => {
    if (customer) {
      setEditingId(customer.customer_id);
      setFormData({
        customer_name: customer.customer_name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        city: customer.city || ''
      });
    } else {
      setEditingId(null);
      setFormData({ customer_name: '', phone: '', email: '', address: '', city: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, formData);
        addToast('Customer updated successfully', 'success');
      } else {
        await api.post('/customers', formData);
        addToast('Customer added successfully', 'success');
      }
      setShowModal(false);
      fetchCustomers();
    } catch (err) {
      addToast(editingId ? 'Failed to update customer' : 'Failed to add customer', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/customers/${deleteDialog.id}`);
      addToast('Customer deleted successfully', 'success');
      fetchCustomers();
    } catch (err) {
      addToast('Failed to delete customer', 'error');
    } finally {
      setDeleteDialog({ isOpen: false, id: null });
    }
  };

  const filteredCustomers = customers.filter(c => 
    !search || 
    c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus className="icon-sm" /> Add Customer
        </button>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="search-bar" style={{ maxWidth: '300px' }}>
            <Search className="search-icon" />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search customers..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading customers...</div>
        ) : error ? (
          <div className="empty-state text-danger">{error}</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty-state">No customers found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Total Orders</th>
                  <th>Total Spent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(c => (
                  <tr key={c.customer_id}>
                    <td>{c.customer_name}</td>
                    <td>{c.phone}</td>
                    <td>{c.email}</td>
                    <td>{c.total_orders || 0}</td>
                    <td>₹{Number(c.total_spent || 0).toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(c)}>
                          <Edit2 className="icon-sm" />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteDialog({ isOpen: true, id: c.customer_id })}>
                          <Trash2 className="icon-sm" />
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
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title={editingId ? 'Edit Customer' : 'Add Customer'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.customer_name}
              onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input 
              type="email" 
              className="form-control" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.city}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
            />
          </div>
          <div className="modal-footer" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, id: null })}
      />
    </div>
  );
};

export default Customers;
