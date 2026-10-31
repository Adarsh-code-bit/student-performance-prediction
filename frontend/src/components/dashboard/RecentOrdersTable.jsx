import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';
import api from '../../services/api';

export default function RecentOrdersTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api.get('/dashboard/recent-orders')
      .then(res => {
        if (res.data && res.data.success) {
          setData(res.data.data || []);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ', ' +
           date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'delivered':
        return <span className="status-badge status-success">Delivered</span>;
      case 'shipped':
        return <span className="status-badge status-info">Shipped</span>;
      case 'packed':
        return <span className="status-badge status-picked">Packed</span>;
      case 'picking_in_progress':
      case 'processing':
        return <span className="status-badge status-warning">In Picking</span>;
      case 'cancelled':
        return <span className="status-badge status-danger">Cancelled</span>;
      case 'pending':
      default:
        return <span className="status-badge badge-yellow">Pending Pick</span>;
    }
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: '#e8f5e9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#168A45'
          }}>
            <ShoppingCart size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#17211B' }}>
              Live Order Fulfillment Stream
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#68736B' }}>
              Real-time dark store order intake & status tracking
            </p>
          </div>
        </div>
        <Link to="/orders" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
          Open Orders Hub <ArrowRight size={12} />
        </Link>
      </div>
      <div className="dashboard-card-body">
        {loading ? (
          <div className="loading-section" style={{ padding: '40px 0' }}>
            <div className="loading-spinner"></div>
            <p style={{ fontSize: '12px', color: '#68736B', marginTop: '10px' }}>Loading real-time orders...</p>
          </div>
        ) : error ? (
          <div className="error-message" style={{ padding: '30px 0', textAlign: 'center', color: '#DC3545' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px' }}>Failed to load order stream</p>
          </div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center', color: '#68736B' }}>
            <p style={{ fontSize: '13px' }}>No active orders in this fulfillment window</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order Ref</th>
                  <th>Customer</th>
                  <th>Placed At</th>
                  <th>Items</th>
                  <th>Order Value</th>
                  <th>Fulfillment Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.map((order, index) => (
                  <tr key={order.order_id || order.id || order.order_number || index}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#17211B', fontFamily: 'monospace', fontSize: '12px' }}>
                        #{order.order_number || `ORD-${order.order_id}`}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#17211B', fontSize: '12px' }}>
                        {order.customer_name || 'Quick Delivery Customer'}
                      </div>
                      {order.city && (
                        <div style={{ fontSize: '10px', color: '#68736B' }}>{order.city}</div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: '#68736B' }}>
                        {formatDate(order.order_date)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#17211B', fontSize: '12px' }}>
                        {order.total_items || order.item_count || 1} items
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#168A45', fontSize: '12px' }}>
                        ₹{Number(order.total_amount).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td>
                      {getStatusBadge(order.status)}
                    </td>
                    <td>
                      <Link 
                        to="/orders" 
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      >
                        Details <ExternalLink size={10} />
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
  );
}
