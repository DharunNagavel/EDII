import React, { useEffect, useState } from 'react';
import { logistics } from '../services/api';
import { Warehouse, MapPin, Plus } from 'lucide-react';

const Warehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const data = await logistics.getWarehouses();
      setWarehouses(data);
    } catch (err) {
      console.error('Error fetching warehouses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !lat || !lng || !address) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setSuccess('');

    try {
      await logistics.addWarehouse({
        warehouse_name: name,
        location_lat: parseFloat(lat),
        location_lng: parseFloat(lng),
        address
      });
      setSuccess('Warehouse registered successfully! Starting stock seeded.');
      setName('');
      setLat('');
      setLng('');
      setAddress('');
      setShowForm(false);
      fetchWarehouses();
    } catch (err) {
      console.error('Add warehouse error:', err);
      setError(err.response?.data?.message || 'Error registering warehouse.');
    }
  };

  if (loading && warehouses.length === 0) {
    return <div className="loading-spinner"></div>;
  }

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-title">
          <h2>PDS Warehouses</h2>
          <p>Register, coordinate, and review storage locations across PDS network</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={16} />
          <span>Register Warehouse</span>
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 className="section-title">New Warehouse Details</h3>
          {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Warehouse Name</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. South Zonal Storage Hub" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Latitude</label>
              <input 
                type="number" 
                step="0.0001"
                className="form-control" 
                placeholder="e.g. 13.0827" 
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Longitude</label>
              <input 
                type="number" 
                step="0.0001"
                className="form-control" 
                placeholder="e.g. 80.2707" 
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Physical Address</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Poonamallee Road, Chennai, TN" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">Save Warehouse</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          color: 'var(--success)',
          padding: '0.75rem',
          borderRadius: '12px',
          fontSize: '0.85rem',
          marginBottom: '1.5rem'
        }}>
          {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {warehouses.map((wh) => (
          <div key={wh.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '1.2rem', justifyContent: 'center' }}>
                <Warehouse size={20} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>{wh.warehouse_name}</h3>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem', marginTop: '0.5rem' }}>
              <MapPin size={16} style={{ flexShrink: 0, marginTop: '0.1rem', color: 'var(--primary)' }} />
              <span>{wh.address}</span>
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
              <span><strong>Lat:</strong> {parseFloat(wh.location_lat).toFixed(4)}</span>
              <span><strong>Lng:</strong> {parseFloat(wh.location_lng).toFixed(4)}</span>
              <span style={{ marginLeft: 'auto' }}>ID: {wh.id}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Warehouses;
