import React, { useState, useEffect } from 'react';
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
          setData(res.data.data);
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusClass = (status) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'delivered': return 'success';
      case 'shipped': return 'info';
      case 'processing': return 'warning';
      case 'cancelled': return 'danger';
      case 'pending':
      default: return 'default';
    }
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <h3>Recent Orders</h3>
      </div>
      <div className="dashboard-card-body">
        {loading ? (
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className="error-message">
            <p>Failed to load data</p>
          </div>
        ) : data.length === 0 ? (
          <div className="empty-state">
            <p>No data available</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((order, index) => (
                  <tr key={order.id || order.order_number || index}>
                    <td>{order.order_number}</td>
                    <td>{order.customer_name}</td>
                    <td>{formatDate(order.order_date)}</td>
                    <td>{order.total_items}</td>
                    <td>₹{Number(order.total_amount).toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`status-badge status-${getStatusClass(order.status)}`}>
                        {order.status}
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
  );
}
