import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { Plus, Edit2, Trash2, MapPin, AlertCircle, Layers } from 'lucide-react';

const initialFormState = {
  location_name: '',
  zone: '',
  aisle: '',
  rack_number: '',
  shelf: '',
  bin: '',
  max_capacity: '',
  description: ''
};

const Locations = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationToDelete, setLocationToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState(initialFormState);

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
        zone: location.zone || '',
        aisle: location.aisle || '',
        rack_number: location.rack_number || '',
        shelf: location.shelf || '',
        bin: location.bin || '',
        max_capacity: location.max_capacity !== null && location.max_capacity !== undefined ? String(location.max_capacity) : '',
        description: location.description || ''
      });
    } else {
      setCurrentLocation(null);
      setFormData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!formData.location_name.trim()) {
      addToast('Location Name is required', 'error');
      return;
    }

    setSaving(true);
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
      addToast(err.response?.data?.message || err.message || 'Failed to save location', 'error');
    } finally {
      setSaving(false);
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
      addToast(err.response?.data?.message || err.message || 'Failed to delete location', 'error');
    }
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;
  if (error) return <div className="error-message"><AlertCircle className="icon" /> {error}</div>;

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Layers className="text-primary-600" size={26} />
            Warehouse Locations & Rack Guidance
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure dark store layout: Zones, Aisles, Racks, Shelves, and Bins for automated picker routing.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary flex items-center gap-2" onClick={() => handleOpenModal()}>
            <Plus className="icon" size={16} /> Add Location
          </button>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="empty-state">
          <MapPin className="empty-icon" />
          <p>No storage locations configured yet</p>
          <button className="btn btn-secondary mt-2" onClick={() => handleOpenModal()}>Create First Location</button>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Location Name</th>
                  <th>Zone</th>
                  <th>Aisle</th>
                  <th>Rack</th>
                  <th>Shelf</th>
                  <th>Bin</th>
                  <th>Products Stored</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(loc => (
                  <tr key={loc.location_id}>
                    <td>
                      <div className="font-semibold text-gray-800">{loc.location_name}</div>
                      {loc.description && (
                        <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate" title={loc.description}>
                          {loc.description}
                        </div>
                      )}
                    </td>
                    <td>
                      {loc.zone ? (
                        <span className="badge badge-blue font-medium">{loc.zone}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      {loc.aisle ? (
                        <span className="font-mono text-sm">{loc.aisle}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      {loc.rack_number ? (
                        <span className="font-mono text-sm">{loc.rack_number}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      {loc.shelf ? (
                        <span className="font-mono text-sm">{loc.shelf}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      {loc.bin ? (
                        <span className="font-mono text-sm">{loc.bin}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      <span className="font-semibold">{loc.products_stored || 0}</span>
                    </td>
                    <td className="text-right">
                      <div className="action-buttons flex justify-end gap-1">
                        <button className="btn btn-icon text-primary" title="Edit location" onClick={() => handleOpenModal(loc)}>
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn-icon text-danger" title="Delete location" onClick={() => handleOpenDelete(loc)}>
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
          title={currentLocation ? "Edit Storage Location" : "Add Storage Location"}
          size="lg"
        >
          <form onSubmit={handleSaveLocation} className="form-container">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group md:col-span-2">
                <label className="form-label font-medium text-gray-700">Location Name *</label>
                <input 
                  type="text" 
                  name="location_name" 
                  placeholder="e.g. Rack A-12 Top Level or Ambient Bay 1"
                  value={formData.location_name} 
                  onChange={handleInputChange} 
                  required 
                  className="form-input" 
                />
              </div>

              <div className="form-group">
                <label className="form-label font-medium text-gray-700">Zone</label>
                <input 
                  type="text" 
                  name="zone" 
                  placeholder="e.g. Ambient, Chilled, Frozen, Bulk"
                  value={formData.zone} 
                  onChange={handleInputChange} 
                  className="form-input" 
                />
              </div>

              <div className="form-group">
                <label className="form-label font-medium text-gray-700">Aisle</label>
                <input 
                  type="text" 
                  name="aisle" 
                  placeholder="e.g. AISLE-01, A-04"
                  value={formData.aisle} 
                  onChange={handleInputChange} 
                  className="form-input" 
                />
              </div>

              <div className="form-group">
                <label className="form-label font-medium text-gray-700">Rack Number</label>
                <input 
                  type="text" 
                  name="rack_number" 
                  placeholder="e.g. R-01, R-12"
                  value={formData.rack_number} 
                  onChange={handleInputChange} 
                  className="form-input" 
                />
              </div>

              <div className="form-group">
                <label className="form-label font-medium text-gray-700">Shelf</label>
                <input 
                  type="text" 
                  name="shelf" 
                  placeholder="e.g. SHELF-A, S-02"
                  value={formData.shelf} 
                  onChange={handleInputChange} 
                  className="form-input" 
                />
              </div>

              <div className="form-group">
                <label className="form-label font-medium text-gray-700">Bin / Position</label>
                <input 
                  type="text" 
                  name="bin" 
                  placeholder="e.g. BIN-01, 0B"
                  value={formData.bin} 
                  onChange={handleInputChange} 
                  className="form-input" 
                />
              </div>

              <div className="form-group">
                <label className="form-label font-medium text-gray-700">Max Capacity (Units)</label>
                <input 
                  type="number" 
                  name="max_capacity" 
                  placeholder="e.g. 500 (leave blank for unlimited)"
                  value={formData.max_capacity} 
                  onChange={handleInputChange} 
                  min="1"
                  className="form-input" 
                />
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label font-medium text-gray-700">Description / Access Notes</label>
                <textarea 
                  name="description" 
                  placeholder="e.g. High-velocity picking bay near packing station"
                  value={formData.description} 
                  onChange={handleInputChange} 
                  className="form-input" 
                  rows="3"
                />
              </div>
            </div>

            <div className="modal-actions mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Location'}
              </button>
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
          message={`Are you sure you want to deactivate location "${locationToDelete?.location_name}"? Existing inventory and picking history will be preserved.`}
        />
      )}
    </div>
  );
};

export default Locations;
