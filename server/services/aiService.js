require('dotenv').config();

const predictAnomaly = async (features) => {
  const { route_deviation_km, stop_duration_hrs, delay_hours, quantity_mismatch_pct } = features;
  
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
  
  try {
    const response = await fetch(`${aiServiceUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route_deviation_km,
        stop_duration_hrs,
        delay_hours,
        quantity_mismatch_pct
      }),
    });

    if (!response.ok) {
      console.error(`AI Service error. Status: ${response.status}`);
      return null;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to connect to AI Anomaly Detection service:', error.message);
    return null;
  }
};

module.exports = {
  predictAnomaly
};
