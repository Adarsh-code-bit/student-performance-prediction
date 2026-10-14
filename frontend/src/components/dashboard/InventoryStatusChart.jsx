import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import api from '../../services/api';

export default function InventoryStatusChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api.get('/dashboard/inventory-status')
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
        <h3>Inventory Status</h3>
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
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || '#4F46E5'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
