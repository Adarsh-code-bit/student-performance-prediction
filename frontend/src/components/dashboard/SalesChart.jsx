import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';

export default function SalesChart() {
  const [data, setData] = useState([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api.get(`/dashboard/sales-chart?days=${days}`)
      .then(res => {
        if (res.data && res.data.success) {
          setData(res.data.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <h3>Sales Overview</h3>
        <div className="chart-tabs">
          {[7, 30, 90].map(d => (
            <button 
              key={d} 
              className={`chart-tab ${days === d ? 'active' : ''}`} 
              onClick={() => setDays(d)}
            >
              {d}D
            </button>
          ))}
        </div>
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
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(tick) => {
                  const date = new Date(tick);
                  return isNaN(date) ? tick : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }} 
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => ['₹' + Number(value).toLocaleString('en-IN'), 'Revenue']} 
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return isNaN(date) ? label : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }} 
              />
              <Area type="monotone" dataKey="revenue" stroke="#4F46E5" fill="url(#colorRevenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
