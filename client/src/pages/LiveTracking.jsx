import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import { MapPin, Navigation, Compass, ShieldAlert, Zap } from 'lucide-react';
import { shipments, gps } from '../services/api';

// Setup divIcons to avoid missing leaflet marker assets compile error
const warehouseIcon = L.divIcon({
  className: 'custom-warehouse-icon',
  html: `<div style="background-color: #0ea5e9; width: 16px; height: 16px; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #0ea5e9;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const fpsIcon = L.divIcon({
  className: 'custom-fps-icon',
  html: `<div style="background-color: #10b981; width: 16px; height: 16px; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #10b981;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const truckIcon = L.divIcon({
  className: 'custom-truck-icon',
  html: `<div style="background-color: #fbbf24; width: 20px; height: 20px; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 12px #fbbf24; transform-origin: center;"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Component to programmatically re-center the map when coords update
const ChangeMapView = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

const LiveTracking = () => {
  const [searchParams] = useSearchParams();
  const targetShipmentId = searchParams.get('shipment');

  const [user, setUser] = useState(null);
  const [activeShipments, setActiveShipments] = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [shipmentData, setShipmentData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Real-time states
  const [vehicleLocation, setVehicleLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [simulationStep, setSimulationStep] = useState(0);
  const [latestTelemetry, setLatestTelemetry] = useState(null);
  const [alertTriggered, setAlertTriggered] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    fetchActiveShipments();
  }, []);

  useEffect(() => {
    if (activeShipments.length > 0) {
      const initialId = targetShipmentId || activeShipments[0].id.toString();
      setSelectedShipmentId(initialId);
    }
  }, [activeShipments, targetShipmentId]);

  useEffect(() => {
    if (selectedShipmentId) {
      loadShipmentDetails(selectedShipmentId);
    }
  }, [selectedShipmentId]);

  useEffect(() => {
    if (!selectedShipmentId) return;

    // Connect socket to hear coordinates
    const socket = io('http://localhost:5000');
    
    socket.emit('join-shipment', selectedShipmentId);
    console.log(`Joined socket room shipment-${selectedShipmentId}`);

    socket.on('location-broadcast', (data) => {
      console.log('Location broadcast received on Map page:', data);
      setVehicleLocation([data.latitude, data.longitude]);
      setLatestTelemetry({
        deviation_km: data.deviation,
        stop_duration_hrs: data.stopDuration,
        delay_hours: data.delayHours,
        speed: data.speed
      });
      if (data.alert) {
        setAlertTriggered(data.alert);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedShipmentId]);

  const fetchActiveShipments = async () => {
    try {
      setInitialLoading(true);
      const data = await shipments.getShipments();
      // Filter transits
      const transits = data.filter(s => s.status === 'in_transit' || s.status === 'delayed' || s.status === 'pending');
      setActiveShipments(transits);
    } catch (err) {
      console.error('Error fetching shipments for map:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadShipmentDetails = async (id) => {
    try {
      setAlertTriggered(null);
      setSimulationStep(0);
      const data = await shipments.getShipmentById(id);
      setShipmentData(data);

      const wLat = parseFloat(data.shipment.w_lat);
      const wLng = parseFloat(data.shipment.w_lng);
      const fpsLat = parseFloat(data.shipment.fps_lat);
      const fpsLng = parseFloat(data.shipment.fps_lng);

      // Default start vehicle at warehouse or current logs
      if (data.tracking_logs.length > 0) {
        const lastLog = data.tracking_logs[data.tracking_logs.length - 1];
        setVehicleLocation([parseFloat(lastLog.latitude), parseFloat(lastLog.longitude)]);
      } else {
        setVehicleLocation([wLat, wLng]);
      }

      setRouteCoordinates([
        [wLat, wLng],
        [fpsLat, fpsLng]
      ]);
    } catch (err) {
      console.error('Error loading shipment details:', err);
    }
  };

  // --- GPS SIMULATOR TRIGGERS ---
  const sendGPSLocation = async (lat, lng, speed, stopHrs = 0.0, delayHrs = 0.0) => {
    try {
      setVehicleLocation([lat, lng]);
      const res = await gps.postLocation({
        shipment_id: parseInt(selectedShipmentId),
        latitude: lat,
        longitude: lng,
        speed: speed,
        simulated_stop_hrs: stopHrs,
        simulated_delay_hrs: delayHrs
      });
      setLatestTelemetry(res.telemetry);
      if (res.alert) {
        setAlertTriggered(res.alert);
      } else {
        setAlertTriggered(null);
      }
      
      // Auto upgrade pending shipment to in_transit on first movement
      if (shipmentData?.shipment?.status === 'pending') {
        await shipments.updateStatus(selectedShipmentId, 'in_transit');
      }
    } catch (err) {
      console.error('Post location update error:', err);
    }
  };

  const simulateNormalTransit = () => {
    if (!shipmentData) return;
    const wLat = parseFloat(shipmentData.shipment.w_lat);
    const wLng = parseFloat(shipmentData.shipment.w_lng);
    const fpsLat = parseFloat(shipmentData.shipment.fps_lat);
    const fpsLng = parseFloat(shipmentData.shipment.fps_lng);

    // Increment step (from 1 to 5)
    const nextStep = simulationStep === 5 ? 1 : simulationStep + 1;
    setSimulationStep(nextStep);

    // Interpolate coordinate
    const ratio = nextStep / 5.0;
    const currentLat = wLat + (fpsLat - wLat) * ratio;
    const currentLng = wLng + (fpsLng - wLng) * ratio;

    sendGPSLocation(currentLat, currentLng, 45.0, 0.0, 0.0); // 45 km/h normal speed
  };

  const simulateRouteDeviation = () => {
    if (!shipmentData) return;
    const wLat = parseFloat(shipmentData.shipment.w_lat);
    const wLng = parseFloat(shipmentData.shipment.w_lng);
    const fpsLat = parseFloat(shipmentData.shipment.fps_lat);
    const fpsLng = parseFloat(shipmentData.shipment.fps_lng);

    // Add some random offsets of ~0.05 degrees (approx 5.5 km away)
    const ratio = 0.4; // middle of route
    const currentLat = wLat + (fpsLat - wLat) * ratio + 0.035; // Deviated lat
    const currentLng = wLng + (fpsLng - wLng) * ratio - 0.035; // Deviated lng

    sendGPSLocation(currentLat, currentLng, 30.0, 0.0, 0.0);
  };

  const simulateVehicleStop = () => {
    if (!shipmentData || !vehicleLocation) return;
    // Keep vehicle at current spot, set speed to 0 and inject 2.5 hours stop
    sendGPSLocation(vehicleLocation[0], vehicleLocation[1], 0.0, 2.5, 0.0);
  };

  const simulateDeliveryDelay = () => {
    if (!shipmentData || !vehicleLocation) return;
    // Set speed to 10 km/h and inject 3.5 hours delay past ETA
    sendGPSLocation(vehicleLocation[0], vehicleLocation[1], 10.0, 0.0, 3.5);
  };

  const defaultCenter = [13.0827, 80.2707]; // Chennai default center

  if (initialLoading) {
    return <div className="loading-spinner" style={{ marginTop: '5rem' }}></div>;
  }

  if (activeShipments.length === 0) {
    return (
      <div>
        <div className="dashboard-header">
          <div className="header-title">
            <h2>GPS Live Location Tracking</h2>
            <p>Real-time vehicle position map, path deviation audit, and telemetry simulation</p>
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <ShieldAlert size={48} style={{ color: 'var(--warning)', marginBottom: '1.5rem', marginLeft: 'auto', marginRight: 'auto' }} />
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>No Active Shipments in Transit</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 1.5rem auto', fontSize: '0.95rem' }}>
            There are currently no active deliveries in progress (pending, in transit, or delayed) to display on the tracking map.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/shipments" className="btn btn-primary">Go to Shipments Manifest</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-title">
          <h2>GPS Live Location Tracking</h2>
          <p>Real-time vehicle position map, path deviation audit, and telemetry simulation</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Map Container (Left) */}
        <div className="card" style={{ padding: '0.75rem' }}>
          {vehicleLocation ? (
            <div className="map-container">
              <MapContainer 
                center={vehicleLocation || defaultCenter} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Warehouse Marker */}
                {shipmentData && (
                  <Marker position={[parseFloat(shipmentData.shipment.w_lat), parseFloat(shipmentData.shipment.w_lng)]} icon={warehouseIcon}>
                    <Popup>
                      <strong>Warehouse:</strong> {shipmentData.shipment.warehouse_name}
                    </Popup>
                  </Marker>
                )}

                {/* FPS Destination Marker */}
                {shipmentData && (
                  <Marker position={[parseFloat(shipmentData.shipment.fps_lat), parseFloat(shipmentData.shipment.fps_lng)]} icon={fpsIcon}>
                    <Popup>
                      <strong>Fair Price Shop:</strong> {shipmentData.shipment.shop_name}
                    </Popup>
                  </Marker>
                )}

                {/* Live Vehicle Marker */}
                {vehicleLocation && (
                  <Marker position={vehicleLocation} icon={truckIcon}>
                    <Popup>
                      <strong>Transit Vehicle:</strong> {shipmentData?.shipment?.vehicle_number} <br />
                      <strong>Speed:</strong> {latestTelemetry?.speed || 0} km/h
                    </Popup>
                  </Marker>
                )}

                {/* Route Line */}
                {routeCoordinates.length > 0 && (
                  <Polyline 
                    positions={routeCoordinates} 
                    color="rgba(14, 165, 233, 0.3)" 
                    dashArray="5, 5" 
                  />
                )}

                {/* Actual tracking trail */}
                {shipmentData?.tracking_logs?.length > 0 && (
                  <Polyline 
                    positions={shipmentData.tracking_logs.map(log => [parseFloat(log.latitude), parseFloat(log.longitude)])}
                    color="var(--warning)"
                    weight={3}
                  />
                )}

                <ChangeMapView center={vehicleLocation} />
              </MapContainer>
            </div>
          ) : (
            <div style={{ height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="loading-spinner"></div>
            </div>
          )}
        </div>

        {/* Control and Simulation Info Panel (Right) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 className="section-title"><Navigation size={20} /> Active Shipment Selection</h3>
            <div className="form-group">
              <label>Select Shipment Route</label>
              <select 
                className="form-control"
                value={selectedShipmentId}
                onChange={(e) => setSelectedShipmentId(e.target.value)}
              >
                {activeShipments.map(s => (
                  <option key={s.id} value={s.id}>
                    Shipment #{s.id} ({s.product_name} - {s.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Telemetry panel */}
          {latestTelemetry && (
            <div className="card">
              <h3 className="section-title"><Compass size={20} /> Telemetry Dashboard</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Route Deviation</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: latestTelemetry.deviation_km > 1.5 ? 'var(--danger)' : 'var(--success)', marginTop: '0.2rem' }}>
                    {latestTelemetry.deviation_km.toFixed(2)} km
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Stop Duration</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: latestTelemetry.stop_duration_hrs > 1.0 ? 'var(--danger)' : 'var(--success)', marginTop: '0.2rem' }}>
                    {latestTelemetry.stop_duration_hrs.toFixed(1)} hrs
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Delay hours</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: latestTelemetry.delay_hours > 2.0 ? 'var(--danger)' : 'var(--success)', marginTop: '0.2rem' }}>
                    {latestTelemetry.delay_hours.toFixed(1)} hrs
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Speed</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--info)', marginTop: '0.2rem' }}>
                    {latestTelemetry.speed} km/h
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Alerts display */}
          {alertTriggered && (
            <div className="card" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>
                <ShieldAlert size={18} />
                <h4 style={{ fontWeight: 'bold' }}>AI System Alert Detected</h4>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {alertTriggered.details}
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Risk Severity: <strong style={{ color: 'var(--danger)', textTransform: 'uppercase' }}>{alertTriggered.severity}</strong> (Risk Score: {alertTriggered.risk_score})
              </div>
            </div>
          )}

          {/* Telemetry Simulator Buttons (Visible to driver/admin) */}
          {(user?.role === 'driver' || user?.role === 'super_admin') && (
            <div className="card">
              <h3 className="section-title"><Zap size={20} /> GPS Telemetry Simulator</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Manually push GPS coordinate vectors to evaluate route logic, delays, and stationary alerts.
              </p>
              
              <div className="sim-grid">
                <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={simulateNormalTransit}>
                  Normal Step ({simulationStep}/5)
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.85rem', color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)' }} onClick={simulateRouteDeviation}>
                  Simulate Route Deviation
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={simulateVehicleStop}>
                  Simulate stationary Stop
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={simulateDeliveryDelay}>
                  Simulate delivery Delay
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;
