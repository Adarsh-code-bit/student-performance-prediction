import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Edit2, Trash2, User, X, Shield, MapPin, Building2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    user_name: '',
    email: '',
    role: 'STAFF',
    staff_subrole: 'PICKER',
    store_id: 1,
    is_active: true,
    password: ''
  });

  const { addToast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      if (res.data?.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch users');
      addToast(err.response?.data?.message || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        user_name: user.user_name,
        email: user.email,
        role: user.role,
        staff_subrole: user.staff_subrole || 'PICKER',
        store_id: user.store_id || 1,
        is_active: user.is_active === 1 || user.is_active === true,
        password: ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        user_name: '',
        email: '',
        role: 'STAFF',
        staff_subrole: 'PICKER',
        store_id: 1,
        is_active: true,
        password: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editingUser.user_id}`, payload);
        addToast('User updated successfully', 'success');
      } else {
        await api.post('/users', formData);
        addToast('User created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save user', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this user?')) {
      try {
        await api.delete(`/users/${id}`);
        addToast('User deactivated', 'success');
        fetchUsers();
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to deactivate user', 'error');
      }
    }
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield className="text-primary-600" size={28} />
            User Management & Role Hierarchy
          </h1>
          <p className="text-gray-500 mt-1">Configure user accounts, main roles, dark store assignments, and staff subroles.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="content-card">
        {loading ? (
          <div className="empty-state">Loading users...</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Main Role</th>
                  <th>Staff Subrole</th>
                  <th>Assigned Store</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-sm">
                          {u.user_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <strong>{u.user_name}</strong>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        u.role === 'ADMIN' ? 'badge-danger' :
                        u.role === 'STORE_MANAGER' ? 'badge-warning' : 'badge-primary'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.staff_subrole ? (
                        <span className="badge badge-secondary font-mono text-xs">
                          {u.staff_subrole}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="text-xs flex items-center gap-1 text-gray-600">
                        <Building2 size={13} /> {u.store_name || (u.store_id ? `Store #${u.store_id}` : 'All Stores (HQ)')}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${u.is_active ? 'status-success' : 'status-danger'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleOpenModal(u)} className="btn-icon" title="Edit User">
                          <Edit2 size={16} />
                        </button>
                        {u.is_active && (
                          <button onClick={() => handleDelete(u.user_id)} className="btn-icon danger" title="Deactivate User">
                            <Trash2 size={16} />
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border animate-fade-in">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h2 className="text-lg font-bold">{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  required
                  className="form-input w-full"
                  value={formData.user_name}
                  onChange={e => setFormData({ ...formData, user_name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  required
                  className="form-input w-full"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Main Role *</label>
                <select
                  className="form-select w-full"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="ADMIN">ADMIN (System Administrator)</option>
                  <option value="STORE_MANAGER">STORE_MANAGER (Dark Store Supervisor)</option>
                  <option value="STAFF">STAFF (Operational Staff)</option>
                </select>
              </div>

              {formData.role === 'STAFF' && (
                <div>
                  <label className="form-label font-bold text-primary-700">Permanent Staff Subrole *</label>
                  <select
                    className="form-select w-full border-primary-300"
                    value={formData.staff_subrole}
                    onChange={e => setFormData({ ...formData, staff_subrole: e.target.value })}
                    required
                  >
                    <option value="AUDITOR">AUDITOR (Stock Counts & Discrepancies)</option>
                    <option value="PICKER">PICKER (Order Picking & Location Guide)</option>
                    <option value="PACKER">PACKER (Order Verification & Sealing)</option>
                    <option value="INVENTORY_CLERK">INVENTORY_CLERK (Stock Receipts & Movements)</option>
                  </select>
                </div>
              )}

              {formData.role !== 'ADMIN' && (
                <div>
                  <label className="form-label">Assigned Dark Store *</label>
                  <select
                    className="form-select w-full"
                    value={formData.store_id}
                    onChange={e => setFormData({ ...formData, store_id: parseInt(e.target.value, 10) })}
                    required
                  >
                    <option value="1">Koramangala Dark Store (DS-BLR-01)</option>
                    <option value="2">Indiranagar Dark Store (DS-BLR-02)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="form-label">
                  {editingUser ? 'Password (leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  className="form-input w-full"
                  placeholder={editingUser ? '••••••••' : 'Enter secure password'}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
