import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertCircle } from 'lucide-react';
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

  const totalPeriodRevenue = data.reduce((acc, curr) => acc + Number(curr.revenue || 0), 0);
  const totalPeriodOrders = data.reduce((acc, curr) => acc + Number(curr.orders || 0), 0);

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
            <TrendingUp size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#17211B' }}>
              Stock Movement & Outbound Fulfillment
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#68736B' }}>
              {days}D Total: ₹{totalPeriodRevenue.toLocaleString('en-IN')} • {totalPeriodOrders} dispatched orders
            </p>
          </div>
        </div>
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
          <div className="loading-section" style={{ padding: '60px 0' }}>
            <div className="loading-spinner"></div>
            <p style={{ fontSize: '12px', color: '#68736B', marginTop: '10px' }}>Loading outbound data...</p>
          </div>
        ) : error ? (
          <div className="error-message" style={{ padding: '40px 0', textAlign: 'center', color: '#DC3545' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px' }}>Failed to load stock movement data</p>
          </div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 0', textAlign: 'center', color: '#68736B' }}>
            <p style={{ fontSize: '13px' }}>No stock movement records for the selected window</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorGreenRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#168A45" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#168A45" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E4" vertical={false} />
              <XAxis 
                dataKey="date" 
                tickLine={false}
                axisLine={{ stroke: '#E5E9E4' }}
                tick={{ fill: '#68736B', fontSize: 11 }}
                tickFormatter={(tick) => {
                  const date = new Date(tick);
                  return isNaN(date) ? tick : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }} 
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#68736B', fontSize: 11 }}
                tickFormatter={(val) => val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#12372A',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontSize: '12px'
                }}
                formatter={(value) => ['₹' + Number(value).toLocaleString('en-IN'), 'Fulfillment Value']} 
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return isNaN(date) ? label : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#168A45" 
                strokeWidth={2.5} 
                fill="url(#colorGreenRevenue)" 
                activeDot={{ r: 5, fill: '#F8CB46', stroke: '#12372A', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
