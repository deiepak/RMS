import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Grid3X3,
  UtensilsCrossed,
  Package,
  Truck,
  Users,
  Tag,
  BookOpen,
  AlertTriangle,
  BarChart3,
  MessageSquare,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Settings,
  Wrench,
  Heart,
  TrendingDown,
  Compass,
  Tv,
  Volume2,
  VolumeX,
  Share2,
  Ban,
  Video
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import useSpeech from '../hooks/useSpeech';
import { socket, subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import '../index.css';

const NAV_CATEGORIES = [
  {
    title: 'Operations',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
      { to: '/admin/counter', icon: ShoppingBag, label: 'Counter Orders' },
      { to: '/admin/payments', icon: DollarSign, label: 'Accept Payments' },
      { to: '/admin/cancel-discount-orders', icon: Ban, label: 'Cancel / Discount Orders' },
      { to: '/admin/sales-return', icon: Ban, label: 'Sales Return' },
      { to: '/admin/tables', icon: Grid3X3, label: 'Tables' },
      { to: '/admin/packages', icon: Package, label: 'Packages' },
    ]
  },
  {
    title: 'Adventures',
    items: [
      { to: '/admin/adventures/sell', icon: Compass, label: 'Sell Adventure' },
      { to: '/admin/adventures/scan', icon: Compass, label: 'Scan Adventure' },
      { to: '/admin/adventures/manage', icon: Compass, label: 'Manage Adventures' },
      { to: '/admin/adventures/videos', icon: Compass, label: 'Video Requests' },
    ]
  },
  {
    title: 'Catalog',
    items: [
      { to: '/admin/menu', icon: UtensilsCrossed, label: 'Menu' },
      { to: '/admin/promos', icon: Tag, label: 'Promo Codes' },
    ]
  },
  {
    title: 'Inventory',
    items: [
      { to: '/admin/stock', icon: Package, label: 'Stock' },
      { to: '/admin/vendors', icon: Truck, label: 'Vendors' },
    ]
  },
  {
    title: 'Administration',
    items: [
      { to: '/admin/employees', icon: Users, label: 'Employees' },
      { to: '/admin/ledger', icon: BookOpen, label: 'Books & Ledger' },
      { to: '/admin/expenses', icon: TrendingDown, label: 'Expenses' },
      { to: '/admin/financial-log', icon: BookOpen, label: 'Financial Log' },
      { to: '/admin/tips', icon: Heart, label: 'Tips Ledger' },
      { to: '/admin/damage', icon: AlertTriangle, label: 'Damage Report' },
      { to: '/admin/maintenance', icon: Wrench, label: 'Maintenance Log' },
      { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/admin/stations', icon: Settings, label: 'Stations' },
      { to: '/admin/tv-content', icon: Tv, label: 'TV Content' },
      { to: '/admin/cctv', icon: Video, label: 'CCTV Monitoring' },
      { to: '/admin/social-media', icon: Share2, label: 'Social Media' },
      { to: '/admin/communication', icon: MessageSquare, label: 'Communication' },
      { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ]
  }
];

const SECTION_TITLES = {
  '/admin': 'Dashboard',
  '/admin/orders': 'Orders Management',
  '/admin/tables': 'Table Management',
  '/admin/menu': 'Menu Management',
  '/admin/stock': 'Stock Management',
  '/admin/vendors': 'Vendor Management',
  '/admin/employees': 'Employee Management',
  '/admin/promos': 'Promo Codes',
  '/admin/ledger': 'Books & Ledger',
  '/admin/expenses': 'Expenses',
  '/admin/financial-log': 'Financial Log',
  '/admin/damage': 'Damage Report',
  '/admin/analytics': 'Analytics',
  '/admin/communication': 'Communication',
  '/admin/counter': 'Counter Orders',
  '/admin/packages': 'Packages',
  '/admin/adventures/videos': 'Video Requests',
  '/admin/tv-content': 'TV Content Management',
  '/admin/social-media': 'Social Media & Marketing',
  '/admin/cancel-discount-orders': 'Cancel / Discount Orders',
  '/admin/sales-return': 'Sales Return Management',
  '/admin/cctv': 'CCTV Monitoring',
};

export default function AdminPortal() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { settings } = useSettings();

  let sectionTitle = SECTION_TITLES[location.pathname] || 'Admin Portal';
  if (location.pathname.startsWith('/admin/vendors/')) {
    sectionTitle = 'Vendor Profile';
  }

  const userAccessRaw = user?.access_pages;
  let userAccess = null; // null means unrestricted legacy admin
  
  if (userAccessRaw !== null && userAccessRaw !== undefined) {
    if (typeof userAccessRaw === 'string') {
      try {
        userAccess = JSON.parse(userAccessRaw);
      } catch (e) {
        userAccess = [];
      }
    } else {
      userAccess = userAccessRaw;
    }
  }

  const hasAccess = (path) => {
    if (user?.id === 1) return true; // Super Admin always has full access
    if (user?.role === 'admin' && userAccess === null) return true; // Legacy unrestricted admins
    if (!Array.isArray(userAccess) || userAccess.length === 0) return false; // Default to NO access if none specified
    // Check exact match or sub-path match
    return userAccess.some(allowedPath => path === allowedPath || path.startsWith(`${allowedPath}/`));
  };

  const visibleCategories = NAV_CATEGORIES.map(cat => ({
    ...cat,
    items: cat.items.filter(item => hasAccess(item.to))
  })).filter(cat => cat.items.length > 0);

  const [audioEnabled, setAudioEnabled] = useState(false);
  const { speak } = useSpeech();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    socket.connect();
    socket.emit('join', { room: 'admin' });

    const handleMessage = (msg) => {
      showToast(`From ${msg.sender_role}: ${msg.content || 'Voice message'}`, 'info');
      
      if (msg.audio_data) {
        const audio = new Audio(msg.audio_data);
        audio.play().catch(e => console.error("Audio play failed:", e));
      } else if (msg.content) {
        speak(`Message from ${msg.sender_role}. ${msg.content}`);
      }
    };

    const handleAssistance = (data) => {
      showToast(`Assistance requested at Table ${data.table_number}`, 'warning');
      speak(`Attention! Table ${data.table_number} has requested assistance.`);
    };

    subscribeToEvent('admin:message', handleMessage);
    subscribeToEvent('assistance:requested', handleAssistance);

    return () => {
      unsubscribeFromEvent('admin:message', handleMessage);
      unsubscribeFromEvent('assistance:requested', handleAssistance);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('rms_token');
    localStorage.removeItem('rms_user');
    showToast('Logged out successfully', 'info');
    navigate('/');
  };

  return (
    <div className="admin-layout">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      >
        <div className="sidebar-brand" onClick={() => navigate('/admin')} style={{ cursor: 'pointer' }}>
          <div className="brand-logo">{settings?.restaurant_name ? settings.restaurant_name.charAt(0) : 'R'}</div>
          {!collapsed && <span className="brand-text">{settings?.restaurant_name || 'Restaurant'}</span>}
          <button
            className="btn btn-icon sidebar-close-mobile"
            onClick={(e) => { e.stopPropagation(); setMobileOpen(false); }}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleCategories.map((category) => (
            <div key={category.title} className="sidebar-category">
              {!collapsed && <div className="sidebar-category-title">{category.title}</div>}
              {category.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''}`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={20} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="sidebar-link sidebar-link-logout"
            onClick={handleLogout}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center' }}
          >
            <LogOut size={20} />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            className="btn btn-icon sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            style={{ alignSelf: 'center', marginTop: '16px' }}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`admin-main ${collapsed ? 'expanded' : ''}`}>
        <header className="admin-header">
          <div className="header-left">
            <button
              className="btn btn-icon mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <h1 className="header-title">{sectionTitle}</h1>
          </div>
          <div className="header-right">
            <button 
              className={`btn btn-icon ${audioEnabled ? 'btn-secondary' : 'btn-danger'}`}
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (!audioEnabled) speak("Audio enabled");
              }}
              title={audioEnabled ? "Disable Audio" : "Enable Audio"}
            >
              {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <span className="header-user" style={{ marginLeft: '12px' }}>
              {user?.name || 'Admin'}
            </span>
            <button className="btn btn-icon header-bell">
              <Bell size={20} />
            </button>
          </div>
        </header>

        {!audioEnabled && (
          <div style={{ background: 'var(--danger)', color: '#fff', padding: '12px 16px', textAlign: 'center', cursor: 'pointer' }} onClick={() => {
            speak('Audio notifications enabled.');
            setAudioEnabled(true);
          }}>
            Click here to enable audio notifications for Voice Messages & Alerts!
          </div>
        )}

        <main className="admin-content">
          {!hasAccess(location.pathname) ? (
            <div className="flex-center flex-col" style={{ height: '50vh', textAlign: 'center' }}>
              <AlertTriangle size={64} className="text-danger mb-md" />
              <h2>Access Denied</h2>
              <p className="text-secondary mt-sm">You do not have permission to view this page.</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
