import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { History } from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    table_name: ''
  });

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.action) params.append('action', filters.action);
      if (filters.table_name) params.append('table_name', filters.table_name);
      
      const res = await api.get(`/audit-logs?${params.toString()}`);
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, [filters]);

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n) => n < 10 ? '0' + n : n;
    
    return `${pad(d.getDate())}-${months[d.getMonth()]}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getActionColor = (action) => {
    switch(action?.toUpperCase()) {
      case 'INSERT': return 'badge-success';
      case 'UPDATE': return 'badge-warning';
      case 'DELETE': return 'badge-error';
      default: return 'badge-primary';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History size={24} /> Audit Logs
        </h1>
        <p className="text-gray-500">Track system activities and changes</p>
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
            <select
              className="input-field w-full"
              value={filters.user_id}
              onChange={e => setFilters({...filters, user_id: e.target.value})}
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              className="input-field w-full"
              value={filters.action}
              onChange={e => setFilters({...filters, action: e.target.value})}
            >
              <option value="">All Actions</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Table</label>
            <select
              className="input-field w-full"
              value={filters.table_name}
              onChange={e => setFilters({...filters, table_name: e.target.value})}
            >
              <option value="">All Tables</option>
              <option value="product">product</option>
              <option value="purchase">purchase</option>
              <option value="orders">orders</option>
              <option value="stock_movement">stock_movement</option>
              <option value="inventory">inventory</option>
            </select>
          </div>
          <button 
            className="btn btn-secondary h-10 px-4"
            onClick={() => setFilters({user_id: '', action: '', table_name: ''})}
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Table</th>
                <th>Record ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-4">Loading logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-gray-500">No logs found matching criteria.</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td>{log.user_name || `User ${log.user_id}`}</td>
                    <td>
                      <span className={`badge ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="capitalize">{log.table_name?.replace('_', ' ')}</td>
                    <td>{log.record_id}</td>
                    <td className="max-w-xs truncate" title={JSON.stringify(log.details)}>
                      {log.details ? JSON.stringify(log.details) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
