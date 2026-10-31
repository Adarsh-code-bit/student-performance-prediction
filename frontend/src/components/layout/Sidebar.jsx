import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Grid3X3, Truck, ShoppingCart, Layers,
  Warehouse, MapPin, ArrowLeftRight, Users, ClipboardList,
  BarChart3, FileText, UserCog, Boxes, Database, LogOut,
  UserCheck, ClipboardCheck, Zap
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
            <Zap size={22} fill="#12372A" color="#12372A" />
          </div>
          <div>
            <div className="sidebar-title flex items-center gap-1.5">
              <span>QUICKSTOCK</span>
              <span style={{ fontSize: '10px', background: '#F8CB46', color: '#12372A', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>WMS</span>
            </div>
            <div className="sidebar-subtitle">Smart Inventory</div>
          </div>
        </div>

        {user && (
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.18)'
          }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.user_name}
            </div>
            <div style={{ fontSize: '11px', color: '#CBD2CA', display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                background: user.role === 'ADMIN' ? '#168A45' : user.role === 'STORE_MANAGER' ? '#0E5B2E' : '#2A4A3C',
                color: '#fff',
                fontSize: '10px',
                padding: '2px 7px',
                borderRadius: '4px',
                fontWeight: 700,
                letterSpacing: '0.4px',
                border: '1px solid rgba(255,255,255,0.12)'
              }}>
                {user.role}
              </span>
              {user.staff_subrole && (
                <span style={{
                  background: 'rgba(248, 203, 70, 0.15)',
                  color: '#F8CB46',
                  fontSize: '10px',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  border: '1px solid rgba(248, 203, 70, 0.3)'
                }}>
                  {user.staff_subrole}
                </span>
              )}
            </div>
            {user.active_assignment && (
              <div style={{
                marginTop: '8px',
                fontSize: '11px',
                background: 'rgba(233, 162, 59, 0.18)',
                color: '#F8CB46',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(248, 203, 70, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <Zap size={12} fill="#F8CB46" />
                <span>Surge Duty:</span>
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
              background: 'rgba(220, 53, 69, 0.12)', 
              border: '1px solid rgba(220, 53, 69, 0.25)', 
              cursor: 'pointer', 
              textAlign: 'left',
              marginBottom: '10px',
              color: '#FCA5A5',
              fontWeight: 600
            }}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
          <div style={{ fontSize: '11px', color: '#9AA39D', letterSpacing: '0.3px' }}>
            QUICKSTOCK Operations • v2.0
          </div>
        </div>
      </aside>
    </>
  );
}
