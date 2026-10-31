import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users, UserCheck, ClipboardCheck, ClipboardList, Package,
  AlertTriangle, ArrowRight, Zap, CheckCircle2, Warehouse,
  Layers, Clock, Shield, BarChart3, Truck, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

import StatCards from '../components/dashboard/StatCards';
import SalesChart from '../components/dashboard/SalesChart';
import InventoryStatusChart from '../components/dashboard/InventoryStatusChart';
import TopSellingChart from '../components/dashboard/TopSellingChart';
import LowStockTable from '../components/dashboard/LowStockTable';
import RecentOrdersTable from '../components/dashboard/RecentOrdersTable';

import ExpiryAlertsTable from '../components/dashboard/ExpiryAlertsTable';
import { PlusCircle, ShoppingBag } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [backlog, setBacklog] = useState(null);
  const [pickingQueue, setPickingQueue] = useState([]);
  const [packingQueue, setPackingQueue] = useState([]);
  const [audits, setAudits] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);

  const effectiveSubrole = (user?.role === 'STAFF' && user?.active_assignment)
    ? user.active_assignment
    : user?.staff_subrole;

  const canManageProducts = user?.role === 'ADMIN' || user?.role === 'STORE_MANAGER';
  const canManagePurchases = user?.role === 'ADMIN' || user?.role === 'STORE_MANAGER';

  useEffect(() => {
    fetchRoleData();
  }, [user]);

  const fetchRoleData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (user.role === 'STORE_MANAGER' || user.role === 'ADMIN') {
        const backlogRes = await api.get('/staff-allocation/backlog').catch(() => null);
        if (backlogRes?.data?.success) setBacklog(backlogRes.data.data);
      }

      if (effectiveSubrole === 'PICKER' || user.role === 'ADMIN' || user.role === 'STORE_MANAGER') {
        const pickRes = await api.get('/orders/picking-queue').catch(() => null);
        if (pickRes?.data?.success) setPickingQueue(pickRes.data.data);
      }

      if (effectiveSubrole === 'PACKER' || user.role === 'ADMIN' || user.role === 'STORE_MANAGER') {
        const packRes = await api.get('/orders/packing-queue').catch(() => null);
        if (packRes?.data?.success) setPackingQueue(packRes.data.data);
      }

      if (effectiveSubrole === 'AUDITOR' || user.role === 'ADMIN' || user.role === 'STORE_MANAGER') {
        const auditRes = await api.get('/stock-audits').catch(() => null);
        if (auditRes?.data?.success) setAudits(auditRes.data.data.slice(0, 5));
      }

      if (effectiveSubrole === 'INVENTORY_CLERK' || user.role === 'ADMIN' || user.role === 'STORE_MANAGER') {
        const moveRes = await api.get('/stock-movements?limit=5').catch(() => null);
        if (moveRes?.data?.success) setMovements(moveRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching role dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#17211B' }}>
              Dashboard
            </h1>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: '#12372A',
              color: '#F8CB46',
              letterSpacing: '0.04em'
            }}>
              {user?.role === 'ADMIN' && 'ADMIN COMMAND'}
              {user?.role === 'STORE_MANAGER' && `DARK STORE #${user?.store_id || 1}`}
              {user?.role === 'STAFF' && `${effectiveSubrole || 'STAFF'} TERMINAL`}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#68736B' }}>
            Your warehouse operations, at a glance.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {canManageProducts && (
            <Link to="/products" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <PlusCircle size={14} /> Add Product
            </Link>
          )}
          <Link to="/inventory" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} /> View Inventory
          </Link>
          {canManagePurchases && (
            <Link to="/purchases" className="btn btn-brand btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ShoppingBag size={14} /> Create Purchase
            </Link>
          )}
          <Link to="/orders" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ClipboardList size={14} /> View Orders
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={fetchRoleData} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} title="Refresh live data">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Temporary Reassignment Banner */}
      {user?.role === 'STAFF' && user?.active_assignment && (
        <div style={{
          backgroundColor: '#fff7ed',
          border: '1px solid #fdba74',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 6px rgba(234, 88, 12, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: '#f97316', color: '#fff', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#9a3412', fontWeight: 600 }}>
                High-Volume Surge Protocol: Temporarily Reassigned to {user.active_assignment}
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#c2410c' }}>
                Permanent Subrole: <strong>{user.staff_subrole}</strong>. Your account has operational picking permissions active to support order fulfillment.
              </p>
            </div>
          </div>
          <Link to="/orders" className="btn btn-primary btn-sm" style={{ backgroundColor: '#ea580c', borderColor: '#ea580c' }}>
            Open Picking Queue <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Store Manager: Operational Surge & Staff Backlog Alert */}
      {user?.role === 'STORE_MANAGER' && backlog && (
        <div style={{
          backgroundColor: backlog.backlog_status === 'SURGE_ALERT' ? '#fff1f2' : '#f0fdf4',
          border: `1px solid ${backlog.backlog_status === 'SURGE_ALERT' ? '#fecdd3' : '#bbf7d0'}`,
          borderRadius: '12px',
          padding: '18px 22px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: backlog.backlog_status === 'SURGE_ALERT' ? '#e11d48' : '#16a34a',
              color: '#fff',
              borderRadius: '8px',
              padding: '10px'
            }}>
              {backlog.backlog_status === 'SURGE_ALERT' ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: backlog.backlog_status === 'SURGE_ALERT' ? '#9f1239' : '#166534', fontWeight: 700 }}>
                  {backlog.backlog_status === 'SURGE_ALERT' ? 'Order Surge Detected — Allocation Required' : 'Fulfillment Operations Normal'}
                </h3>
                <span className={`status-badge ${backlog.backlog_status === 'SURGE_ALERT' ? 'status-danger' : 'status-success'}`}>
                  {backlog.backlog_status}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: backlog.backlog_status === 'SURGE_ALERT' ? '#be123c' : '#15803d' }}>
                {backlog.unpicked_orders} unpicked orders in queue • {backlog.active_pickers} active pickers • Ratio: {backlog.ratio} orders/picker
              </p>
            </div>
          </div>
          <Link to="/staff-allocation" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={16} /> Dynamic Staff Allocation <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {/* Admin Command Quick Actions */}
      {user?.role === 'ADMIN' && (
        <div className="content-card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={20} color="#4f46e5" />
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>Administration Shortcuts:</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link to="/users" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} /> User Governance
              </Link>
              <Link to="/staff-allocation" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={14} /> Staff Allocation
              </Link>
              <Link to="/stock-audits" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ClipboardCheck size={14} /> Physical Stock Audits
              </Link>
              <Link to="/import-products" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={14} /> Open Food Facts Import
              </Link>
              <Link to="/audit-logs" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} /> Security Audit Logs
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Role View: Picker Station */}
      {user?.role === 'STAFF' && effectiveSubrole === 'PICKER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
          <div className="content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  Live Picking Queue ({pickingQueue.length} Orders Ready to Pick)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Dark store 10-minute dispatch target. Claim and verify picked items accurately.
                </p>
              </div>
              <Link to="/orders" className="btn btn-primary btn-sm">
                Go to Order Fulfillment <ArrowRight size={14} />
              </Link>
            </div>

            {pickingQueue.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontWeight: 600 }}>All picking tasks are currently up to date!</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Total Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickingQueue.slice(0, 5).map(o => (
                      <tr key={o.order_id}>
                        <td><strong>{o.order_number}</strong></td>
                        <td>{o.customer_name}</td>
                        <td>₹{Number(o.total_amount).toLocaleString('en-IN')}</td>
                        <td>
                          <span className={`status-badge ${o.status === 'picking_in_progress' ? 'status-warning' : 'status-info'}`}>
                            {o.status}
                          </span>
                        </td>
                        <td>
                          <Link to="/orders" className="btn btn-primary btn-sm">
                            Process Pick
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role View: Packer Station */}
      {user?.role === 'STAFF' && effectiveSubrole === 'PACKER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
          <div className="content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  Live Packing Queue ({packingQueue.length} Orders Ready to Pack)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Verify items against picking checklist and pack into bags for rider dispatch.
                </p>
              </div>
              <Link to="/orders" className="btn btn-primary btn-sm">
                Go to Packing Tasks <ArrowRight size={14} />
              </Link>
            </div>

            {packingQueue.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontWeight: 600 }}>No orders currently waiting in the packing queue.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Total Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packingQueue.slice(0, 5).map(o => (
                      <tr key={o.order_id}>
                        <td><strong>{o.order_number}</strong></td>
                        <td>{o.customer_name}</td>
                        <td>₹{Number(o.total_amount).toLocaleString('en-IN')}</td>
                        <td>
                          <span className="status-badge status-warning">
                            {o.status}
                          </span>
                        </td>
                        <td>
                          <Link to="/orders" className="btn btn-primary btn-sm">
                            Process Pack
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role View: Auditor Dashboard */}
      {user?.role === 'STAFF' && effectiveSubrole === 'AUDITOR' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
          <div className="content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  Physical Inventory Audits & Discrepancy Tracking
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Conduct cycle counts, record physical counts, and report stock variances for Manager review.
                </p>
              </div>
              <Link to="/stock-audits" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ClipboardCheck size={14} /> Conduct Physical Count
              </Link>
            </div>

            {audits.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                <ClipboardCheck size={36} color="#6366f1" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontWeight: 600 }}>No audit records found. Click above to start a count.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>System Qty</th>
                      <th>Physical Qty</th>
                      <th>Discrepancy</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map(a => (
                      <tr key={a.audit_id}>
                        <td><strong>{a.product_name}</strong></td>
                        <td>{a.system_quantity}</td>
                        <td>{a.physical_quantity}</td>
                        <td>
                          <span style={{
                            color: a.discrepancy < 0 ? '#ef4444' : a.discrepancy > 0 ? '#10b981' : '#64748b',
                            fontWeight: 600
                          }}>
                            {a.discrepancy > 0 ? `+${a.discrepancy}` : a.discrepancy}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${a.status === 'APPROVED' ? 'status-success' : a.status === 'REJECTED' ? 'status-danger' : 'status-warning'}`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role View: Inventory Clerk Dashboard */}
      {user?.role === 'STAFF' && effectiveSubrole === 'INVENTORY_CLERK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
          <div className="content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  Recent Stock Movements & Inbound Receiving
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Monitor stock receipts, movements, damaged products, and expirations.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link to="/stock-movements" className="btn btn-secondary btn-sm">Stock Movement</Link>
                <Link to="/batches" className="btn btn-secondary btn-sm">Batches</Link>
                <Link to="/inventory" className="btn btn-primary btn-sm">View Stock</Link>
              </div>
            </div>

            {movements.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                <Warehouse size={36} color="#6366f1" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontWeight: 600 }}>No recent movement logs found.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Reference</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(m => (
                      <tr key={m.movement_id}>
                        <td><strong>{m.product_name}</strong></td>
                        <td>
                          <span className={`status-badge ${m.movement_type === 'PURCHASE' ? 'status-success' : m.movement_type === 'DAMAGED' ? 'status-danger' : 'status-info'}`}>
                            {m.movement_type}
                          </span>
                        </td>
                        <td>{m.quantity}</td>
                        <td>{m.reference_type || '-'}</td>
                        <td>{new Date(m.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Core Inventory Stats Cards */}
      <StatCards />

      {/* Analytics & Performance (Admins & Store Managers) */}
      {(user?.role === 'ADMIN' || user?.role === 'STORE_MANAGER') && (
        <>
          <div className="dashboard-grid">
            <SalesChart />
            <InventoryStatusChart />
          </div>

          <div className="dashboard-grid">
            <LowStockTable />
            <ExpiryAlertsTable />
          </div>

          <div className="dashboard-grid">
            <TopSellingChart />
            <div className="dashboard-grid-full">
              <RecentOrdersTable />
            </div>
          </div>
        </>
      )}

      {/* Staff View: Low Stock & Expiry Tables for easy warehouse navigation */}
      {user?.role === 'STAFF' && (
        <div className="dashboard-grid" style={{ marginTop: '24px' }}>
          <LowStockTable />
          <ExpiryAlertsTable />
        </div>
      )}
    </div>
  );
}
