import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Award, AlertCircle } from 'lucide-react';
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
          const formattedData = (res.data.data || []).slice(0, 6).map(item => ({
            ...item,
            shortName: item.product_name.length > 18 ? item.product_name.substring(0, 18) + '...' : item.product_name
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
            <Award size={16} color="#d97706" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#17211B' }}>
              Top Fast-Moving SKUs
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#68736B' }}>
              High-velocity pick items in the current fulfillment window
            </p>
          </div>
        </div>
      </div>
      <div className="dashboard-card-body">
        {loading ? (
          <div className="loading-section" style={{ padding: '60px 0' }}>
            <div className="loading-spinner"></div>
            <p style={{ fontSize: '12px', color: '#68736B', marginTop: '10px' }}>Loading top-selling SKUs...</p>
          </div>
        ) : error ? (
          <div className="error-message" style={{ padding: '40px 0', textAlign: 'center', color: '#DC3545' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px' }}>Failed to load top-selling data</p>
          </div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 0', textAlign: 'center', color: '#68736B' }}>
            <p style={{ fontSize: '13px' }}>No order dispatch history available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E9E4" />
              <XAxis 
                type="number" 
                dataKey="total_sold" 
                tickLine={false}
                axisLine={{ stroke: '#E5E9E4' }}
                tick={{ fill: '#68736B', fontSize: 11 }}
              />
              <YAxis 
                type="category" 
                dataKey="shortName" 
                width={120} 
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#17211B', fontSize: 11, fontWeight: 500 }}
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
                formatter={(value) => [`${value} units picked`, 'Velocity']} 
              />
              <Bar 
                dataKey="total_sold" 
                fill="#168A45" 
                barSize={16} 
                radius={[0, 4, 4, 0]} 
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
