import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  LayoutDashboard, 
  Warehouse, 
  Package, 
  Truck, 
  MapPin, 
  AlertTriangle, 
  FileText, 
  Settings as SettingsIcon, 
  LogOut,
  Bell
} from 'lucide-react';
import { auth } from '../services/api';

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [toastAlert, setToastAlert] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    // Connect to Socket.IO Server
    const socket = io('http://localhost:5000');

    socket.on('connect', () => {
      console.log('Connected to socket server on frontend Layout');
    });

    // Listen for real-time anomaly alerts
    socket.on('alert-notification', (data) => {
      console.log('Real-time anomaly alert received:', data);
      setToastAlert(data);
      // Auto dismiss toast after 8 seconds
      setTimeout(() => {
        setToastAlert(null);
      }, 8000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    auth.logout();
    navigate('/login');
  };

  // Define sidebar items based on role
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['super_admin', 'warehouse_manager', 'driver', 'fps_owner', 'citizen'] },
    { name: 'Warehouses', path: '/warehouses', icon: Warehouse, roles: ['super_admin'] },
    { name: 'Inventory', path: '/inventory', icon: Package, roles: ['super_admin', 'warehouse_manager'] },
    { name: 'Shipments', path: '/shipments', icon: Truck, roles: ['super_admin', 'warehouse_manager', 'driver', 'fps_owner', 'citizen'] },
    { name: 'Live Tracking', path: '/tracking', icon: MapPin, roles: ['super_admin', 'driver', 'citizen'] },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle, roles: ['super_admin', 'citizen'] },
    { name: 'Reports', path: '/reports', icon: FileText, roles: ['super_admin'] },
    { name: 'Settings', path: '/settings', icon: SettingsIcon, roles: ['super_admin', 'warehouse_manager', 'driver', 'fps_owner', 'citizen'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin': return 'Super Admin (Govt)';
      case 'warehouse_manager': return 'Warehouse Manager';
      case 'driver': return 'Transport Driver';
      case 'fps_owner': return 'FPS Shop Owner';
      case 'citizen': return 'General Citizen (Public)';
      default: return role;
    }
  };

  return (
    <div className="app-container">
      {/* Toast Alert Banner */}
      {toastAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(220, 38, 38, 0.95)',
          border: '1px solid #ef4444',
          borderRadius: '16px',
          padding: '1.25rem',
          color: 'white',
          boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)',
          zIndex: 9999,
          maxWidth: '350px',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
            <AlertTriangle size={18} />
            <span>AI SECURITY ALERT: {toastAlert.alert_type.toUpperCase().replace('_', ' ')}</span>
          </div>
          <p style={{ fontSize: '0.85rem', margin: 0, opacity: 0.95 }}>{toastAlert.details}</p>
          <button 
            onClick={() => setToastAlert(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.8rem',
              alignSelf: 'flex-end',
              textDecoration: 'underline',
              padding: 0
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>RationX</h1>
        </div>
        
        <nav style={{ flexGrow: 1 }}>
          <ul className="sidebar-menu">
            {filteredMenu.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.name} className={`menu-item ${isActive ? 'active' : ''}`}>
                  <Link to={item.path}>
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-user">
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{getRoleLabel(user.role)}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {children}
      </main>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Layout;
