import React, { useEffect, useState, useRef } from 'react';
import { shipments, logistics, inventory } from '../services/api';
import { Truck, Plus, CheckCircle, RefreshCw, Key, ShieldAlert, Award, FileSpreadsheet } from 'lucide-react';

const Shipments = () => {
  const [user, setUser] = useState(null);
  const [shipmentList, setShipmentList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Creation form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedFpsId, setSelectedFpsId] = useState('');
  const [productName, setProductName] = useState('Rice');
  const [quantity, setQuantity] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Detail & Verification state
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [quantityReceived, setQuantityReceived] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState('');

  // Signature state
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const ships = await shipments.getShipments();
      setShipmentList(ships);

      // Load form details if user can create shipments
      const storedUser = localStorage.getItem('user');
      const role = storedUser ? JSON.parse(storedUser).role : '';
      if (role === 'super_admin' || role === 'warehouse_manager') {
        const [whs, vehs, shps] = await Promise.all([
          logistics.getWarehouses(),
          logistics.getVehicles(),
          logistics.getShops()
        ]);
        setWarehouses(whs);
        setVehicles(vehs.filter(v => v.status === 'idle'));
        setShops(shps);

        if (whs.length > 0) setSelectedWarehouseId(whs[0].id.toString());
        if (vehs.filter(v => v.status === 'idle').length > 0) setSelectedVehicleId(vehs.filter(v => v.status === 'idle')[0].id.toString());
        if (shps.length > 0) setSelectedFpsId(shps[0].id.toString());
      }
    } catch (err) {
      console.error('Error fetching initial shipments data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    if (!selectedWarehouseId || !selectedVehicleId || !selectedFpsId || !productName || !quantity || !expectedDelivery) {
      setCreateError('Please fill in all fields.');
      return;
    }
    setCreateError('');
    setCreateSuccess('');

    try {
      await shipments.createShipment({
        warehouse_id: parseInt(selectedWarehouseId),
        vehicle_id: parseInt(selectedVehicleId),
        fps_id: parseInt(selectedFpsId),
        product_name: productName,
        quantity_dispatched: parseFloat(quantity),
        expected_delivery: expectedDelivery
      });
      setCreateSuccess('Shipment dispatched! Stock deducted, vehicle set to transit.');
      setQuantity('');
      setExpectedDelivery('');
      setShowCreateForm(false);
      fetchInitialData();
    } catch (err) {
      console.error('Create shipment error:', err);
      setCreateError(err.response?.data?.message || 'Error dispatching shipment.');
    }
  };

  const handleSelectShipment = async (id) => {
    try {
      setDetailLoading(true);
      setVerificationError('');
      setVerificationSuccess('');
      setOtpCode('');
      
      const data = await shipments.getShipmentById(id);
      setSelectedShipment(data);
      setQuantityReceived(data.shipment.quantity_dispatched.toString());
    } catch (err) {
      console.error('Error loading shipment detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Signature Canvas Drawing Handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Get mouse/touch coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = 'var(--primary)';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    if (!otpCode || !quantityReceived) {
      setVerificationError('OTP and Quantity Received are required.');
      return;
    }
    setVerificationError('');
    setVerificationSuccess('');

    // Capture digital signature image
    let signatureDataUrl = null;
    const canvas = canvasRef.current;
    if (canvas) {
      signatureDataUrl = canvas.toDataURL();
    }

    // Capture photo proof (simulated static base64 image of grain check for hackathon mockup)
    const simulatedPhotoProof = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='green'/><text x='10' y='50' fill='white'>Verified</text></svg>";

    try {
      const dispQty = parseFloat(selectedShipment.shipment.quantity_dispatched);
      const recvQty = parseFloat(quantityReceived);
      const shortage = Math.max(0, dispQty - recvQty);

      await shipments.confirmDelivery(selectedShipment.shipment.id, {
        otp_code: otpCode,
        quantity_received: recvQty,
        shortage_reported: shortage,
        digital_signature: signatureDataUrl,
        delivery_proof_image: simulatedPhotoProof
      });

      setVerificationSuccess('Delivery verified and received successfully! Stock adjusted.');
      setSelectedShipment(null);
      fetchInitialData();
    } catch (err) {
      console.error('Verification error:', err);
      setVerificationError(err.response?.data?.message || 'Verification failed. Please check the OTP.');
    }
  };

  // Helper to trigger driver state changes (transit simulation)
  const handleUpdateStatus = async (id, status) => {
    try {
      await shipments.updateStatus(id, status);
      fetchInitialData();
      if (selectedShipment && selectedShipment.shipment.id === id) {
        handleSelectShipment(id);
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-title">
          <h2>PDS Shipments</h2>
          <p>Dispatched food grain shipments, tracking details, and delivery confirmations</p>
        </div>
        
        {(user?.role === 'super_admin' || user?.role === 'warehouse_manager') && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <Plus size={16} />
            <span>Create Dispatch Shipment</span>
          </button>
        )}
      </div>

      {createSuccess && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--success)', padding: '0.75rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          {createSuccess}
        </div>
      )}

      {/* Creation form */}
      {showCreateForm && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 className="section-title">New Dispatch Manifest</h3>
          {createError && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{createError}</div>}
          <form onSubmit={handleCreateShipment} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Source Warehouse</label>
              <select className="form-control" value={selectedWarehouseId} onChange={(e) => setSelectedWarehouseId(e.target.value)}>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Transport Vehicle & Driver (Idle)</label>
              <select className="form-control" value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)}>
                {vehicles.length === 0 ? (
                  <option value="">No idle vehicles available</option>
                ) : (
                  vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} - {v.driver_name || 'No driver'}</option>)
                )}
              </select>
            </div>

            <div className="form-group">
              <label>Destination Annanagar Shop (FPS)</label>
              <select className="form-control" value={selectedFpsId} onChange={(e) => setSelectedFpsId(e.target.value)}>
                {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name} ({s.owner_name})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Commodity Item</label>
              <select className="form-control" value={productName} onChange={(e) => setProductName(e.target.value)}>
                <option value="Rice">Rice</option>
                <option value="Wheat">Wheat</option>
                <option value="Sugar">Sugar</option>
                <option value="Pulses">Pulses</option>
                <option value="Kerosene">Kerosene</option>
              </select>
            </div>

            <div className="form-group">
              <label>Quantity to Dispatch (kg or L)</label>
              <input 
                type="number" 
                className="form-control" 
                placeholder="e.g. 1500" 
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0.1" 
                required
              />
            </div>

            <div className="form-group">
              <label>Expected Delivery Date & Time</label>
              <input 
                type="datetime-local" 
                className="form-control" 
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={vehicles.length === 0}>Dispatch Shipment</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Shipments List and Selection Details */}
      <div className="dashboard-grid">
        {/* Left Column: Shipment List */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}><Truck size={20} /> Shipment manifests</h3>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={fetchInitialData}>
              <RefreshCw size={12} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="table-container">
            {shipmentList.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>No shipments found.</p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Product</th>
                    <th>Qty (kg)</th>
                    <th>Destination</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shipmentList.map((s) => (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => handleSelectShipment(s.id)}>
                      <td>#{s.id}</td>
                      <td><strong>{s.product_name}</strong></td>
                      <td>{s.quantity_dispatched}</td>
                      <td>{s.shop_name.substring(0, 15)}...</td>
                      <td>
                        <span className={`status-badge ${s.status}`}>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Shipment Verification & Audit details */}
        <div>
          {detailLoading ? (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
              <div className="loading-spinner"></div>
            </div>
          ) : selectedShipment ? (
            <div className="card">
              <h3 className="section-title">Shipment #{selectedShipment.shipment.id} Details</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                  <span className={`status-badge ${selectedShipment.shipment.status}`}>{selectedShipment.shipment.status}</span>
                </div>
                <div><strong>Product:</strong> {selectedShipment.shipment.product_name}</div>
                <div><strong>Dispatched Quantity:</strong> {selectedShipment.shipment.quantity_dispatched} kg/L</div>
                
                {selectedShipment.shipment.status === 'delivered' && (
                  <>
                    <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                      <strong>Received Quantity:</strong> {selectedShipment.shipment.quantity_received} kg/L
                    </div>
                    {selectedShipment.shipment.shortage_reported > 0 && (
                      <div style={{ color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ShieldAlert size={16} />
                        <span><strong>Shortage/Loss:</strong> {selectedShipment.shipment.shortage_reported} kg/L</span>
                      </div>
                    )}
                  </>
                )}

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                  <strong>Source:</strong> {selectedShipment.shipment.warehouse_name}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedShipment.shipment.warehouse_address}</div>
                </div>

                <div>
                  <strong>Destination:</strong> {selectedShipment.shipment.shop_name}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedShipment.shipment.fps_address}</div>
                </div>

                <div><strong>Driver/Vehicle:</strong> {selectedShipment.shipment.driver_name || 'N/A'} ({selectedShipment.shipment.vehicle_number})</div>
                
                {user?.role === 'super_admin' && (
                  <div style={{ background: 'var(--primary-glow)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <Key size={16} style={{ color: 'var(--primary)' }} />
                    <span><strong>System OTP:</strong> {selectedShipment.shipment.otp_code} (Govt reference)</span>
                  </div>
                )}
              </div>

              {/* Status Update Options for Drivers */}
              {user?.role === 'driver' && selectedShipment.shipment.status === 'pending' && (
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginBottom: '1rem' }}
                  onClick={() => handleUpdateStatus(selectedShipment.shipment.id, 'in_transit')}
                >
                  Start Delivery Route
                </button>
              )}

              {/* Delivery Receipt Form (Visible for FPS Owner, when shipment is in transit or delayed) */}
              {user?.role === 'fps_owner' && 
               (selectedShipment.shipment.status === 'in_transit' || selectedShipment.shipment.status === 'delayed' || selectedShipment.shipment.status === 'pending') && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <h4 style={{ marginBottom: '1rem', fontWeight: 'bold' }}>Verify Receipt & Confirm Delivery</h4>
                  {verificationError && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{verificationError}</div>}
                  
                  <form onSubmit={handleConfirmDelivery}>
                    <div className="form-group">
                      <label>Quantity Actually Received (kg/L)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={quantityReceived}
                        onChange={(e) => setQuantityReceived(e.target.value)}
                        max={selectedShipment.shipment.quantity_dispatched}
                        step="0.1"
                        required
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Shortage: {Math.max(0, parseFloat(selectedShipment.shipment.quantity_dispatched) - (parseFloat(quantityReceived) || 0)).toFixed(1)} kg/L
                      </span>
                    </div>

                    <div className="form-group">
                      <label>Enter OTP Code (From Driver SMS/WhatsApp)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="6-digit OTP code" 
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>FPS Owner Digital Signature</label>
                      <div className="canvas-container">
                        <canvas
                          ref={canvasRef}
                          className="sig-canvas"
                          width={300}
                          height={150}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                      </div>
                      <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'fit-content' }} onClick={clearSignature}>
                        Clear Signature
                      </button>
                    </div>

                    <div className="form-group">
                      <label>Grain Quality Photo Proof (Mock)</label>
                      <div style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        ✓ Camera device verified. Simulated crop inspection photo will be auto-attached.
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                      Verify OTP & Confirm Delivery
                    </button>
                  </form>
                </div>
              )}

              {/* Delivery Receipt Visual Details for Admin after delivery */}
              {selectedShipment.shipment.status === 'delivered' && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontWeight: 'bold' }}>Delivery Verification Records</h4>
                  
                  {selectedShipment.shipment.digital_signature ? (
                    <div className="form-group">
                      <label>FPS Owner Digital Signature</label>
                      <img 
                        src={selectedShipment.shipment.digital_signature} 
                        alt="Digital Signature" 
                        style={{ border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', maxWidth: '200px', display: 'block' }}
                      />
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No signature recorded.</p>
                  )}

                  {selectedShipment.shipment.delivery_proof_image && (
                    <div className="form-group" style={{ marginTop: '0.5rem' }}>
                      <label>Verification Proof Image</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--success)' }}>
                        <Award size={16} />
                        <span>Mock Geo-Verified Photo Uploaded</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Click on a shipment from the manifest list to load transaction audits and confirmation forms.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Shipments;
