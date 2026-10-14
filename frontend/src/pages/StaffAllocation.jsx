import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, AlertTriangle, ArrowRightLeft, Clock, 
  CheckCircle2, RefreshCw, XCircle, ShieldAlert, Award
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const StaffAllocation = () => {
  const [staffList, setStaffList] = useState([]);
  const [backlog, setBacklog] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('allocation'); // 'allocation' or 'history'

  // Modal State for Assigning
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [reason, setReason] = useState('High order volume surge');
  const [assigning, setAssigning] = useState(false);

  // End Assignment State
  const [endTarget, setEndTarget] = useState(null);
  const [ending, setEnding] = useState(false);

  const { addToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffRes, backlogRes, histRes] = await Promise.all([
        api.get('/staff-allocation/staff'),
        api.get('/staff-allocation/backlog'),
        api.get('/staff-allocation/history')
      ]);

      if (staffRes.data.success) setStaffList(staffRes.data.data);
      if (backlogRes.data.success) setBacklog(backlogRes.data.data);
      if (histRes.data.success) setHistory(histRes.data.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load staff allocation data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAssignModal = (staff) => {
    setSelectedStaff(staff);
    setReason('High order volume surge');
    setAssignModalOpen(true);
  };

  const handleConfirmAssign = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setAssigning(true);
    try {
      const res = await api.post('/staff-allocation/assign', {
        user_id: selectedStaff.user_id,
        assigned_role: 'PICKER',
        reason
      });

      if (res.data.success) {
        addToast(res.data.message || 'Staff temporarily reassigned to Picker', 'success');
        setAssignModalOpen(false);
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to reassign staff', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleEndAssignment = async () => {
    if (!endTarget) return;

    setEnding(true);
    try {
      const res = await api.post(`/staff-allocation/end/${endTarget.allocation_id}`);
      if (res.data.success) {
        addToast(res.data.message || 'Temporary assignment ended', 'success');
        setEndTarget(null);
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to end assignment', 'error');
    } finally {
      setEnding(false);
    }
  };

  const totalStaff = staffList.length;
  const activePickers = staffList.filter(s => s.current_assignment === 'PICKER').length;
  const temporarilyReassigned = staffList.filter(s => s.is_temporarily_reassigned).length;

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="text-primary-600" size={28} />
            Dynamic Staff Allocation
          </h1>
          <p className="text-gray-500 mt-1">
            Supervise staff operational duties and reallocate available workforce to Picker roles during order volume surges.
          </p>
        </div>
        <button 
          onClick={fetchData} 
          className="btn btn-secondary flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Backlog Recommendation Alert */}
      {backlog && (
        <div className={`p-4 rounded-xl border flex items-start gap-4 mb-6 ${
          backlog.is_backlog_high 
            ? 'bg-amber-50 border-amber-200 text-amber-900' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          {backlog.is_backlog_high ? (
            <AlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={22} />
          ) : (
            <CheckCircle2 className="text-emerald-600 mt-0.5 flex-shrink-0" size={22} />
          )}
          <div className="flex-1">
            <div className="font-semibold text-sm">
              {backlog.is_backlog_high ? 'High Order Volume Surge' : 'Order Backlog Under Control'}
            </div>
            <p className="text-sm mt-0.5 opacity-90">{backlog.recommendation}</p>
          </div>
          <div className="text-right flex-shrink-0 text-xs">
            <div><strong>{backlog.unpicked_orders}</strong> Unpicked Orders</div>
            <div className="opacity-80"><strong>{backlog.active_pickers}</strong> Active Pickers</div>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="content-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{totalStaff}</div>
            <div className="text-xs text-gray-500 font-medium">Total Store Staff</div>
          </div>
        </div>

        <div className="content-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{activePickers}</div>
            <div className="text-xs text-gray-500 font-medium">Effective Pickers</div>
          </div>
        </div>

        <div className="content-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ArrowRightLeft size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{temporarilyReassigned}</div>
            <div className="text-xs text-gray-500 font-medium">Temporarily Reallocated</div>
          </div>
        </div>

        <div className="content-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{backlog?.unpicked_orders ?? 0}</div>
            <div className="text-xs text-gray-500 font-medium">Queue Backlog Orders</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        <button 
          className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'allocation' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('allocation')}
        >
          Staff Availability & Allocation
        </button>
        <button 
          className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'history' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('history')}
        >
          Reassignment History ({history.length})
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'allocation' ? (
        <div className="content-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Permanent Subrole</th>
                  <th>Current Duty</th>
                  <th>Store</th>
                  <th>Status & Duration</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map(staff => (
                  <tr key={staff.user_id}>
                    <td>
                      <div>
                        <strong>{staff.user_name}</strong>
                        <div className="text-xs text-gray-500">{staff.email}</div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-secondary font-mono text-xs">
                        {staff.permanent_subrole}
                      </span>
                    </td>
                    <td>
                      {staff.is_temporarily_reassigned ? (
                        <div className="flex items-center gap-1.5">
                          <span className="badge badge-warning flex items-center gap-1 font-bold">
                            <ArrowRightLeft size={12} /> PICKER (Temporary)
                          </span>
                        </div>
                      ) : staff.permanent_subrole === 'PICKER' ? (
                        <span className="badge badge-success">PICKER (Permanent)</span>
                      ) : (
                        <span className="badge badge-info">{staff.permanent_subrole}</span>
                      )}
                    </td>
                    <td>{staff.store_name || 'Dark Store #1'}</td>
                    <td>
                      {staff.is_temporarily_reassigned ? (
                        <div>
                          <span className="status-badge status-warning">Temporarily Assigned</span>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(staff.assignment_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ) : (
                        <span className="status-badge status-success">Regular Duties</span>
                      )}
                    </td>
                    <td className="text-right">
                      {staff.is_temporarily_reassigned ? (
                        <button 
                          onClick={() => setEndTarget(staff)}
                          className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50"
                        >
                          <XCircle size={14} className="mr-1 inline" />
                          End Assignment
                        </button>
                      ) : staff.is_eligible_for_picking ? (
                        <button 
                          onClick={() => openAssignModal(staff)}
                          className="btn btn-primary btn-sm flex items-center gap-1 justify-end ml-auto"
                        >
                          <ArrowRightLeft size={14} />
                          Assign as Picker
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Active Picker</span>
                      )}
                    </td>
                  </tr>
                ))}
                {staffList.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-500">
                      No staff accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="content-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Permanent Role</th>
                  <th>Temporary Duty</th>
                  <th>Assigned By</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.allocation_id}>
                    <td><strong>{item.user_name}</strong></td>
                    <td><span className="badge badge-secondary text-xs">{item.original_subrole}</span></td>
                    <td><span className="badge badge-warning text-xs font-bold">{item.assigned_role}</span></td>
                    <td>{item.assigned_by_name || 'Manager'}</td>
                    <td>{new Date(item.start_time).toLocaleString()}</td>
                    <td>{item.end_time ? new Date(item.end_time).toLocaleString() : 'Active'}</td>
                    <td className="text-xs text-gray-600">{item.reason || 'Surge Reallocation'}</td>
                    <td>
                      <span className={`status-badge ${item.status === 'ACTIVE' ? 'status-warning' : 'status-success'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-gray-500">
                      No reallocation history recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation & Reassignment Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Confirm Temporary Staff Reassignment"
        size="md"
      >
        {selectedStaff && (
          <form onSubmit={handleConfirmAssign} className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
              <div className="font-semibold flex items-center gap-1.5">
                <Award size={16} /> Employee Details
              </div>
              <div className="mt-1">
                <strong>{selectedStaff.user_name}</strong> ({selectedStaff.email})
              </div>
              <div className="mt-0.5 text-xs">
                Permanent Role: <span className="font-mono font-bold">{selectedStaff.permanent_subrole}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
              <ShieldAlert size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Operational Safety Rule:</strong>
                <p className="mt-0.5">
                  Ensure the employee's regular duties (such as physical auditing or receiving) are completed or safely paused before transferring to Picker tasks.
                </p>
                <p className="mt-1 opacity-80">
                  * Their permanent subrole ({selectedStaff.permanent_subrole}) will be preserved in the system.
                </p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Temporary Operational Role</label>
              <input 
                type="text" 
                className="form-input bg-gray-100 font-bold" 
                value="PICKER (Order Picking)" 
                disabled 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reason for Reassignment *</label>
              <select 
                className="form-select"
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
              >
                <option value="High order volume surge">High order volume surge</option>
                <option value="Picking backlog exceeding threshold">Picking backlog exceeding threshold</option>
                <option value="Picker shift shortage">Picker shift shortage</option>
                <option value="Flash sale / Festival rush">Flash sale / Festival rush</option>
              </select>
            </div>

            <div className="modal-actions mt-6 flex justify-end gap-2">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setAssignModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={assigning}
              >
                {assigning ? 'Assigning...' : 'Confirm Temporary Assignment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* End Assignment Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!endTarget}
        onClose={() => setEndTarget(null)}
        onConfirm={handleEndAssignment}
        title="End Temporary Assignment?"
        message={`End temporary Picker duties for ${endTarget?.user_name}? They will immediately return to their permanent role as ${endTarget?.permanent_subrole}.`}
        loading={ending}
        confirmLabel="Return to Regular Role"
      />
    </div>
  );
};

export default StaffAllocation;
