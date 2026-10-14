import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import { Search, AlertCircle, Package, Eye } from 'lucide-react';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');

  const { addToast } = useToast();

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/inventory');
      if (response.data?.success) {
        setInventory(response.data.data || []);
      } else {
        setError('Failed to fetch inventory');
      }
    } catch (err) {
      setError(err.message || 'Error fetching inventory');
      addToast('Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const categoryOptions = [...new Set(inventory.map(item => item.category_name).filter(Boolean))].sort();
  const locationOptions = [...new Map(
    inventory
      .filter(item => item.location_id && item.location_name)
      .map(item => [String(item.location_id), item.location_name])
  ).entries()];

  const getStockStatus = (item) => {
    const qty = Number(item.quantity);
    if (qty <= 0) return 'OUT_OF_STOCK';
    if (qty <= Number(item.reorder_level)) return 'LOW_STOCK';
    return 'IN_STOCK';
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = !searchTerm ||
      item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batch_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || item.category_name === categoryFilter;
    const matchesLocation = !locationFilter || String(item.location_id) === locationFilter;
    const matchesStock = !stockFilter || getStockStatus(item) === stockFilter;
    const matchesExpiry = !expiryFilter || item.status === expiryFilter;
    return matchesSearch && matchesCategory && matchesLocation && matchesStock && matchesExpiry;
  });

  if (loading) return <div className="loading-spinner">Loading...</div>;
  if (error) return <div className="error-message"><AlertCircle className="icon" /> {error}</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Inventory</h1>
        <div className="page-actions flex-wrap">
          <div className="search-bar">
            <Search className="icon" size={18} />
            <input 
              type="text" 
              placeholder="Search product..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>
          <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categoryOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select className="form-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">All Locations</option>
            {locationOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select className="form-select" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
            <option value="">Stock Status</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
          <select className="form-select" value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}>
            <option value="">Expiry Status</option>
            <option value="HEALTHY">Healthy</option>
            <option value="NEAR EXPIRY">Near Expiry</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>
      
      {filteredInventory.length === 0 ? (
        <div className="empty-state">
          <Package className="empty-icon" />
          <p>No inventory items found</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>Location</th>
                  <th>Quantity</th>
                  <th>Reorder Level</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => (
                  <tr key={item.inventory_id} onClick={() => handleView(item)} className="clickable-row">
                    <td>{item.product_name}</td>
                    <td>{item.batch_code}</td>
                    <td>{item.location_name}</td>
                    <td>{item.quantity}</td>
                    <td>{item.reorder_level}</td>
                    <td>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}</td>
                    <td><span className="badge">{item.status}</span></td>
                    <td>
                      <button className="btn btn-icon" onClick={(e) => { e.stopPropagation(); handleView(item); }}>
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && selectedItem && (
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title="Inventory Details"
        >
          <div className="details-grid">
            <div className="detail-item">
              <label>Product Name</label>
              <p>{selectedItem.product_name}</p>
            </div>
            <div className="detail-item">
              <label>Batch Code</label>
              <p>{selectedItem.batch_code}</p>
            </div>
            <div className="detail-item">
              <label>Location</label>
              <p>{selectedItem.location_name}</p>
            </div>
            <div className="detail-item">
              <label>Current Stock</label>
              <p>{selectedItem.quantity}</p>
            </div>
            <div className="detail-item">
              <label>Expiry Date</label>
              <p>{selectedItem.expiry_date ? new Date(selectedItem.expiry_date).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div className="detail-item">
              <label>Sales</label>
              <p>{selectedItem.sales || 0}</p>
            </div>
          </div>
          <div className="modal-actions mt-4">
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Inventory;
