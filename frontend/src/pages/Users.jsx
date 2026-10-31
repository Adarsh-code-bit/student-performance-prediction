import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Plus, Edit2, Trash2, User, X, Shield, MapPin, Building2,
  CheckCircle, XCircle, Phone, Clock, AlertTriangle, ShieldCheck,
  CheckCircle2, AlertCircle, Briefcase, Mail
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

const VALID_SUBROLES = [
  { id: 'PICKER', label: 'PICKER (Order Picking Terminal)' },
  { id: 'PACKER', label: 'PACKER (Packing & Dispatch Station)' },
  { id: 'AUDITOR', label: 'AUDITOR (Stock Cycle Audit)' },
  { id: 'INVENTORY_CLERK', label: 'INVENTORY_CLERK (Inbound Receiving)' }
];

const Users = () => {
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'pending'
  const [users, setUsers] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Add / Edit User Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    user_name: '',
    email: '',
    phone: '',
    role: 'STAFF',
    staff_subrole: 'PICKER',
    employment_type: 'FULL_TIME',
    department: 'Warehouse Operations',
    store_id: 1,
    is_active: true,
    password: ''
  });

  // Approval Modal State
  const [approvingUser, setApprovingUser] = useState(null);
  const [approvalStoreId, setApprovalStoreId] = useState(1);
  const [approvalSubrole, setApprovalSubrole] = useState('PICKER');

  // Rejection Modal State
  const [rejectingUser, setRejectingUser] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('Position filled or does not meet dark store requirements.');

  const { addToast } = useToast();

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      if (res.data?.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch users');
      addToast(err.response?.data?.message || 'Failed to load users', 'error');
    }
  };

  const fetchPendingRegistrations = async () => {
    try {
      const res = await api.get('/users/pending-registrations');
      if (res.data?.success) {
        setPendingRegistrations(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load pending registrations:', err.message);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchPendingRegistrations()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Open Edit or Add Modal
  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        user_name: user.user_name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        staff_subrole: user.staff_subrole || 'PICKER',
        employment_type: user.employment_type || 'FULL_TIME',
        department: user.department || 'Warehouse Operations',
        store_id: user.store_id || 1,
        is_active: user.is_active === 1 || user.is_active === true,
        password: ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        user_name: '',
        email: '',
        phone: '',
        role: 'STAFF',
        staff_subrole: 'PICKER',
        employment_type: 'FULL_TIME',
        department: 'Warehouse Operations',
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
      loadAll();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save user', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this operator account?')) {
      try {
        await api.delete(`/users/${id}`);
        addToast('User deactivated', 'success');
        loadAll();
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to deactivate user', 'error');
      }
    }
  };

  // Open Approval Dialog
  const handleOpenApproveModal = (applicant) => {
    setApprovingUser(applicant);
    setApprovalStoreId(1);
    setApprovalSubrole(applicant.staff_subrole || 'PICKER');
  };

  // Execute Approval
  const handleConfirmApproval = async () => {
    if (!approvingUser) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/users/${approvingUser.user_id}/approve`, {
        store_id: approvalStoreId,
        staff_subrole: approvalSubrole
      });
      if (res.data?.success) {
        addToast(res.data.message || 'Operator approved and activated!', 'success');
        setApprovingUser(null);
        loadAll();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to approve operator', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Rejection Dialog
  const handleOpenRejectModal = (applicant) => {
    setRejectingUser(applicant);
    setRejectionReason('Does not meet current warehouse hiring criteria.');
  };

  // Execute Rejection
  const handleConfirmRejection = async () => {
    if (!rejectingUser) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/users/${rejectingUser.user_id}/reject`, {
        reason: rejectionReason
      });
      if (res.data?.success) {
        addToast(res.data.message || 'Registration rejected', 'info');
        setRejectingUser(null);
        loadAll();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to reject registration', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield className="text-primary-600" size={28} />
            User Management & Role Hierarchy
          </h1>
          <p className="text-gray-500 mt-1">
            Configure employee accounts, role permissions, dark store hub assignments, and review pending signups.
          </p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        borderBottom: '1px solid #E5E9E4',
        paddingBottom: '2px'
      }}>
        <button
          onClick={() => setActiveTab('active')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'active' ? 700 : 500,
            borderBottom: activeTab === 'active' ? '2.5px solid #168A45' : '2.5px solid transparent',
            color: activeTab === 'active' ? '#168A45' : '#68736B',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>Active Staff & Managers</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 6px',
            borderRadius: '10px',
            backgroundColor: activeTab === 'active' ? '#E8F5ED' : '#F7F8F5',
            color: activeTab === 'active' ? '#168A45' : '#68736B',
            fontWeight: 700
          }}>
            {users.length}
          </span>
        </button>

        <button
          id="tab-pending-registrations"
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'pending' ? 700 : 500,
            borderBottom: activeTab === 'pending' ? '2.5px solid #168A45' : '2.5px solid transparent',
            color: activeTab === 'pending' ? '#168A45' : '#68736B',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>Pending Registrations</span>
          <span style={{
            fontSize: '11px',
            padding: '2px 7px',
            borderRadius: '10px',
            backgroundColor: pendingRegistrations.length > 0 ? '#F8CB46' : '#F7F8F5',
            color: pendingRegistrations.length > 0 ? '#12372A' : '#68736B',
            fontWeight: 800
          }}>
            {pendingRegistrations.length}
          </span>
        </button>
      </div>

      {/* Content Area */}
      <div className="content-card">
        {loading ? (
          <div className="empty-state">Loading accounts & registration queue...</div>
        ) : activeTab === 'pending' ? (
          /* PENDING REGISTRATIONS TABLE */
          <div>
            {pendingRegistrations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#68736B' }}>
                <CheckCircle2 size={42} color="#168A45" style={{ margin: '0 auto 10px' }} />
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#17211B' }}>
                  No Pending Registrations
                </h3>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  All public operator signup requests have been reviewed and resolved.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Applicant / Reference</th>
                      <th>Mobile Number</th>
                      <th>Employment</th>
                      <th>Requested Dept</th>
                      <th>Submitted</th>
                      <th>Approval Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRegistrations.map((applicant) => (
                      <tr key={applicant.user_id}>
                        {/* Name & Reference */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: '#FEF3C7',
                              color: '#B45309',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '13px'
                            }}>
                              {applicant.user_name?.charAt(0) || 'O'}
                            </div>
                            <div>
                              <strong style={{ fontSize: '13px', color: '#17211B' }}>{applicant.user_name}</strong>
                              <div style={{ fontSize: '11px', color: '#68736B', fontFamily: 'monospace' }}>
                                {applicant.employee_id || `ID #${applicant.user_id}`}
                              </div>
                              {applicant.email && !applicant.email.endsWith('@quickstock.internal') && (
                                <div style={{ fontSize: '11px', color: '#68736B' }}>{applicant.email}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Mobile Number & Verification Badge */}
                        <td>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#17211B' }}>
                            {applicant.phone || '—'}
                          </div>
                          <div style={{ marginTop: '2px' }}>
                            {applicant.is_mobile_verified ? (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#168A45',
                                backgroundColor: '#E8F5ED',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                <CheckCircle size={10} /> Verified
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#B45309',
                                backgroundColor: '#FEF3C7',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                Unverified
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Employment Type */}
                        <td>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: applicant.employment_type === 'FULL_TIME' ? '#EBF5FF' : '#F3E8FF',
                            color: applicant.employment_type === 'FULL_TIME' ? '#1D4ED8' : '#6B21A8'
                          }}>
                            {applicant.employment_type === 'FULL_TIME' ? 'Full-Time' : 'Part-Time'}
                          </span>
                        </td>

                        {/* Department */}
                        <td>
                          <div style={{ fontSize: '12px', color: '#17211B', fontWeight: 600 }}>
                            {applicant.department || 'Warehouse Operations'}
                          </div>
                        </td>

                        {/* Submitted Date */}
                        <td>
                          <div style={{ fontSize: '12px', color: '#17211B', fontWeight: 500 }}>
                            {new Date(applicant.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div style={{ fontSize: '11px', color: '#68736B' }}>
                            {new Date(applicant.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            backgroundColor: '#FEF3C7',
                            color: '#B45309',
                            border: '1px solid #FDE68A',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Clock size={11} /> Pending Review
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              id={`approve-btn-${applicant.user_id}`}
                              onClick={() => handleOpenApproveModal(applicant)}
                              className="btn btn-primary btn-sm"
                              style={{
                                height: '30px',
                                padding: '0 12px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <CheckCircle size={13} /> Approve
                            </button>
                            <button
                              id={`reject-btn-${applicant.user_id}`}
                              onClick={() => handleOpenRejectModal(applicant)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                height: '30px',
                                padding: '0 10px',
                                fontSize: '11.5px',
                                color: '#DC3545',
                                borderColor: '#FCA5A5',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <XCircle size={13} /> Reject
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
        ) : (
          /* ACTIVE USERS TABLE */
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee / Ref</th>
                  <th>Main Role</th>
                  <th>Staff Subrole</th>
                  <th>Employment</th>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: '13px', color: '#17211B' }}>{u.user_name}</strong>
                            {u.employee_id && (
                              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#68736B', backgroundColor: '#F0F2EE', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                {u.employee_id}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                          {u.phone && <div style={{ fontSize: '11px', color: '#68736B' }}>{u.phone}</div>}
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
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: u.employment_type === 'PART_TIME' ? '#F3E8FF' : '#F7F8F5',
                        color: u.employment_type === 'PART_TIME' ? '#6B21A8' : '#17211B'
                      }}>
                        {u.employment_type === 'PART_TIME' ? 'Part-Time' : 'Full-Time'}
                      </span>
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

      {/* APPROVAL MODAL */}
      {approvingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border animate-fade-in">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 color="#168A45" size={20} />
                Approve Operator Account
              </h2>
              <button onClick={() => setApprovingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#F7F8F5', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E5E9E4', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#17211B' }}>{approvingUser.user_name}</div>
              <div style={{ fontSize: '12px', color: '#68736B', marginTop: '2px' }}>
                Ref: <strong style={{ fontFamily: 'monospace' }}>{approvingUser.employee_id}</strong> • {approvingUser.phone}
              </div>
              <div style={{ fontSize: '11px', color: '#168A45', fontWeight: 700, marginTop: '4px' }}>
                Department: {approvingUser.department} • {approvingUser.employment_type === 'FULL_TIME' ? 'Full-Time' : 'Part-Time'}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', color: '#17211B' }}>
                  Assign Dark Store Hub *
                </label>
                <select
                  id="approve-store-select"
                  className="form-select w-full"
                  value={approvalStoreId}
                  onChange={e => setApprovalStoreId(Number(e.target.value))}
                >
                  <option value={1}>Koramangala Dark Store (DS-BLR-01)</option>
                  <option value={2}>Indiranagar Dark Store (DS-BLR-02)</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', color: '#17211B' }}>
                  Assign Operational Staff Subrole *
                </label>
                <select
                  id="approve-subrole-select"
                  className="form-select w-full"
                  value={approvalSubrole}
                  onChange={e => setApprovalSubrole(e.target.value)}
                >
                  {VALID_SUBROLES.map(role => (
                    <option key={role.id} value={role.id}>{role.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid #E5E9E4' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setApprovingUser(null)}
                >
                  Cancel
                </button>
                <button
                  id="confirm-approval-submit"
                  type="button"
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ fontWeight: 800 }}
                  onClick={handleConfirmApproval}
                >
                  {actionLoading ? 'Activating...' : 'Confirm & Activate Terminal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border animate-fade-in">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
                <XCircle size={20} />
                Reject Registration
              </h2>
              <button onClick={() => setRejectingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '13px', color: '#17211B' }}>
              Are you sure you want to reject the application for <strong>{rejectingUser.user_name}</strong> ({rejectingUser.employee_id})?
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', color: '#17211B' }}>
                Rejection Reason (Recorded in audit logs)
              </label>
              <textarea
                rows="3"
                className="form-input w-full"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Reason for declining application..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid #E5E9E4' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectingUser(null)}
              >
                Cancel
              </button>
              <button
                id="confirm-rejection-submit"
                type="button"
                disabled={actionLoading}
                className="btn btn-primary"
                style={{ backgroundColor: '#DC3545', borderColor: '#DC3545', color: '#FFFFFF', fontWeight: 800 }}
                onClick={handleConfirmRejection}
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border animate-fade-in max-h-[90vh] overflow-y-auto">
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
                <label className="form-label">Mobile Number</label>
                <input
                  type="tel"
                  className="form-input w-full"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Main Role *</label>
                  <select
                    className="form-select w-full"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="STORE_MANAGER">STORE_MANAGER</option>
                    <option value="STAFF">STAFF</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Employment Type</label>
                  <select
                    className="form-select w-full"
                    value={formData.employment_type}
                    onChange={e => setFormData({ ...formData, employment_type: e.target.value })}
                  >
                    <option value="FULL_TIME">Full-Time</option>
                    <option value="PART_TIME">Part-Time</option>
                  </select>
                </div>
              </div>

              {formData.role === 'STAFF' && (
                <div>
                  <label className="form-label">Staff Subrole *</label>
                  <select
                    className="form-select w-full"
                    value={formData.staff_subrole}
                    onChange={e => setFormData({ ...formData, staff_subrole: e.target.value })}
                  >
                    <option value="PICKER">PICKER (Order Picking)</option>
                    <option value="PACKER">PACKER (Order Packing)</option>
                    <option value="AUDITOR">AUDITOR (Stock Cycle Audit)</option>
                    <option value="INVENTORY_CLERK">INVENTORY_CLERK (Inbound Receiving)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="form-label">Assigned Dark Store Hub *</label>
                <select
                  className="form-select w-full"
                  value={formData.store_id}
                  onChange={e => setFormData({ ...formData, store_id: Number(e.target.value) })}
                >
                  <option value={1}>Koramangala Dark Store (DS-BLR-01)</option>
                  <option value={2}>Indiranagar Dark Store (DS-BLR-02)</option>
                </select>
              </div>

              <div>
                <label className="form-label">{editingUser ? 'Password (Leave blank to keep existing)' : 'Password *'}</label>
                <input
                  type="password"
                  required={!editingUser}
                  className="form-input w-full"
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
