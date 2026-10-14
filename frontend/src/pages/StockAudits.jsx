import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, Plus, CheckCircle, XCircle, AlertCircle, 
  Layers, MapPin, RefreshCw, FileText
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';

const StockAudits = () => {
  const [audits, setAudits] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Audit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    location_id: '',
    physical_quantity: '',
    discrepancy_type: 'NONE',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();
  const { addToast } = useToast();

  const isAuditor = (user?.role === 'STAFF' && (user?.active_assignment || user?.staff_subrole) === 'AUDITOR') || user?.role === 'ADMIN';
  const isManager = user?.role === 'STORE_MANAGER' || user?.role === 'ADMIN';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [auditRes, prodRes, locRes] = await Promise.all([
        api.get('/stock-audits'),
        api.get('/products'),
        api.get('/locations')
      ]);

      if (auditRes.data.success) setAudits(auditRes.data.data);
      if (prodRes.data.success) setProducts(prodRes.data.data);
      if (locRes.data.success) setLocations(locRes.data.data);
    } catch (err) {
      addToast('Failed to load stock audit records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAudit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/stock-audits', formData);
      if (res.data.success) {
        addToast(res.data.message || 'Audit count recorded and submitted for manager review', 'success');
        setIsModalOpen(false);
        setFormData({
          product_id: '',
          location_id: '',
          physical_quantity: '',
          discrepancy_type: 'NONE',
          notes: ''
        });
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to submit audit count', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (auditId, action) => {
    try {
      const res = await api.put(`/stock-audits/${auditId}/review`, {
        action,
        review_notes: action === 'APPROVE' ? 'Approved by manager' : 'Rejected after inspection'
      });
      if (res.data.success) {
        addToast(res.data.message, 'success');
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Review action failed', 'error');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ClipboardCheck className="text-primary-600" size={28} />
            Physical Stock Audits & Discrepancies
          </h1>
          <p className="text-gray-500 mt-1">
            Perform physical warehouse counts, log damaged/expired items, and submit for Store Manager adjustment review.
          </p>
        </div>

        <div className="flex gap-2">
          {isAuditor && (
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Record Stock Count
            </button>
          )}
          <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="content-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Product</th>
                <th>Location</th>
                <th>Auditor</th>
                <th>System Qty</th>
                <th>Physical Count</th>
                <th>Discrepancy</th>
                <th>Status</th>
                {isManager && <th className="text-right">Manager Review</th>}
              </tr>
            </thead>
            <tbody>
              {audits.map(item => (
                <tr key={item.audit_task_id}>
                  <td><strong>#{item.audit_task_id}</strong></td>
                  <td>
                    <div>
                      <strong>{item.product_name}</strong>
                      <div className="text-xs text-gray-500">{item.sku}</div>
                    </div>
                  </td>
                  <td>
                    <div className="text-xs flex items-center gap-1 text-gray-600">
                      <MapPin size={12} /> {item.location_name} {item.rack_number ? `(${item.rack_number})` : ''}
                    </div>
                  </td>
                  <td>{item.auditor_name}</td>
                  <td>{item.system_quantity}</td>
                  <td><strong>{item.physical_quantity}</strong></td>
                  <td>
                    <span className={`badge ${
                      item.discrepancy === 0 ? 'badge-success' :
                      item.discrepancy < 0 ? 'badge-danger' : 'badge-warning'
                    }`}>
                      {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy} ({item.discrepancy_type})
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${
                      item.status === 'APPROVED' ? 'status-success' :
                      item.status === 'REJECTED' ? 'status-danger' : 'status-warning'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  {isManager && (
                    <td className="text-right">
                      {item.status === 'PENDING_REVIEW' ? (
                        <div className="flex justify-end gap-1.5">
                          <button 
                            onClick={() => handleReview(item.audit_task_id, 'APPROVE')}
                            className="btn btn-primary btn-sm flex items-center gap-1"
                            title="Approve Adjustment"
                          >
                            <CheckCircle size={14} /> Approve
                          </button>
                          <button 
                            onClick={() => handleReview(item.audit_task_id, 'REJECT')}
                            className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50 flex items-center gap-1"
                            title="Reject Discrepancy"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {item.reviewer_name ? `Reviewed by ${item.reviewer_name}` : 'Completed'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {audits.length === 0 && (
                <tr>
                  <td colSpan={isManager ? 9 : 8} className="text-center py-8 text-gray-500">
                    No physical audits or discrepancies recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Physical Count Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Physical Stock Count"
        size="md"
      >
        <form onSubmit={handleCreateAudit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Product *</label>
            <select
              className="form-select"
              value={formData.product_id}
              onChange={e => setFormData({ ...formData, product_id: e.target.value })}
              required
            >
              <option value="">Select product to audit...</option>
              {products.map(p => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Location / Rack *</label>
            <select
              className="form-select"
              value={formData.location_id}
              onChange={e => setFormData({ ...formData, location_id: e.target.value })}
              required
            >
              <option value="">Select warehouse location...</option>
              {locations.map(l => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_name} {l.rack_number ? `(${l.rack_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Actual Physical Quantity Counted *</label>
            <input
              type="number"
              className="form-input"
              value={formData.physical_quantity}
              onChange={e => setFormData({ ...formData, physical_quantity: e.target.value })}
              min="0"
              required
              placeholder="e.g., 45"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Discrepancy Category</label>
            <select
              className="form-select"
              value={formData.discrepancy_type}
              onChange={e => setFormData({ ...formData, discrepancy_type: e.target.value })}
            >
              <option value="NONE">NONE (Matches System Count)</option>
              <option value="MISSING">MISSING (Physical count less than system)</option>
              <option value="DAMAGED">DAMAGED (Found damaged on rack)</option>
              <option value="EXPIRED">EXPIRED (Past shelf life)</option>
              <option value="EXCESS">EXCESS (Unrecorded surplus)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Auditor Observations / Notes</label>
            <textarea
              className="form-input"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder="e.g., Rack B shelf 2 physical count verified twice."
            />
          </div>

          <div className="modal-actions flex justify-end gap-2 pt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit for Manager Review'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StockAudits;
