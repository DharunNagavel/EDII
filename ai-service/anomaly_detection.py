# RationX AI Anomaly Detection Microservice
import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

app = FastAPI(
    title="RationX Anomaly Detection API",
    description="Isolation Forest-based anomaly detection for PDS shipments",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"]
)

# Model container
model = None
feature_min = None
feature_max = None

# Feature structure: [route_deviation_km, stop_duration_hrs, delay_hours, quantity_mismatch_pct]
def generate_synthetic_data():
    """
    Generates synthetic training data representing normal and anomalous shipment deliveries.
    """
    np.random.seed(42)
    n_normal = 300
    n_anomaly = 30
    
    # 1. Normal Deliveries
    # - Deviation: 0 to 0.3 km
    # - Stop duration: 0 to 0.4 hrs (24 mins)
    # - Delay: -3 to 1 hour (early or slightly late)
    # - Mismatch: 0 to 0.01 (very small error or 0)
    normal_deviation = np.random.uniform(0.0, 0.3, n_normal)
    normal_stop = np.random.uniform(0.0, 0.4, n_normal)
    normal_delay = np.random.uniform(-3.0, 1.0, n_normal)
    normal_mismatch = np.random.uniform(0.0, 0.01, n_normal)
    
    normal_data = np.column_stack((normal_deviation, normal_stop, normal_delay, normal_mismatch))
    
    # 2. Anomalous Deliveries (varied anomalies)
    # Group A: Route Deviations
    dev_deviation = np.random.uniform(2.0, 10.0, 10)
    dev_stop = np.random.uniform(0.0, 0.5, 10)
    dev_delay = np.random.uniform(-1.0, 2.0, 10)
    dev_mismatch = np.zeros(10)
    
    # Group B: Prolonged Stops (e.g. theft/pilferage risk)
    stop_deviation = np.random.uniform(0.0, 0.4, 10)
    stop_stop = np.random.uniform(2.0, 6.0, 10)
    stop_delay = np.random.uniform(2.0, 5.0, 10)
    stop_mismatch = np.random.uniform(0.02, 0.1, 10)
    
    # Group C: Major Delays / Theft (quantity mismatch)
    mismatch_deviation = np.random.uniform(0.5, 3.0, 10)
    mismatch_stop = np.random.uniform(0.5, 2.0, 10)
    mismatch_delay = np.random.uniform(4.0, 12.0, 10)
    mismatch_mismatch = np.random.uniform(0.08, 0.25, 10)
    
    anomaly_data = np.vstack((
        np.column_stack((dev_deviation, dev_stop, dev_delay, dev_mismatch)),
        np.column_stack((stop_deviation, stop_stop, stop_delay, stop_mismatch)),
        np.column_stack((mismatch_deviation, mismatch_stop, mismatch_delay, mismatch_mismatch))
    ))
    
    # Combine datasets
    X = np.vstack((normal_data, anomaly_data))
    return X

def train_anomaly_model():
    """
    Trains the Isolation Forest model on synthetic data.
    """
    global model, feature_min, feature_max
    X = generate_synthetic_data()
    
    # Normalize limits for risk score calculation later
    feature_min = X.min(axis=0)
    feature_max = X.max(axis=0)
    
    # Fit isolation forest
    # contamination represents the expected proportion of outliers in the dataset (approx 30/330 = 9%)
    model = IsolationForest(contamination=0.09, random_state=42)
    model.fit(X)
    print("AI Model trained successfully on startup.")

# Initialize and train model
train_anomaly_model()

class PredictionRequest(BaseModel):
    route_deviation_km: float
    stop_duration_hrs: float
    delay_hours: float
    quantity_mismatch_pct: float

class PredictionResponse(BaseModel):
    is_anomaly: bool
    risk_score: float
    severity: str
    recommended_action: str

@app.get("/health")
def health():
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="AI Model not initialized.")
    
    # Extract features
    features = np.array([[
        payload.route_deviation_km,
        payload.stop_duration_hrs,
        payload.delay_hours,
        payload.quantity_mismatch_pct
    ]])
    
    # Isolation Forest outputs: 1 for inliers (normal), -1 for outliers (anomalous)
    prediction = model.predict(features)
    is_anomaly_iforest = bool(prediction[0] == -1)
    
    # Get distance from decision boundary (negative score means more anomalous)
    decision_score = float(model.decision_function(features)[0])
    
    # Compute a normalized risk score from 0.0 to 1.0 based on decision score and thresholds
    # Decision score normally ranges from about -0.5 (very anomalous) to +0.5 (very normal)
    # Map decision score: lower decision score -> higher risk score
    # Formula: clamp((0.15 - decision_score) / 0.35, 0.0, 1.0)
    base_risk = np.clip((0.15 - decision_score) / 0.35, 0.0, 1.0)
    
    # Custom rule checks to reinforce triggers
    rule_risk = 0.0
    reasons = []
    
    if payload.route_deviation_km > 1.5:
        rule_risk = max(rule_risk, 0.7)
        reasons.append("Route deviation exceeded 1.5 km")
    if payload.stop_duration_hrs > 1.0:
        rule_risk = max(rule_risk, 0.6)
        reasons.append(f"Vehicle stationary for {payload.stop_duration_hrs:.1f} hours")
    if payload.delay_hours > 3.0:
        rule_risk = max(rule_risk, 0.65)
        reasons.append(f"Delivery delay exceeded 3.0 hours")
    if payload.quantity_mismatch_pct > 0.03:
        rule_risk = max(rule_risk, 0.8)
        reasons.append(f"Quantity mismatch of {payload.quantity_mismatch_pct * 100:.1f}% detected")
        
    # Combine model prediction and rules
    risk_score = float(max(base_risk, rule_risk))
    
    # Determine anomaly flag and severity
    is_anomaly = is_anomaly_iforest or (risk_score >= 0.5)
    
    if risk_score >= 0.75:
        severity = "high"
    elif risk_score >= 0.45:
        severity = "medium"
    else:
        severity = "low"
        
    # Decide recommended actions
    if severity == "high":
        if payload.quantity_mismatch_pct > 0.03:
            recommended_action = "ALERT: Suspend FPS receipt. Audit stock levels at dispatch and arrival. Report pilferage."
        elif payload.route_deviation_km > 1.5:
            recommended_action = "CRITICAL: Dispatch police check or contact driver immediately. Route deviation high."
        else:
            recommended_action = "CRITICAL: Contact driver and check GPS signal health immediately."
    elif severity == "medium":
        if payload.stop_duration_hrs > 1.0:
            recommended_action = "WARNING: Check driver status. Verify vehicle stoppage justification (breakdown, traffic)."
        elif payload.delay_hours > 1.5:
            recommended_action = "WARNING: Notify FPS owner of delayed delivery. Update ETA."
        else:
            recommended_action = "WARNING: Monitor GPS logs. Anomaly detected under moderate risk."
    else:
        recommended_action = "No action required. Transit is within normal parameters."
        
    return PredictionResponse(
        is_anomaly=is_anomaly,
        risk_score=round(risk_score, 2),
        severity=severity,
        recommended_action=recommended_action
    )

if __name__ == "__main__":
    uvicorn.run("anomaly_detection.py", host="0.0.0.0", port=8000, reload=True)
