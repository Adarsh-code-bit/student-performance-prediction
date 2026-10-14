import React, { useState, useEffect } from 'react';
import { AlertCircle, Package, TrendingUp, TrendingDown, Clock, CalendarX, Info } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const TABS = [
  { id: 'low-stock', label: 'Low Stock', icon: Package },
  { id: 'reorder', label: 'Reorder Suggestions', icon: AlertCircle },
  { id: 'near-expiry', label: 'Near Expiry', icon: Clock },
  { id: 'expired', label: 'Expired', icon: CalendarX },
  { id: 'fast-moving', label: 'Fast Moving', icon: TrendingUp },
  { id: 'slow-moving', label: 'Slow Moving', icon: TrendingDown },
];

const Analytics = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('low-stock');
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Fast moving period
  const [period, setPeriod] = useState(30);

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
    fetchAnalyticsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, period]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const renderTableHead = () => {
    switch (activeTab) {
      case 'low-stock':
        return (
          <tr>
            <th className="table-th">Product Name</th>
            <th className="table-th">Current Stock</th>
            <th className="table-th">Reorder Level</th>
            <th className="table-th">Status</th>
          </tr>
        );
      case 'reorder':
        return (
          <tr>
            <th className="table-th">Product Name</th>
            <th className="table-th">Current Stock</th>
            <th className="table-th">Reorder Level</th>
            <th className="table-th">Suggested Quantity</th>
          </tr>
        );
      case 'expired':
        return (
          <tr>
            <th className="table-th">Product Name</th>
            <th className="table-th">Batch Code</th>
            <th className="table-th">Expiry Date</th>
            <th className="table-th">Quantity</th>
            <th className="table-th">Days Expired</th>
          </tr>
        );
      case 'near-expiry':
        return (
          <tr>
            <th className="table-th">Product Name</th>
            <th className="table-th">Batch Code</th>
            <th className="table-th">Expiry Date</th>
            <th className="table-th">Remaining Days</th>
            <th className="table-th">Quantity</th>
          </tr>
        );
      case 'fast-moving':
        return (
          <tr>
            <th className="table-th">Rank</th>
            <th className="table-th">Product Name</th>
            <th className="table-th">Units Sold</th>
            <th className="table-th">Number of Orders</th>
            <th className="table-th">Sales Amount</th>
          </tr>
        );
      case 'slow-moving':
        return (
          <tr>
            <th className="table-th">Product Name</th>
            <th className="table-th">Last Sale Date</th>
            <th className="table-th">Units Sold</th>
            <th className="table-th">Days Since Last Sale</th>
            <th className="table-th">Status</th>
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
          <tr key={index} className="table-tr">
            <td className="table-td">{item.product_name}</td>
            <td className="table-td">{item.current_stock}</td>
            <td className="table-td">{item.reorder_level}</td>
            <td className="table-td">
              <span className={`status-badge ${item.status?.toLowerCase().replace(' ', '-')}`}>
                {item.status || 'Low'}
              </span>
            </td>
          </tr>
        );
      case 'reorder':
        return (
          <tr key={index} className="table-tr">
            <td className="table-td">{item.product_name}</td>
            <td className="table-td">{item.current_stock}</td>
            <td className="table-td">{item.reorder_level}</td>
            <td className="table-td font-semibold text-blue-600">{item.suggested_quantity}</td>
          </tr>
        );
      case 'expired':
        return (
          <tr key={index} className="table-tr">
            <td className="table-td">{item.product_name}</td>
            <td className="table-td">{item.batch_code}</td>
            <td className="table-td">{new Date(item.expiry_date).toLocaleDateString()}</td>
            <td className="table-td">{item.quantity}</td>
            <td className="table-td text-red-600">{item.days_expired}</td>
          </tr>
        );
      case 'near-expiry':
        return (
          <tr key={index} className="table-tr">
            <td className="table-td">{item.product_name}</td>
            <td className="table-td">{item.batch_code}</td>
            <td className="table-td">{new Date(item.expiry_date).toLocaleDateString()}</td>
            <td className="table-td text-orange-500">{item.remaining_days}</td>
            <td className="table-td">{item.quantity}</td>
          </tr>
        );
      case 'fast-moving':
        return (
          <tr key={index} className="table-tr">
            <td className="table-td">{item.rank || index + 1}</td>
            <td className="table-td">{item.product_name}</td>
            <td className="table-td">{item.units_sold}</td>
            <td className="table-td">{item.number_of_orders}</td>
            <td className="table-td font-medium">{formatCurrency(item.sales_amount)}</td>
          </tr>
        );
      case 'slow-moving':
        return (
          <tr key={index} className="table-tr">
            <td className="table-td">{item.product_name}</td>
            <td className="table-td">{item.last_sale_date ? new Date(item.last_sale_date).toLocaleDateString() : 'Never'}</td>
            <td className="table-td">{item.units_sold}</td>
            <td className="table-td">{item.days_since_last_sale}</td>
            <td className="table-td">
              <span className={`status-badge ${item.status?.toLowerCase().replace(' ', '-')}`}>
                 {item.status || 'Dormant'}
              </span>
            </td>
          </tr>
        );
      default:
        return null;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Analytics & Reports</h1>
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap border-b border-gray-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
        
        <div className="p-4 bg-gray-50 flex justify-between items-center border-b border-gray-200">
           {activeTab === 'fast-moving' && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Period:</label>
              <select
                className="input-field py-1"
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
              >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
              </select>
            </div>
          )}
          
          {activeTab === 'reorder' && (
            <div className="flex items-center text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md">
              <Info className="w-4 h-4 mr-1.5" />
              Rule-based reorder suggestion
            </div>
          )}
        </div>

        <div className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 flex flex-col items-center">
               <AlertCircle className="w-12 h-12 mb-3 text-red-400" />
               <p>{error}</p>
               <button 
                onClick={fetchAnalyticsData}
                className="mt-4 btn-secondary"
               >
                 Try Again
               </button>
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
              <Package className="w-12 h-12 mb-3 text-gray-300" />
              <p>No data found for this report.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  {renderTableHead()}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
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
