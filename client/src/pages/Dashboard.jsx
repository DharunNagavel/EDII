import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Warehouse, Truck, AlertTriangle, CheckCircle, Package, ArrowRight, ShieldAlert, Navigation
} from 'lucide-react';
import { dashboard, alerts, shipments, inventory, logistics } from '../services/api';
import { io } from 'socket.io-client';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driverShipments, setDriverShipments] = useState([]);
  const [fpsShipments, setFpsShipments] = useState([]);
  const [managerInventory, setManagerInventory] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(1);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    // Initial fetch based on role
    fetchRoleData(parsedUser);

    // Setup Socket.IO listener for real-time dashboard auto-refresh
    const socket = io('http://localhost:5000');
    
    socket.on('alert-notification', () => {
      console.log('Real-time socket trigger: reloading stats.');
      fetchRoleData(parsedUser);
    });

    socket.on('shipment-status-update', () => {
      console.log('Real-time socket trigger: reloading shipment data.');
      fetchRoleData(parsedUser);
    });

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  const fetchRoleData = async (currUser) => {
    try {
      setLoading(true);
      if (currUser.role === 'super_admin' || currUser.role === 'citizen') {
        const data = await dashboard.getStats();
        setStats(data);
      } else if (currUser.role === 'driver') {
        const data = await shipments.getShipments();
        setDriverShipments(data);
      } else if (currUser.role === 'fps_owner') {
        const data = await shipments.getShipments();
        setFpsShipments(data.filter(s => s.status !== 'delivered' && s.status !== 'cancelled'));
      } else if (currUser.role === 'warehouse_manager') {
        // Assume manager manages warehouse 1 for demo purposes
        const data = await inventory.getWarehouseStock(selectedWarehouseId);
        setManagerInventory(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Trigger inventory reload if warehouse is changed by manager
  useEffect(() => {
    if (user && user.role === 'warehouse_manager') {
      fetchRoleData(user);
    }
  }, [selectedWarehouseId]);

  const handleResolveAlert = async (alertId) => {
    try {
      await alerts.resolveAlert(alertId);
      // Reload stats
      const data = await dashboard.getStats();
      setStats(data);
    } catch (error) {
      console.error('Resolve alert error:', error);
    }
  };

  if (loading && !stats && driverShipments.length === 0 && managerInventory.length === 0) {
    return <div className="loading-spinner"></div>;
  }

  // --- 1. SUPER ADMIN / CITIZEN VIEW ---
  if (user?.role === 'super_admin' || user?.role === 'citizen') {
    const pieData = stats?.statusStats?.map(s => ({
      name: s.status.toUpperCase().replace('_', ' '),
      value: parseInt(s.count)
    })) || [];

    const barData = stats?.productStats?.map(p => ({
      name: p.product_name,
      Dispatched: parseFloat(p.total_dispatched),
      Received: parseFloat(p.total_received),
      Shortage: parseFloat(p.total_shortage)
    })) || [];

    return (
      <div>
        <div className="dashboard-header">
          <div className="header-title">
            <h2>PDS Central Monitoring Dashboard</h2>
            <p>Real-time leakage audit, shipment tracking, and AI anomaly alerts</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="card kpi-card">
            <div className="kpi-icon primary"><Warehouse size={24} /></div>
            <div className="kpi-details">
              <span className="kpi-label">PDS Warehouses</span>
              <span className="kpi-value">{stats?.totalWarehouses || 0}</span>
            </div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-icon info"><Truck size={24} /></div>
            <div className="kpi-details">
              <span className="kpi-label">Active Transits</span>
              <span className="kpi-value">{stats?.activeDeliveries || 0}</span>
            </div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-icon warning"><AlertTriangle size={24} /></div>
            <div className="kpi-details">
              <span className="kpi-label">Delayed Deliveries</span>
              <span className="kpi-value">{stats?.delayedDeliveries || 0}</span>
            </div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-icon danger"><ShieldAlert size={24} /></div>
            <div className="kpi-details">
              <span className="kpi-label">Active Leakage Risks</span>
              <span className="kpi-value">{stats?.leakageAlerts + stats?.quantityMismatchAlerts || 0}</span>
            </div>
          </div>
        </div>

        {/* Charts & Map Overview */}
        <div className="dashboard-grid">
          <div className="card" style={{ minHeight: '380px' }}>
            <h3 className="section-title">Stock Logistics Summary</h3>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f1524', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }} />
                  <Legend />
                  <Bar dataKey="Dispatched" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Shortage" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ minHeight: '380px' }}>
            <h3 className="section-title">Shipment Statuses</h3>
            <div style={{ width: '100%', height: '230px', display: 'flex', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f1524', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', marginTop: '1rem' }}>
              {pieData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '10px', height: '10px', backgroundColor: COLORS[i % COLORS.length], borderRadius: '50%' }}></div>
                  <span>{d.name}: {d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Real-time Alerts Panel */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 className="section-title" style={{ color: 'var(--danger)' }}>
            <AlertTriangle size={20} />
            <span>AI Anomaly Alerts Panel</span>
          </h3>
          {stats?.recentAlerts?.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No unresolved security alerts detected.</p>
          ) : (
            <div className="alert-feed">
              {stats?.recentAlerts?.map((alert) => (
                <div key={alert.id} className={`alert-item ${alert.severity}`}>
                  <div className="alert-meta">
                    <span className={`alert-badge ${alert.severity}`}>{alert.severity} Risk ({alert.risk_score})</span>
                    <span className="alert-time">{new Date(alert.created_at).toLocaleString()}</span>
                  </div>
                  <div className="alert-desc">
                    <strong>Shipment #{alert.shipment_id} ({alert.product_name}):</strong> {alert.details}
                  </div>
                  {user?.role === 'super_admin' && (
                    <button 
                      className="alert-action-btn"
                      onClick={() => handleResolveAlert(alert.id)}
                    >
                      Mark Resolved / Audited
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- 2. WAREHOUSE MANAGER VIEW ---
  if (user?.role === 'warehouse_manager') {
    return (
      <div>
        <div className="dashboard-header">
          <div className="header-title">
            <h2>Warehouse Inventory Manager</h2>
            <p>Monitor grain stocks and register outgoing supply dispatches</p>
          </div>
        </div>

        <div className="form-group" style={{ maxWidth: '300px', marginBottom: '2rem' }}>
          <label>Selected Warehouse</label>
          <select 
            className="form-control" 
            value={selectedWarehouseId} 
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
          >
            <option value="1">Central PDS Warehouse Chennai</option>
            <option value="2">Madurai Grain Silo</option>
          </select>
        </div>

        {/* Stock Level Cards */}
        <h3 className="section-title"><Package size={20} /> Current stock levels</h3>
        <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
          {managerInventory.map((item) => {
            const percentage = (item.quantity / 6000) * 100; // Assume 6000 is maximum capacity
            let color = 'var(--success)';
            if (percentage < 30) color = 'var(--danger)';
            else if (percentage < 60) color = 'var(--warning)';

            return (
              <div key={item.id} className="card">
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{item.product_name}</h4>
                <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0' }}>
                  {parseFloat(item.quantity).toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>kg/L</span>
                </p>
                <div style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', marginTop: '1rem', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(percentage, 100)}%`, background: color, height: '100%', borderRadius: '3px' }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>
                  Capacity: {Math.round(percentage)}% full
                </span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/shipments" className="btn btn-primary">
            <span>Dispatch Ration supplies</span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/inventory" className="btn btn-secondary">
            <span>Manage & Restock Supply</span>
          </Link>
        </div>
      </div>
    );
  }

  // --- 3. TRANSPORT DRIVER VIEW ---
  if (user?.role === 'driver') {
    const activeDriverShipments = driverShipments.filter(s => s.status !== 'delivered' && s.status !== 'cancelled');

    return (
      <div>
        <div className="dashboard-header">
          <div className="header-title">
            <h2>Driver Shipment Portal</h2>
            <p>Access assigned transits and initiate secure live location updates</p>
          </div>
        </div>

        <h3 className="section-title"><Truck size={20} /> Active Transit Assignments</h3>
        {activeDriverShipments.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No active shipments assigned currently.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeDriverShipments.map((shipment) => (
              <div key={shipment.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span className="status-badge in_transit" style={{ background: shipment.status === 'delayed' ? 'rgba(239,68,68,0.15)' : 'rgba(14,165,233,0.15)', color: shipment.status === 'delayed' ? 'var(--danger)' : 'var(--primary)' }}>
                      {shipment.status.toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 'bold' }}>Shipment #{shipment.id}</span>
                  </div>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{shipment.product_name} - {shipment.quantity_dispatched} kg/L</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    <strong>Route:</strong> {shipment.warehouse_name} → {shipment.shop_name}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>Expected:</strong> {new Date(shipment.expected_delivery).toLocaleString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link to={`/tracking?shipment=${shipment.id}`} className="btn btn-primary" style={{ gap: '0.5rem' }}>
                    <Navigation size={16} />
                    <span>GPS Telemetry Simulation</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- 4. FAIR PRICE SHOP OWNER VIEW ---
  if (user?.role === 'fps_owner') {
    return (
      <div>
        <div className="dashboard-header">
          <div className="header-title">
            <h2>Fair Price Shop (FPS) Manager</h2>
            <p>Verify incoming grain shipments and confirm delivery receipts</p>
          </div>
        </div>

        <h3 className="section-title"><Warehouse size={20} /> Incoming Supplies</h3>
        {fpsShipments.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No incoming supplies heading to your shop right now.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {fpsShipments.map((shipment) => (
              <div key={shipment.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span className={`status-badge ${shipment.status}`}>{shipment.status.toUpperCase()}</span>
                    <span style={{ fontWeight: 'bold' }}>Shipment #{shipment.id}</span>
                  </div>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{shipment.product_name} - {shipment.quantity_dispatched} kg/L</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    <strong>Dispatching Warehouse:</strong> {shipment.warehouse_name}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>Vehicle:</strong> {shipment.vehicle_number} | <strong>Driver:</strong> {shipment.driver_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <Link to={`/shipments`} className="btn btn-primary">
                    <CheckCircle size={16} />
                    <span>Verify Receipt & Accept</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default Dashboard;
