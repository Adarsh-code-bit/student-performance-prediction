import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, Package, TrendingUp, TrendingDown, Clock, 
  CalendarX, Info, BarChart3, Layers, ShoppingCart, RefreshCw
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const TABS = [
  { id: 'low-stock', label: 'Low Stock Buffer', icon: Package },
  { id: 'reorder', label: 'Reorder Allocations', icon: AlertCircle },
  { id: 'near-expiry', label: 'Near Expiry (FEFO)', icon: Clock },
  { id: 'expired', label: 'Expired Inventory', icon: CalendarX },
  { id: 'fast-moving', label: 'Top Fast-Moving SKUs', icon: TrendingUp },
  { id: 'slow-moving', label: 'Slow Moving SKUs', icon: TrendingDown },
];

const Analytics = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('low-stock');
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Fast moving period
  const [period, setPeriod] = useState(30);

  // Chart data
  const [trendData, setTrendData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  const fetchCharts = async () => {
    try {
      setChartsLoading(true);
      const [salesRes, statusRes] = await Promise.all([
        api.get('/dashboard/sales-chart?days=30').catch(() => null),
        api.get('/dashboard/inventory-status').catch(() => null)
      ]);
      if (salesRes?.data?.success) setTrendData(salesRes.data.data || []);
      if (statusRes?.data?.success) {
        const colorMap = {
          'Healthy': '#168A45',
          'Low Stock': '#E9A23B',
          'Near Expiry': '#F8CB46',
          'Expired': '#DC3545',
          'Out of Stock': '#68736B'
        };
        setStatusData((statusRes.data.data || []).map(d => ({
          ...d,
          color: colorMap[d.name] || '#168A45'
        })));
      }
    } catch (err) {
      console.error('Error fetching analytics overview', err);
    } finally {
      setChartsLoading(false);
    }
  };

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    setError(null);
    setData([]);

    try {
      let endpoint = '';
      if (activeTab === 'fast-moving') {
        endpoint = `/analytics/fast-moving?days=${period}`;
      } else {
        endpoint = `/analytics/${activeTab}`;
      }

      const response = await api.get(endpoint);
      if (response.data && response.data.success) {
        setData(response.data.data || []);
      } else {
        setError('Failed to fetch analytics data');
        addToast('Failed to fetch analytics data', 'error');
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.response?.data?.message || 'An error occurred while fetching analytics data');
      addToast(err.response?.data?.message || 'Failed to fetch analytics data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCharts();
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, period]);

  const formatCurrency = (amount) => {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
  };

  const renderTableHead = () => {
    switch (activeTab) {
      case 'low-stock':
        return (
          <tr>
            <th>Product Name</th>
            <th>Current Stock</th>
            <th>Reorder Level</th>
            <th>Safety Status</th>
          </tr>
        );
      case 'reorder':
        return (
          <tr>
            <th>Product Name</th>
            <th>Current Stock</th>
            <th>Reorder Level</th>
            <th>Suggested Replenishment</th>
          </tr>
        );
      case 'expired':
        return (
          <tr>
            <th>Product Name</th>
            <th>Batch Code</th>
            <th>Expiry Date</th>
            <th>Remaining Qty</th>
            <th>Days Expired</th>
          </tr>
        );
      case 'near-expiry':
        return (
          <tr>
            <th>Product Name</th>
            <th>Batch Code</th>
            <th>Expiry Date</th>
            <th>Remaining Days</th>
            <th>Batch Units</th>
          </tr>
        );
      case 'fast-moving':
        return (
          <tr>
            <th>Rank</th>
            <th>Product Name</th>
            <th>Units Picked</th>
            <th>Fulfilled Orders</th>
            <th>Total Value</th>
          </tr>
        );
      case 'slow-moving':
        return (
          <tr>
            <th>Product Name</th>
            <th>Last Sale Date</th>
            <th>Units Sold</th>
            <th>Days Since Last Pick</th>
            <th>Inventory Status</th>
          </tr>
        );
      default:
        return null;
    }
  };

  const renderTableRow = (item, index) => {
    switch (activeTab) {
      case 'low-stock':
        return (
          <tr key={index}>
            <td><strong>{item.product_name}</strong></td>
            <td><span style={{ fontWeight: 700, color: '#DC3545' }}>{item.current_stock}</span></td>
            <td>{item.reorder_level}</td>
            <td>
              <span className={`status-badge ${Number(item.current_stock) === 0 ? 'status-out-of-stock' : 'status-low-stock'}`}>
                {Number(item.current_stock) === 0 ? 'Out of Stock' : 'Low Buffer'}
              </span>
            </td>
          </tr>
        );
      case 'reorder':
        return (
          <tr key={index}>
            <td><strong>{item.product_name}</strong></td>
            <td>{item.current_stock}</td>
            <td>{item.reorder_level}</td>
            <td>
              <span style={{ fontWeight: 800, color: '#168A45' }}>
                +{item.suggested_reorder_qty || (item.reorder_level * 2)} units
              </span>
            </td>
          </tr>
        );
      case 'expired':
        return (
          <tr key={index}>
            <td><strong>{item.product_name}</strong></td>
            <td><span style={{ fontFamily: 'monospace' }}>{item.batch_code}</span></td>
            <td>{new Date(item.expiry_date).toLocaleDateString()}</td>
            <td><strong style={{ color: '#DC3545' }}>{item.quantity} units</strong></td>
            <td>
              <span className="status-badge status-danger">{item.days_expired || 0} days past expiry</span>
            </td>
          </tr>
        );
      case 'near-expiry':
        return (
          <tr key={index}>
            <td><strong>{item.product_name}</strong></td>
            <td><span style={{ fontFamily: 'monospace' }}>{item.batch_code}</span></td>
            <td>{new Date(item.expiry_date).toLocaleDateString()}</td>
            <td>
              <span style={{ fontWeight: 700, color: Number(item.remaining_days) <= 7 ? '#DC3545' : '#E9A23B' }}>
                {item.remaining_days} days left
              </span>
            </td>
            <td><strong>{item.quantity} units</strong></td>
          </tr>
        );
      case 'fast-moving':
        return (
          <tr key={index}>
            <td>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: index === 0 ? '#F8CB46' : index === 1 ? '#e2e8f0' : index === 2 ? '#fed7aa' : '#F7F8F5',
                color: '#12372A',
                fontWeight: 800,
                fontSize: '11px'
              }}>
                #{index + 1}
              </span>
            </td>
            <td><strong>{item.product_name}</strong></td>
            <td><strong style={{ color: '#168A45' }}>{item.total_quantity_sold || item.units_sold || 0} units</strong></td>
            <td>{item.order_count || 1} orders</td>
            <td><strong>{formatCurrency(item.total_revenue || item.total_sales || 0)}</strong></td>
          </tr>
        );
      case 'slow-moving':
        return (
          <tr key={index}>
            <td><strong>{item.product_name}</strong></td>
            <td>{item.last_sale_date ? new Date(item.last_sale_date).toLocaleDateString() : 'No recorded sale'}</td>
            <td>{item.total_quantity_sold || item.units_sold || 0} units</td>
            <td><span style={{ color: '#E9A23B', fontWeight: 600 }}>{item.days_since_last_sale || '90+'} days</span></td>
            <td>
              <span className="status-badge badge-yellow">Low Turn</span>
            </td>
          </tr>
        );
      default:
        return null;
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#17211B' }}>
              Reports & Operational Analytics
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#12372A', color: '#F8CB46' }}>
              DARK STORE INTELLIGENCE
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#68736B' }}>
            Inventory turnover, velocity tiers, FEFO batch expiry alerts, and stock health audits.
          </p>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => { fetchCharts(); fetchAnalyticsData(); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={isLoading || chartsLoading ? 'spin' : ''} />
          Refresh Metrics
        </button>
      </div>

      {/* Analytics Visual Charts Row */}
      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        {/* Fulfillment Trend Line/Area Chart */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#17211B' }}>
                Outbound Fulfillment Trend (30 Days)
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#68736B' }}>
                Daily warehouse orders and dispatch values
              </p>
            </div>
          </div>
          <div className="dashboard-card-body">
            {chartsLoading ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <div className="loading-spinner"></div>
              </div>
            ) : trendData.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#68736B' }}>No trend data recorded</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="anGreenGrad" x1="0" y1="0" x2="0" y2="1">
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
                    tickFormatter={(d) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#68736B', fontSize: 11 }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#12372A', color: '#FFFFFF', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                    formatter={(val) => ['₹' + Number(val).toLocaleString('en-IN'), 'Dispatch Value']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#168A45" strokeWidth={2.5} fill="url(#anGreenGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Inventory Status Donut Chart */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#17211B' }}>
                Inventory Quality Breakdown
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#68736B' }}>
                Live categorization across SKU safety buffers
              </p>
            </div>
          </div>
          <div className="dashboard-card-body">
            {chartsLoading ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <div className="loading-spinner"></div>
              </div>
            ) : statusData.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#68736B' }}>No status data recorded</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '240px', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusData.map((e, idx) => (
                        <Cell key={idx} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#12372A', color: '#FFFFFF', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '11px', marginTop: '6px' }}>
                  {statusData.map(e => (
                    <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: e.color }} />
                      <span style={{ color: '#68736B' }}>{e.name}:</span>
                      <strong style={{ color: '#17211B' }}>{e.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Categories Tab Navigation */}
      <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          borderBottom: '2px solid #E5E9E4',
          backgroundColor: '#FFFFFF'
        }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                style={{
                  padding: '12px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  color: isActive ? '#168A45' : '#68736B',
                  borderBottom: isActive ? '3px solid #168A45' : '3px solid transparent',
                  marginBottom: '-2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        
        {/* Controls Bar for Current Tab */}
        <div style={{
          padding: '12px 18px',
          backgroundColor: '#F7F8F5',
          borderBottom: '1px solid #E5E9E4',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          {activeTab === 'fast-moving' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#17211B' }}>Analysis Window:</label>
              <select
                className="form-select"
                style={{ height: '32px', fontSize: '12px', padding: '2px 8px' }}
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
              >
                <option value={7}>Last 7 Days (Sprint)</option>
                <option value={30}>Last 30 Days (Monthly)</option>
                <option value={90}>Last 90 Days (Quarterly)</option>
              </select>
            </div>
          )}
          
          {activeTab === 'reorder' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#168A45', fontWeight: 600 }}>
              <Info size={15} />
              <span>Automated dark-store safety buffer formula based on lead time & reorder points.</span>
            </div>
          )}

          {activeTab === 'near-expiry' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#b45309', fontWeight: 600 }}>
              <Clock size={15} />
              <span>Batches expiring within 30 days must be assigned first per FEFO dispatch policy.</span>
            </div>
          )}

          <div style={{ fontSize: '12px', color: '#68736B' }}>
            Report Records: <strong>{data.length}</strong> SKUs
          </div>
        </div>

        {/* Report Data Table */}
        <div>
          {isLoading ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div className="loading-spinner"></div>
              <p style={{ marginTop: '12px', fontSize: '13px', color: '#68736B' }}>Compiling report data...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#DC3545' }}>
              <AlertCircle size={36} style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: '14px', fontWeight: 600 }}>{error}</p>
              <button 
                onClick={fetchAnalyticsData}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '10px' }}
              >
                Retry Query
              </button>
            </div>
          ) : data.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Package size={40} style={{ color: '#68736B', margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#17211B' }}>No items recorded</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#68736B' }}>All dark store inventory currently complies with this report filter.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  {renderTableHead()}
                </thead>
                <tbody>
                  {data.map((item, index) => renderTableRow(item, index))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
