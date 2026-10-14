import { Search, Bell, LogOut, Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const PAGE_TITLES = {
  '/':                'Dashboard',
  '/products':        'Products',
  '/import-products': 'Import Products',
  '/categories':      'Categories',
  '/suppliers':       'Suppliers',
  '/purchases':       'Purchases',
  '/batches':         'Batches',
  '/inventory':       'Inventory',
  '/locations':       'Locations',
  '/stock-movements': 'Stock Movements',
  '/customers':       'Customers',
  '/orders':          'Orders',
  '/analytics':       'Smart Analytics',
  '/audit-logs':      'Audit Logs',
  '/users':           'Users',
  '/staff-allocation':'Staff Allocation',
  '/stock-audits':    'Stock Audits',
};

function getPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/products/') && pathname !== '/products') return 'Product Details';
  return 'Dashboard';
}

export default function Topbar({ onMenuToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addToast } = useToast();

  const title = getPageTitle(location.pathname);

  const handleLogout = () => {
    logout();
    addToast('Logged out successfully', 'info');
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const displayName = user?.user_name || user?.full_name || user?.email || 'User';
  const displayRole = user?.role
    ? user.role.replace(/_/g, ' ')
    : 'User';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu-btn" onClick={onMenuToggle}>
          <Menu size={22} />
        </button>
        <div>
          <h1 className="topbar-title">{title}</h1>
          <span className="topbar-breadcrumb">Home / {title}</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-search">
          <Search size={16} color="#94A3B8" />
          <input type="text" placeholder="Search anything..." />
        </div>

        <button className="topbar-icon-btn" title="Notifications">
          <Bell size={20} />
          <span className="notification-dot" />
        </button>

        <div className="topbar-user-info" title={user?.email || ''}>
          <div>
            <div className="topbar-user-name">{displayName}</div>
            <div className="topbar-user-role">{displayRole}</div>
          </div>
          <div className="topbar-avatar">{getInitials(displayName)}</div>
        </div>

        <button 
          className="topbar-icon-btn" 
          title="Logout" 
          onClick={handleLogout}
          aria-label="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
