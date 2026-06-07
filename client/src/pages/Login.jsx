import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/api';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await auth.login(email, password);
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const autofillUser = (role) => {
    switch (role) {
      case 'super_admin':
        setEmail('admin@rationx.gov.in');
        setPassword('admin123');
        break;
      case 'warehouse_manager':
        setEmail('manager@rationx.gov.in');
        setPassword('manager123');
        break;
      case 'driver':
        setEmail('driver@rationx.gov.in');
        setPassword('driver123');
        break;
      case 'fps_owner':
        setEmail('fps@rationx.gov.in');
        setPassword('fps123');
        break;
      case 'citizen':
        setEmail('citizen@rationx.org.in');
        setPassword('citizen123');
        break;
      default:
        break;
    }
  };

  return (
    <div className="login-container">
      <div className="card login-card">
        <div className="login-header">
          <h1>RationX</h1>
          <p>Smart PDS Ration Supply Chain Tracker</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--danger)',
            padding: '0.75rem',
            borderRadius: '12px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="e.g. admin@rationx.gov.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '0.75rem' }}>
            Hackathon Demo Quick Login Roles:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem' }} onClick={() => autofillUser('super_admin')}>
              Super Admin
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem' }} onClick={() => autofillUser('warehouse_manager')}>
              Warehouse Mgr
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem' }} onClick={() => autofillUser('driver')}>
              Driver
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem' }} onClick={() => autofillUser('fps_owner')}>
              FPS Owner
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem', gridColumn: 'span 2', background: 'var(--primary-glow)', borderColor: 'rgba(14,165,233,0.2)', color: 'var(--primary)' }} onClick={() => autofillUser('citizen')}>
              General Citizen (Public / Guest)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
