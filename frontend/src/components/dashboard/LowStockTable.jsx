import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, AlertCircle, ArrowRight, ShoppingBag } from 'lucide-react';
import api from '../../services/api';

export default function LowStockTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api.get('/dashboard/low-stock')
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

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#DC3545'
          }}>
            <AlertTriangle size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#17211B' }}>
              Low Stock & Replenishment Alerts
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#68736B' }}>
              Products at or below dark-store safety buffer
            </p>
          </div>
        </div>
        <Link to="/inventory" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
          View All Stock <ArrowRight size={12} />
        </Link>
      </div>
      <div className="dashboard-card-body">
        {loading ? (
          <div className="loading-section" style={{ padding: '40px 0' }}>
            <div className="loading-spinner"></div>
            <p style={{ fontSize: '12px', color: '#68736B', marginTop: '10px' }}>Checking warehouse stock buffers...</p>
          </div>
        ) : error ? (
          <div className="error-message" style={{ padding: '30px 0', textAlign: 'center', color: '#DC3545' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px' }}>Failed to load stock alerts</p>
          </div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center', color: '#168A45' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              ✓
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>All SKUs are above reorder threshold</p>
            <p style={{ fontSize: '11px', color: '#68736B', margin: '4px 0 0' }}>Safety buffers healthy across all dark store racks</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Available</th>
                  <th>Threshold</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 5).map((item, index) => {
                  const isOutOfStock = Number(item.current_stock) === 0;
                  const ratio = Math.min(100, Math.round((Number(item.current_stock) / (Number(item.reorder_level) || 1)) * 100));

                  return (
                    <tr key={item.product_id || index}>
                      <td>
                        <strong style={{ color: '#17211B', fontSize: '12px' }}>{item.product_name}</strong>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#68736B' }}>{item.sku}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', color: '#68736B', backgroundColor: '#F7F8F5', padding: '2px 6px', borderRadius: '4px', border: '1px solid #E5E9E4' }}>
                          {item.category_name || item.category || '-'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: isOutOfStock ? '#DC3545' : '#E9A23B', fontSize: '12px' }}>
                            {item.current_stock} {item.unit || 'units'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', color: '#68736B' }}>
                          {item.reorder_level} units
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${isOutOfStock ? 'status-out-of-stock' : 'status-low-stock'}`}>
                          {isOutOfStock ? 'Out of Stock' : 'Low Buffer'}
                        </span>
                      </td>
                      <td>
                        <Link to="/purchases" className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <ShoppingBag size={11} /> Reorder
                        </Link>
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
