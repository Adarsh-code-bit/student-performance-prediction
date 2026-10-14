import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { FileText, AlertCircle } from 'lucide-react';

const Batches = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/batches');
      if (response.data?.success) {
        setBatches(response.data.data || []);
      } else {
        setError('Failed to fetch batches');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching batches');
      addToast('Failed to load batches', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'EXPIRED':
        return <span className="badge badge-danger">EXPIRED</span>;
      case 'NEAR EXPIRY':
        return <span className="badge badge-warning">NEAR EXPIRY</span>;
      case 'HEALTHY':
        return <span className="badge badge-success">HEALTHY</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;
  if (error) return <div className="error-message"><AlertCircle className="icon" /> {error}</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Batches</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={fetchBatches}>Refresh</button>
        </div>
      </div>
      
      {batches.length === 0 ? (
        <div className="empty-state">
          <FileText className="empty-icon" />
          <p>No batches found</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Product</th>
                  <th>Manufacturing Date</th>
                  <th>Expiry Date</th>
                  <th>Quantity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.batch_id}>
                    <td>{batch.batch_id}</td>
                    <td>{batch.product_name}</td>
                    <td>{new Date(batch.manufacturing_date).toLocaleDateString()}</td>
                    <td>{new Date(batch.expiry_date).toLocaleDateString()}</td>
                    <td>{batch.quantity}</td>
                    <td>{getStatusBadge(batch.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Batches;
