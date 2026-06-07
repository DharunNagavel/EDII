const db = require('../models/db');
const socketService = require('../services/socketService');
const aiService = require('../services/aiService');

// Haversine formula to compute distance between two coordinates in kilometers
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Perpendicular distance from point P to line segment AB (Warehouse -> FPS) in kilometers
function getRouteDeviation(latP, lonP, latA, lonA, latB, lonB) {
  // Use vector projection (approximated for small degrees)
  const xP = lonP;
  const yP = latP;
  const xA = lonA;
  const yA = lonA; // Wait, yA should be latA! Let's correct this.
  
  const dx = lonB - lonA;
  const dy = latB - latA;
  
  if (dx === 0 && dy === 0) {
    return haversineDistance(latP, lonP, latA, lonA);
  }
  
  // Projection factor t
  let t = ((lonP - lonA) * dx + (latP - latA) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t)); // Clamp projection to the line segment
  
  // Closest point coordinates on segment
  const closestLat = latA + t * dy;
  const closestLon = lonA + t * dx;
  
  return haversineDistance(latP, lonP, closestLat, closestLon);
}

exports.postLocationUpdate = async (req, res) => {
  const { shipment_id, latitude, longitude, speed, simulated_stop_hrs, simulated_delay_hrs } = req.body;

  if (!shipment_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: 'shipment_id, latitude, and longitude are required.' });
  }

  try {
    // 1. Insert tracking log
    const logRes = await db.query(
      'INSERT INTO tracking_logs (shipment_id, latitude, longitude, speed) VALUES ($1, $2, $3, $4) RETURNING *',
      [shipment_id, latitude, longitude, speed || 0]
    );
    const trackingLog = logRes.rows[0];

    // 2. Fetch shipment details along with warehouse and FPS coordinates
    const shipmentRes = await db.query(
      `SELECT s.*, 
              w.location_lat as w_lat, w.location_lng as w_lng, w.warehouse_name,
              fps.location_lat as fps_lat, fps.location_lng as fps_lng, fps.shop_name
       FROM shipments s
       JOIN warehouses w ON s.warehouse_id = w.id
       JOIN fair_price_shops fps ON s.fps_id = fps.id
       WHERE s.id = $1`,
      [shipment_id]
    );

    if (shipmentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Shipment not found.' });
    }

    const shipment = shipmentRes.rows[0];

    if (shipment.status !== 'in_transit' && shipment.status !== 'delayed' && shipment.status !== 'pending') {
      return res.json({ message: 'Location recorded. Shipment is not in transit.', trackingLog });
    }

    // 3. Compute Telemetry metrics
    const wLat = parseFloat(shipment.w_lat);
    const wLng = parseFloat(shipment.w_lng);
    const fpsLat = parseFloat(shipment.fps_lat);
    const fpsLng = parseFloat(shipment.fps_lng);
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Route deviation in km
    const deviation = getRouteDeviation(lat, lng, wLat, wLng, fpsLat, fpsLng);

    // Stop duration (support simulated value or compute from logs)
    let stopDuration = parseFloat(simulated_stop_hrs) || 0.0;
    if (stopDuration === 0 && (speed === 0 || parseFloat(speed) === 0)) {
      // Look back at logs to see how long speed has been 0
      const lastLogs = await db.query(
        'SELECT speed, timestamp FROM tracking_logs WHERE shipment_id = $1 ORDER BY timestamp DESC LIMIT 5',
        [shipment_id]
      );
      if (lastLogs.rows.length >= 2) {
        let stopStart = null;
        for (const log of lastLogs.rows) {
          if (parseFloat(log.speed) === 0) {
            stopStart = log.timestamp;
          } else {
            break;
          }
        }
        if (stopStart) {
          const diffMs = new Date() - new Date(stopStart);
          stopDuration = diffMs / 3600000; // to hours
        }
      }
    }

    // Delay hours (support simulated value or calculate against expected_delivery)
    let delayHours = parseFloat(simulated_delay_hrs) || 0.0;
    const now = new Date();
    const expected = new Date(shipment.expected_delivery);
    if (now > expected && delayHours === 0) {
      delayHours = (now - expected) / 3600000; // in hours
    }

    // 4. Run AI Anomaly Detection
    const features = {
      route_deviation_km: deviation,
      stop_duration_hrs: stopDuration,
      delay_hours: delayHours,
      quantity_mismatch_pct: 0.0 // Delivery is in transit, no mismatch recorded yet
    };

    const aiResult = await aiService.predictAnomaly(features);
    
    // Fallback logic if AI service is not running
    const isAnomaly = aiResult ? aiResult.is_anomaly : (deviation > 1.5 || stopDuration > 1.0 || delayHours > 2.0);
    const riskScore = aiResult ? aiResult.risk_score : 0.5;
    const severity = aiResult ? aiResult.severity : (deviation > 3.0 ? 'high' : 'medium');
    const recommendedAction = aiResult ? aiResult.recommended_action : 'Investigate vehicle status.';

    let alertRecord = null;

    if (isAnomaly) {
      // Check if we already have an active alert of this type for this shipment
      // To prevent duplicate records within the same 5 minutes
      let alertType = 'route_deviation';
      let details = `Route deviation of ${deviation.toFixed(2)} km detected.`;
      
      if (stopDuration > 1.0) {
        alertType = 'long_stop';
        details = `Vehicle stopped for ${stopDuration.toFixed(1)} hours.`;
      } else if (delayHours > 2.0) {
        alertType = 'delay';
        details = `Delivery delay is ${delayHours.toFixed(1)} hours past expected time.`;
      }

      const recentAlertRes = await db.query(
        "SELECT id FROM alerts WHERE shipment_id = $1 AND alert_type = $2 AND created_at > NOW() - INTERVAL '5 minutes'",
        [shipment_id, alertType]
      );

      if (recentAlertRes.rows.length === 0) {
        const insertAlert = await db.query(
          `INSERT INTO alerts (shipment_id, alert_type, severity, details, risk_score) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [shipment_id, alertType, severity, `${details} Action: ${recommendedAction}`, riskScore]
        );
        alertRecord = insertAlert.rows[0];

        // Emit real-time alert via Socket.IO
        socketService.emitAlert(alertRecord);

        // Also if delay is detected, auto-update status to 'delayed'
        if (alertType === 'delay' && shipment.status !== 'delayed') {
          await db.query("UPDATE shipments SET status = 'delayed' WHERE id = $1", [shipment_id]);
        }
      }
    }

    // 5. Emit real-time location update to clients via Socket.IO
    const updatePayload = {
      shipmentId: shipment_id,
      latitude: lat,
      longitude: lng,
      speed: speed || 0,
      timestamp: trackingLog.timestamp,
      deviation,
      stopDuration,
      delayHours,
      alert: alertRecord
    };
    
    // Broadcast via global socket
    const io = socketService.getIO();
    io.to(`shipment-${shipment_id}`).emit('location-broadcast', updatePayload);
    io.emit('global-location-update', updatePayload);

    res.json({
      message: 'Location recorded successfully.',
      telemetry: {
        deviation_km: parseFloat(deviation.toFixed(3)),
        stop_duration_hrs: parseFloat(stopDuration.toFixed(2)),
        delay_hours: parseFloat(delayHours.toFixed(2)),
        is_anomaly: isAnomaly,
        risk_score: riskScore,
        severity
      },
      alert: alertRecord,
      trackingLog
    });
  } catch (error) {
    console.error('Post location update error:', error);
    res.status(500).json({ message: 'Server error updating GPS location.' });
  }
};
