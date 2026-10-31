import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../../services/api';

export default function ExpiryAlertsTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api.get('/analytics/near-expiry')
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#b45309'
          }}>
            <CalendarClock size={16} color="#d97706" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#17211B' }}>
              Near-Expiry Batches (30-Day Window)
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#68736B' }}>
              FEFO priority batches requiring immediate dispatch or clearance
            </p>
          </div>
        </div>
        <Link to="/batches" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
          View Batches <ArrowRight size={12} />
        </Link>
      </div>
      <div className="dashboard-card-body">
        {loading ? (
          <div className="loading-section" style={{ padding: '40px 0' }}>
            <div className="loading-spinner"></div>
            <p style={{ fontSize: '12px', color: '#68736B', marginTop: '10px' }}>Scanning batch shelf-life...</p>
          </div>
        ) : error ? (
          <div className="error-message" style={{ padding: '30px 0', textAlign: 'center', color: '#DC3545' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px' }}>Failed to load batch expiry data</p>
          </div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center', color: '#168A45' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              ✓
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>No batches expiring within 30 days</p>
            <p style={{ fontSize: '11px', color: '#68736B', margin: '4px 0 0' }}>All active dark store inventory has fresh shelf-life</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch Code</th>
                  <th>Expiry Date</th>
                  <th>Remaining</th>
                  <th>Batch Qty</th>
                  <th>FEFO Priority</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 5).map((batch, idx) => {
                  const days = Number(batch.remaining_days);
                  const isUrgent = days <= 7;

                  return (
                    <tr key={batch.batch_code || idx}>
                      <td>
                        <strong style={{ color: '#17211B', fontSize: '12px' }}>{batch.product_name}</strong>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#68736B' }}>{batch.batch_code}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', color: '#17211B' }}>{formatDate(batch.expiry_date)}</span>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          fontSize: '11px',
                          color: isUrgent ? '#DC3545' : '#E9A23B'
                        }}>
                          {days <= 0 ? 'Expires Today' : `${days} days left`}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#17211B', fontSize: '12px' }}>
                          {batch.quantity} units
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${isUrgent ? 'status-danger' : 'badge-yellow'}`}>
                          {isUrgent ? 'URGENT DISPATCH' : 'PRIORITY FEFO'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
