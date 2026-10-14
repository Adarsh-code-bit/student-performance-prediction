import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';

export default function TopSellingChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api.get('/dashboard/top-selling')
      .then(res => {
        if (res.data && res.data.success) {
          const formattedData = res.data.data.map(item => ({
            ...item,
            shortName: item.product_name.length > 15 ? item.product_name.substring(0, 15) + '...' : item.product_name
          }));
          setData(formattedData);
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
        <h3>Top Selling Products</h3>
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
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" dataKey="total_sold" />
              <YAxis type="category" dataKey="shortName" width={100} />
              <Tooltip formatter={(value) => [value, 'Sold']} />
              <Bar dataKey="total_sold" fill="#4F46E5" barSize={20} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
