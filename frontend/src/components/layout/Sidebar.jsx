import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Grid3X3, Truck, ShoppingCart, Layers,
  Warehouse, MapPin, ArrowLeftRight, Users, ClipboardList,
  BarChart3, FileText, UserCog, Boxes, Database, LogOut,
  UserCheck, ClipboardCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard }
    ]
  },
  {
    title: 'Operations',
    items: [
      { path: '/staff-allocation', label: 'Staff Allocation', icon: UserCheck, roles: ['ADMIN', 'STORE_MANAGER'] },
      { path: '/stock-audits', label: 'Stock Audits', icon: ClipboardCheck, roles: ['ADMIN', 'STORE_MANAGER'], subroles: ['AUDITOR'] },
      { path: '/orders', label: 'Orders & Picking', icon: ClipboardList, roles: ['ADMIN', 'STORE_MANAGER'], subroles: ['PICKER', 'PACKER'] }
    ]
  },
  {
    title: 'Inventory & Stock',
    items: [
      { path: '/products', label: 'Products', icon: Package, roles: ['ADMIN', 'STORE_MANAGER'] },
      { path: '/import-products', label: 'Import Products', icon: Database, roles: ['ADMIN'] },
      { path: '/categories', label: 'Categories', icon: Grid3X3, roles: ['ADMIN', 'STORE_MANAGER'] },
      { path: '/inventory', label: 'Inventory Stock', icon: Warehouse, roles: ['ADMIN', 'STORE_MANAGER'], subroles: ['AUDITOR', 'PICKER', 'PACKER', 'INVENTORY_CLERK'] },
      { path: '/batches', label: 'Batches', icon: Layers, roles: ['ADMIN', 'STORE_MANAGER'], subroles: ['INVENTORY_CLERK'] },
      { path: '/locations', label: 'Warehouse Locations', icon: MapPin, roles: ['ADMIN', 'STORE_MANAGER'], subroles: ['INVENTORY_CLERK'] },
      { path: '/stock-movements', label: 'Stock Movement', icon: ArrowLeftRight, roles: ['ADMIN', 'STORE_MANAGER'], subroles: ['INVENTORY_CLERK'] }
    ]
  },
  {
    title: 'Procurement & CRM',
    items: [
      { path: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['ADMIN'] },
      { path: '/purchases', label: 'Purchases', icon: ShoppingCart, roles: ['ADMIN', 'STORE_MANAGER'], subroles: ['INVENTORY_CLERK'] },
      { path: '/customers', label: 'Customers', icon: Users, roles: ['ADMIN', 'STORE_MANAGER'] }
    ]
  },
  {
    title: 'System & Reports',
    items: [
      { path: '/analytics', label: 'Smart Analytics', icon: BarChart3, roles: ['ADMIN', 'STORE_MANAGER'] },
      { path: '/audit-logs', label: 'Audit Logs', icon: FileText, roles: ['ADMIN'] },
      { path: '/users', label: 'User Management', icon: UserCog, roles: ['ADMIN'] }
    ]
  }
];

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addToast } = useToast();

  const handleLogout = () => {
    onClose?.();
    logout();
    addToast('Logged out successfully', 'info');
    navigate('/login');
  };

  const effectiveSubrole = (user?.role === 'STAFF' && user?.active_assignment)
    ? user.active_assignment
    : user?.staff_subrole;

  const isItemVisible = (item) => {
    if (!item.roles && !item.subroles) return true;
    if (user?.role === 'ADMIN') return true;
    if (item.roles && item.roles.includes(user?.role)) return true;
    if (user?.role === 'STAFF' && item.subroles && item.subroles.includes(effectiveSubrole)) {
      return true;
    }
    return false;
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Boxes size={20} color="#fff" />
          </div>
          <div>
            <div className="sidebar-title">SmartInventory</div>
            <div className="sidebar-subtitle">Quick Commerce</div>
          </div>
        </div>

        {user && (
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.user_name}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                background: user.role === 'ADMIN' ? '#4f46e5' : user.role === 'STORE_MANAGER' ? '#0284c7' : '#475569',
                color: '#fff',
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 600
              }}>
                {user.role}
              </span>
              {user.staff_subrole && (
                <span style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#cbd5e1',
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '4px'
                }}>
                  {user.staff_subrole}
                </span>
              )}
            </div>
            {user.active_assignment && (
              <div style={{
                marginTop: '6px',
                fontSize: '10px',
                background: 'rgba(249, 115, 22, 0.15)',
                color: '#fdba74',
                padding: '3px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>⚡ Reassigned:</span>
                <strong>{user.active_assignment}</strong>
              </div>
            )}
          </div>
        )}

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section, idx) => {
            const visibleItems = section.items.filter(isItemVisible);
            if (visibleItems.length === 0) return null;

            return (
              <div key={idx}>
                <div className="sidebar-section-label">{section.title}</div>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                      end={item.path === '/'}
                      onClick={onClose}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button 
            type="button"
            className="sidebar-link"
            style={{ 
              width: '100%', 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              textAlign: 'left',
              marginBottom: '10px',
              color: '#fda4af'
            }}
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
          <div>Smart Inventory v1.0 © 2026</div>
        </div>
      </aside>
    </>
  );
}
