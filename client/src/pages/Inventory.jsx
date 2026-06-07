import React, { useEffect, useState } from 'react';
import { inventory, logistics } from '../services/api';
import { Package, History, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';

const Inventory = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [stock, setStock] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [productName, setProductName] = useState('Rice');
  const [quantity, setQuantity] = useState('');
  const [changeType, setChangeType] = useState('add'); // 'add' or 'update'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const products = ['Rice', 'Wheat', 'Sugar', 'Pulses', 'Kerosene'];

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      const whs = await logistics.getWarehouses();
      setWarehouses(whs);
      if (whs.length > 0) {
        setSelectedWarehouseId(whs[0].id.toString());
      }
    } catch (err) {
      console.error('Error loading warehouses:', err);
    }
  };

  useEffect(() => {
    if (selectedWarehouseId) {
      fetchWarehouseStock();
    }
  }, [selectedWarehouseId]);

  const fetchWarehouseStock = async () => {
    try {
      setLoading(true);
      setError('');
      const stockData = await inventory.getWarehouseStock(selectedWarehouseId);
      const historyData = await inventory.getHistory(selectedWarehouseId);
      setStock(stockData);
      setHistory(historyData);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load stock details.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    if (!selectedWarehouseId || !productName || !quantity) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setSuccess('');

    try {
      const response = await inventory.updateStock({
        warehouse_id: parseInt(selectedWarehouseId),
        product_name: productName,
        quantity: parseFloat(quantity),
        change_type: changeType
      });
      setSuccess(response.message);
      setQuantity('');
      fetchWarehouseStock();
    } catch (err) {
      console.error('Update stock error:', err);
      setError(err.response?.data?.message || 'Error updating stock levels.');
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-title">
          <h2>Inventory Auditing & Stock Logs</h2>
          <p>Deduct stock, register shipments, and audit grain balances</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }} className="dashboard-grid">
        {/* Left column: Select and update */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 className="section-title"><Package size={20} /> Selection</h3>
            <div className="form-group">
              <label>Select Warehouse</label>
              <select 
                className="form-control"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>{wh.warehouse_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Adjust Inventory Stock</h3>
            {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
            {success && <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginBottom: '1rem' }}>{success}</div>}
            
            <form onSubmit={handleUpdateStock}>
              <div className="form-group">
                <label>Commodity Item</label>
                <select 
                  className="form-control"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Adjustment Type</label>
                <select 
                  className="form-control"
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                >
                  <option value="add">Add/Restock Stock (+)</option>
                  <option value="update">Overwrite Stock Level (=)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Quantity (kg or Liters)</label>
                <input 
                  type="number"
                  className="form-control"
                  placeholder="e.g. 1500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.1"
                  step="0.1"
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                Apply Stock Update
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Current Stock Meter & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="section-title" style={{ marginBottom: 0 }}><Package size={20} /> Stock Levels</h3>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={fetchWarehouseStock}>
                <RefreshCw size={12} />
                <span>Refresh</span>
              </button>
            </div>
            {loading ? (
              <div className="loading-spinner"></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {stock.map((item) => (
                  <div key={item.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.product_name}</span>
                    <p style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '0.25rem 0' }}>
                      {parseFloat(item.quantity).toLocaleString()} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>kg/L</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="section-title"><History size={20} /> Stock History Audit Log</h3>
            <div className="table-container" style={{ maxHeight: '350px' }}>
              {history.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center' }}>No log entries found for this warehouse.</p>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Change</th>
                      <th>Quantity Changed</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((log) => {
                      const isAddition = parseFloat(log.quantity_changed) >= 0;
                      return (
                        <tr key={log.id}>
                          <td>{new Date(log.created_at).toLocaleString()}</td>
                          <td>{log.product_name}</td>
                          <td>
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.25rem',
                              color: log.change_type === 'dispatch' ? 'var(--danger)' : 'var(--success)',
                              fontWeight: '600',
                              fontSize: '0.8rem'
                            }}>
                              {log.change_type === 'dispatch' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                              {log.change_type.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ color: isAddition ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                            {isAddition ? '+' : ''}{parseFloat(log.quantity_changed).toLocaleString()}
                          </td>
                          <td>{parseFloat(log.remaining_quantity).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
