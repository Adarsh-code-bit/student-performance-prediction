import React, { useState, useEffect } from 'react';
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
          setData(res.data.data);
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
        <h3>Low Stock Alert</h3>
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
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Reorder</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => {
                  const isOutOfStock = item.current_stock === 0;
                  const statusLabel = isOutOfStock ? 'Out of Stock' : 'Low Stock';
                  const statusClass = isOutOfStock ? 'danger' : 'warning';
                  
                  return (
                    <tr key={item.id || index}>
                      <td>{item.product_name}</td>
                      <td>{item.sku}</td>
                      <td>{item.category}</td>
                      <td>{item.current_stock}</td>
                      <td>{item.reorder_level}</td>
                      <td>
                        <span className={`status-badge status-${statusClass}`}>
                          {statusLabel}
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
