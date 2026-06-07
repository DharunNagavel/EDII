let io;

const init = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    // Join tracking channel for specific shipment
    socket.on('join-shipment', (shipmentId) => {
      socket.join(`shipment-${shipmentId}`);
      console.log(`Socket ${socket.id} joined shipment-${shipmentId}`);
    });

    // Driver location update handler
    socket.on('driver-location-update', (data) => {
      // data: { shipmentId, latitude, longitude, speed }
      const { shipmentId, latitude, longitude, speed } = data;
      console.log(`GPS update from driver for shipment ${shipmentId}: ${latitude}, ${longitude}`);
      
      // Broadcast to anyone listening to this shipment
      io.to(`shipment-${shipmentId}`).emit('location-broadcast', data);
      
      // Also broadcast to general map view
      io.emit('global-location-update', data);
    });

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

const emitAlert = (alert) => {
  if (io) {
    io.emit('alert-notification', alert);
  }
};

const emitShipmentUpdate = (shipment) => {
  if (io) {
    io.emit('shipment-status-update', shipment);
  }
};

module.exports = {
  init,
  getIO,
  emitAlert,
  emitShipmentUpdate
};
