import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCcw } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';

const StockMovements = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const { addToast } = useToast();

  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);

  const [filters, setFilters] = useState({ search: '' });

  const [formData, setFormData] = useState({
    product_id: '',
    from_location_id: '',
    to_location_id: '',
    quantity: 1,
    reason: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [movementsRes, productsRes, locationsRes] = await Promise.all([
        api.get('/stock-movements'),
        api.get('/products'),
        api.get('/locations')
      ]);
      setMovements(movementsRes.data.data || []);
      setProducts(productsRes.data.data || []);
      setLocations(locationsRes.data.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load data. Please try again.');
      addToast('Error loading stock movements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.from_location_id === formData.to_location_id) {
      addToast('From and To locations must be different', 'error');
      return;
    }
    try {
      await api.post('/stock-movements', formData);
      addToast('Stock moved successfully', 'success');
      setShowModal(false);
      setFormData({ product_id: '', from_location_id: '', to_location_id: '', quantity: 1, reason: '' });
      fetchData();
    } catch (err) {
      addToast('Failed to move stock', 'error');
    }
  };

  const filteredMovements = movements.filter(m => 
    !filters.search || 
    m.product_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
    m.reason?.toLowerCase().includes(filters.search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Stock Movements</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="icon-sm" /> Move Stock
        </button>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="search-bar" style={{ maxWidth: '300px' }}>
            <Search className="search-icon" />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search movements..." 
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading stock movements...</div>
        ) : error ? (
          <div className="empty-state text-danger">{error}</div>
        ) : filteredMovements.length === 0 ? (
          <div className="empty-state">No stock movements found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Previous Location</th>
                  <th>New Location</th>
                  <th>Quantity</th>
                  <th>Changed By</th>
                  <th>Date/Time</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map(m => (
                  <tr key={m.movement_id}>
                    <td>{m.product_name}</td>
                    <td>{m.from_location_name}</td>
                    <td>{m.to_location_name}</td>
                    <td>{m.quantity}</td>
                    <td>{m.user_name}</td>
                    <td>{new Date(m.movement_date).toLocaleString()}</td>
                    <td>{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title="Move Stock"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Product</label>
            <select 
              className="form-control" 
              value={formData.product_id}
              onChange={(e) => setFormData({...formData, product_id: e.target.value})}
              required
            >
              <option value="">Select Product...</option>
              {products.map(p => (
                <option key={p.product_id} value={p.product_id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">From Location</label>
              <select 
                className="form-control" 
                value={formData.from_location_id}
                onChange={(e) => setFormData({...formData, from_location_id: e.target.value})}
                required
              >
                <option value="">Select Location...</option>
                {locations.map(l => (
                  <option key={l.location_id} value={l.location_id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">To Location</label>
              <select 
                className="form-control" 
                value={formData.to_location_id}
                onChange={(e) => setFormData({...formData, to_location_id: e.target.value})}
                required
              >
                <option value="">Select Location...</option>
                {locations.map(l => (
                  <option key={l.location_id} value={l.location_id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input 
              type="number" 
              className="form-control" 
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
              min="1"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Reason</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              required
            />
          </div>
          <div className="modal-footer" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Move Stock</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StockMovements;
