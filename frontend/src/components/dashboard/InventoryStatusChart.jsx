import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Layers, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const COLOR_MAP = {
  'Healthy': '#168A45',
  'Low Stock': '#E9A23B',
  'Near Expiry': '#F8CB46',
  'Expired': '#DC3545',
  'Out of Stock': '#68736B',
};

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
          const mapped = (res.data.data || []).map(item => ({
            ...item,
            color: COLOR_MAP[item.name] || item.color || '#168A45'
          }));
          setData(mapped);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const totalSKUs = data.reduce((acc, curr) => acc + Number(curr.value || 0), 0);

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
            <Layers size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#17211B' }}>
              Stock Health & Inventory Status
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#68736B' }}>
              {totalSKUs} monitored product lines
            </p>
          </div>
        </div>
      </div>
      <div className="dashboard-card-body">
        {loading ? (
          <div className="loading-section" style={{ padding: '60px 0' }}>
            <div className="loading-spinner"></div>
            <p style={{ fontSize: '12px', color: '#68736B', marginTop: '10px' }}>Analyzing inventory status...</p>
          </div>
        ) : error ? (
          <div className="error-message" style={{ padding: '40px 0', textAlign: 'center', color: '#DC3545' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px' }}>Failed to load inventory health data</p>
          </div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 0', textAlign: 'center', color: '#68736B' }}>
            <p style={{ fontSize: '13px' }}>No inventory health records available</p>
          </div>
        ) : (
          <div>
            <div style={{ position: 'relative', height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    innerRadius={58}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#12372A',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      fontSize: '12px'
                    }}
                    formatter={(val, name) => [`${val} SKUs (${totalSKUs ? Math.round((val / totalSKUs) * 100) : 0}%)`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Donut Summary */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#17211B', lineHeight: 1 }}>{totalSKUs}</div>
                <div style={{ fontSize: '10px', color: '#68736B', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '3px' }}>Total SKUs</div>
              </div>
            </div>

            {/* Compact Custom Legend */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
              gap: '8px',
              paddingTop: '12px',
              borderTop: '1px solid #E5E9E4'
            }}>
              {data.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                  <span style={{ color: '#68736B', whiteSpace: 'nowrap' }}>{item.name}:</span>
                  <strong style={{ color: '#17211B' }}>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
