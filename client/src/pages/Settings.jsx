import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, User, Shield, Sliders } from 'lucide-react';

const Settings = () => {
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    setSuccess('Settings updated successfully!');
    setTimeout(() => setSuccess(''), 4000);
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin': return 'Super Admin (Government Authority)';
      case 'warehouse_manager': return 'PDS Warehouse Manager';
      case 'driver': return 'Transport Vehicle Driver';
      case 'fps_owner': return 'Fair Price Shop (FPS) Owner';
      case 'citizen': return 'General Citizen (Public / Guest Access)';
      default: return role;
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-title">
          <h2>System Settings</h2>
          <p>Configure interface parameters, review profile credentials, and adjust AI sensitivity</p>
        </div>
      </div>

      {success && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--success)', padding: '0.75rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }} className="dashboard-grid">
        {/* Profile Card */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 className="section-title"><User size={20} /> User Profile</h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-glow)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              {user.name.charAt(0)}
            </div>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{user.name}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{user.email}</p>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Assigned Role:</span>
              <div style={{ fontWeight: 'bold', marginTop: '0.1rem' }}>{getRoleLabel(user.role)}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Authority Clearance:</span>
              <div style={{ 
                color: user.role === 'super_admin' ? 'var(--danger)' : user.role === 'citizen' ? 'var(--info)' : 'var(--success)', 
                fontWeight: 'bold', 
                marginTop: '0.1rem' 
              }}>
                {user.role === 'super_admin' ? 'LEVEL 1 (NATIONWIDE)' : user.role === 'citizen' ? 'LEVEL 4 (PUBLIC READ-ONLY)' : 'LEVEL 3 (REGIONAL)'}
              </div>
            </div>
          </div>
        </div>

        {/* Configuration settings form */}
        <div className="card">
          <h3 className="section-title"><Sliders size={20} /> General Preferences</h3>
          
          <form onSubmit={handleSave}>
            <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
              <div>
                <label style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Dark Theme Mode</label>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                  Enable high-contrast glassmorphism colors optimized for control rooms.
                </span>
              </div>
              <input 
                type="checkbox" 
                checked={darkMode} 
                onChange={(e) => setDarkMode(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
            </div>

            <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Real-time Notifications</label>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                  Show active browser push notifications when AI flags transit anomalies.
                </span>
              </div>
              <input 
                type="checkbox" 
                checked={notifications} 
                onChange={(e) => setNotifications(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1rem' }}>
              <h4 style={{ marginBottom: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={16} style={{ color: 'var(--primary)' }} />
                <span>AI Sensitivity Tuning (Govt Admin)</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Route Deviation Threshold (km)</label>
                  <input type="number" className="form-control" defaultValue="1.5" disabled={user.role !== 'super_admin'} />
                </div>
                <div className="form-group">
                  <label>Vehicle Stop Trigger (hours)</label>
                  <input type="number" className="form-control" defaultValue="1.0" disabled={user.role !== 'super_admin'} />
                </div>
                <div className="form-group">
                  <label>Expected Delay Allowance (hours)</label>
                  <input type="number" className="form-control" defaultValue="2.0" disabled={user.role !== 'super_admin'} />
                </div>
                <div className="form-group">
                  <label>Isolation Forest Contamination (%)</label>
                  <input type="number" className="form-control" defaultValue="9" disabled={user.role !== 'super_admin'} />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '2rem' }}>
              Save General Configurations
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
