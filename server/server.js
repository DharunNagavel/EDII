const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
require('dotenv').config();

const db = require('./models/db');
const seedDatabase = require('./models/seed');
const socketService = require('./services/socketService');

// Express App setup
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
socketService.init(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic routes
const authRoutes = require('./routes/authRoutes');
const fpsRoutes = require('./routes/fpsRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const gpsRoutes = require('./routes/gpsRoutes');
const alertRoutes = require('./routes/alertRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');

// API mappings
app.use('/api/auth', authRoutes);
app.use('/api/logistics', fpsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to RationX PDS Supply Chain API.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({ message: 'Internal server error occurred.' });
});

// Seed database and start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Run DB seeder if table is empty
    await seedDatabase();
    
    server.listen(PORT, () => {
      console.log(`Express Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
};

startServer();
