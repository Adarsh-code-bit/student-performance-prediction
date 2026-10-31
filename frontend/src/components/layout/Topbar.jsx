import { useState, useRef, useEffect } from 'react';
import { Search, Bell, LogOut, Menu, User, Shield, ChevronDown, Warehouse } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const PAGE_TITLES = {
  '/':                'Dashboard',
  '/products':        'Products Catalogue',
  '/import-products': 'Bulk Import Products',
  '/categories':      'Categories',
  '/suppliers':       'Suppliers Management',
  '/purchases':       'Purchase Orders',
  '/batches':         'Batch Inventory',
  '/inventory':       'Inventory Stock',
  '/locations':       'Warehouse Locations',
  '/stock-movements': 'Stock Movements',
  '/customers':       'Customer Management',
  '/orders':          'Orders & Picking Station',
  '/analytics':       'Smart Analytics',
  '/audit-logs':      'Audit Trail Logs',
  '/users':           'User Governance',
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

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const title = getPageTitle(location.pathname);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
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
        <button className="mobile-menu-btn" onClick={onMenuToggle} aria-label="Toggle Navigation Menu">
          <Menu size={22} />
        </button>
        <div>
          <h1 className="topbar-title">{title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="topbar-breadcrumb">QuickStock / {title}</span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            {/* Dark Store indicator */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-[#E8F5ED] text-[#168A45] border border-[#168A45]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#168A45] animate-pulse" />
              <span>Dark Store #{user?.store_id || 1}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="topbar-right">
        {/* Global Search */}
        <div className="topbar-search">
          <Search size={15} color="#68736B" />
          <input 
            type="text" 
            placeholder="Search products, orders, SKU..." 
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                navigate(`/products?search=${encodeURIComponent(e.target.value.trim())}`);
              }
            }}
          />
        </div>

        {/* Notifications Icon Button */}
        <button 
          className="topbar-icon-btn" 
          title="Warehouse Activity Alerts"
          onClick={() => navigate('/orders')}
        >
          <Bell size={18} />
          <span className="notification-dot" />
        </button>

        {/* Account Menu Dropdown */}
        <div className="relative" ref={menuRef}>
          <button 
            type="button"
            className="topbar-user-info"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-expanded={menuOpen}
          >
            <div className="text-right">
              <div className="topbar-user-name">{displayName}</div>
              <div className="topbar-user-role">{displayRole}</div>
            </div>
            <div className="topbar-avatar">{getInitials(displayName)}</div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Card */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-[#E5E9E4] py-2 z-[200] animate-fadeIn">
              <div className="px-4 py-2 border-b border-[#E5E9E4]">
                <p className="text-xs font-semibold text-[#68736B] uppercase tracking-wider">Signed In As</p>
                <p className="text-sm font-bold text-[#17211B] truncate">{displayName}</p>
                <p className="text-xs text-[#68736B] truncate">{user?.email}</p>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); navigate('/orders'); }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-[#17211B] hover:bg-[#F7F8F5] flex items-center gap-2"
                >
                  <Warehouse size={14} className="text-[#168A45]" />
                  <span>Assigned Store #{user?.store_id || 1}</span>
                </button>
                {user?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); navigate('/users'); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#17211B] hover:bg-[#F7F8F5] flex items-center gap-2"
                  >
                    <Shield size={14} className="text-[#E9A23B]" />
                    <span>Admin Settings</span>
                  </button>
                )}
              </div>

              <div className="border-t border-[#E5E9E4] pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-[#DC3545] hover:bg-[#FDF2F2] flex items-center gap-2"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
