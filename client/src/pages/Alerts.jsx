import React, { useEffect, useState } from 'react';
import { alerts } from '../services/api';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';

const Alerts = () => {
  const [alertList, setAlertList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all', 'route_deviation', 'long_stop', 'delay', 'quantity_mismatch'
  const [filterResolved, setFilterResolved] = useState('unresolved'); // 'all', 'resolved', 'unresolved'
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    fetchAlerts();

    // Listen to real-time alerts
    const socket = io('http://localhost:5000');
    socket.on('alert-notification', (data) => {
      console.log('Real-time alert in list page:', data);
      // Auto-reload
      fetchAlerts();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const data = await alerts.getAlerts();
      setAlertList(data);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id) => {
    try {
      await alerts.resolveAlert(id);
      fetchAlerts();
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  const filteredAlerts = alertList.filter((alert) => {
    const matchesType = filterType === 'all' || alert.alert_type === filterType;
    const matchesResolved = 
      filterResolved === 'all' || 
      (filterResolved === 'resolved' && alert.resolved) ||
      (filterResolved === 'unresolved' && !alert.resolved);
    return matchesType && matchesResolved;
  });

  if (loading && alertList.length === 0) {
    return <div className="loading-spinner"></div>;
  }

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-title">
          <h2>AI Security & Anomaly Alerts Log</h2>
          <p>Real-time audit warnings for route deviations, stationary vehicles, and shortages</p>
        </div>
        
        <button 
          className="btn btn-secondary" 
          onClick={fetchAlerts}
        >
          <RefreshCw size={14} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
          <label>Filter by Anomaly Type</label>
          <select 
            className="form-control" 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Anomaly Types</option>
            <option value="route_deviation">Route Deviation</option>
            <option value="long_stop">Stationary Stop</option>
            <option value="delay">Delivery Delay</option>
            <option value="quantity_mismatch">Quantity Mismatch</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
          <label>Filter by Audit Status</label>
          <select 
            className="form-control" 
            value={filterResolved} 
            onChange={(e) => setFilterResolved(e.target.value)}
          >
            <option value="unresolved">Active / Unresolved</option>
            <option value="resolved">Audited / Resolved</option>
            <option value="all">All Logs</option>
          </select>
        </div>
      </div>

      {/* Alert Feed items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredAlerts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No security alerts match the selected filters.
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div key={alert.id} className={`card alert-item ${alert.severity}`} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderLeftWidth: '5px' }}>
              <div style={{ flexGrow: 1, maxWidth: '75%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span className={`alert-badge ${alert.severity}`}>{alert.severity} Severity</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{alert.id} | Shipment #{alert.shipment_id}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(alert.created_at).toLocaleString()}</span>
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  {alert.alert_type.toUpperCase().replace('_', ' ')}: {alert.product_name} Delivery
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {alert.details}
                </p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span><strong>From:</strong> {alert.warehouse_name}</span>
                  <span><strong>To:</strong> {alert.shop_name}</span>
                  <span><strong>Vehicle:</strong> {alert.vehicle_number} | <strong>Driver:</strong> {alert.driver_name || 'N/A'}</span>
                </div>
              </div>

              <div>
                {alert.resolved ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', fontWeight: '600', fontSize: '0.9rem' }}>
                    <CheckCircle size={18} />
                    <span>Resolved</span>
                  </div>
                ) : user?.role === 'super_admin' ? (
                  <button 
                    className="btn btn-primary" 
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                    onClick={() => handleResolve(alert.id)}
                  >
                    Resolve Alert
                  </button>
                ) : (
                  <span style={{ color: 'var(--warning)', fontSize: '0.8rem', fontWeight: 'bold' }}>Unresolved Anomaly</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Alerts;
