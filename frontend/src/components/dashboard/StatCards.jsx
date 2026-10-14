import React, { useState, useEffect } from 'react';
import { Package, Layers, AlertTriangle, Clock, XCircle, ShoppingCart, Users, Truck } from 'lucide-react';
import api from '../../services/api';

const CARD_CONFIG = [
  { key: 'totalProducts', label: 'Total Products', icon: Package, color: '#4F46E5' },
  { key: 'totalInventory', label: 'Inventory Units', icon: Layers, color: '#0EA5E9' },
  { key: 'lowStock', label: 'Low Stock', icon: AlertTriangle, color: '#F59E0B' },
  { key: 'nearExpiry', label: 'Near Expiry', icon: Clock, color: '#F97316' },
  { key: 'expired', label: 'Expired', icon: XCircle, color: '#EF4444' },
  { key: 'todayOrders', label: "Today's Orders", icon: ShoppingCart, color: '#10B981' },
  { key: 'totalCustomers', label: 'Customers', icon: Users, color: '#8B5CF6' },
  { key: 'totalSuppliers', label: 'Suppliers', icon: Truck, color: '#06B6D4' },
];

export default function StatCards() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api.get('/dashboard/stats')
      .then(res => {
        if (res.data && res.data.success) {
          setStats(res.data.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-section">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message">
        <p>Failed to load data</p>
      </div>
    );
  }

  if (!stats || Object.keys(stats).length === 0) {
    return (
      <div className="empty-state">
        <p>No data available</p>
      </div>
    );
  }

  return (
    <div className="stat-cards-grid">
      {CARD_CONFIG.map((cfg) => {
        const Icon = cfg.icon;
        return (
          <div className="stat-card" key={cfg.key}>
            <div className="stat-card-icon" style={{ backgroundColor: cfg.color + '15', color: cfg.color }}>
              <Icon size={24} />
            </div>
            <div className="stat-card-info">
              <h3 className="stat-card-value">{stats[cfg.key] ?? 0}</h3>
              <p className="stat-card-label">{cfg.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
