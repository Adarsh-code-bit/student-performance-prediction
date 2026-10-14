import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { Plus, Edit2, Trash2, MapPin, AlertCircle } from 'lucide-react';

const Locations = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationToDelete, setLocationToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    location_name: '',
    rack_number: '',
    zone: '',
    description: ''
  });

  const { addToast } = useToast();

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/locations');
      if (response.data?.success) {
        setLocations(response.data.data || []);
      } else {
        setError('Failed to fetch locations');
      }
    } catch (err) {
      setError(err.message || 'Error loading locations');
      addToast('Failed to fetch locations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenModal = (location = null) => {
    if (location) {
      setCurrentLocation(location);
      setFormData({
        location_name: location.location_name || '',
        rack_number: location.rack_number || '',
        zone: location.zone || '',
        description: location.description || ''
      });
    } else {
      setCurrentLocation(null);
      setFormData({
        location_name: '',
        rack_number: '',
        zone: '',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    try {
      if (currentLocation) {
        await api.put(`/locations/${currentLocation.location_id}`, formData);
        addToast('Location updated successfully', 'success');
      } else {
        await api.post('/locations', formData);
        addToast('Location created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchLocations();
    } catch (err) {
      addToast(err.message || 'Failed to save location', 'error');
    }
  };

  const handleOpenDelete = (location) => {
    setLocationToDelete(location);
    setIsConfirmOpen(true);
  };

  const handleDeleteLocation = async () => {
    if (!locationToDelete) return;
    try {
      await api.delete(`/locations/${locationToDelete.location_id}`);
      addToast('Location deleted successfully', 'success');
      setIsConfirmOpen(false);
      fetchLocations();
    } catch (err) {
      addToast(err.message || 'Failed to delete location', 'error');
    }
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;
  if (error) return <div className="error-message"><AlertCircle className="icon" /> {error}</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Locations</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus className="icon" size={16} /> Add Location
          </button>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="empty-state">
          <MapPin className="empty-icon" />
          <p>No locations found</p>
          <button className="btn btn-secondary mt-2" onClick={() => handleOpenModal()}>Create First Location</button>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Rack</th>
                  <th>Zone</th>
                  <th>Products Stored</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(loc => (
                  <tr key={loc.location_id}>
                    <td>
                      <div className="font-medium">{loc.location_name}</div>
                      <div className="text-sm text-gray">{loc.description}</div>
                    </td>
                    <td>{loc.rack_number}</td>
                    <td>{loc.zone}</td>
                    <td>{loc.products_stored || 0}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-icon text-primary" onClick={() => handleOpenModal(loc)}>
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn-icon text-danger" onClick={() => handleOpenDelete(loc)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={currentLocation ? "Edit Location" : "Add Location"}
        >
          <form onSubmit={handleSaveLocation} className="form-container">
            <div className="form-group">
              <label>Location Name</label>
              <input 
                type="text" 
                name="location_name" 
                value={formData.location_name} 
                onChange={handleInputChange} 
                required 
                className="form-input" 
              />
            </div>
            <div className="form-group">
              <label>Rack Number</label>
              <input 
                type="text" 
                name="rack_number" 
                value={formData.rack_number} 
                onChange={handleInputChange} 
                className="form-input" 
              />
            </div>
            <div className="form-group">
              <label>Zone</label>
              <input 
                type="text" 
                name="zone" 
                value={formData.zone} 
                onChange={handleInputChange} 
                className="form-input" 
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea 
                name="description" 
                value={formData.description} 
                onChange={handleInputChange} 
                className="form-input" 
                rows="3"
              />
            </div>
            <div className="modal-actions mt-4">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {isConfirmOpen && (
        <ConfirmDialog
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleDeleteLocation}
          title="Delete Location"
          message={`Are you sure you want to delete location "${locationToDelete?.location_name}"? This action cannot be undone.`}
        />
      )}
    </div>
  );
};

export default Locations;
