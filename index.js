const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = []; 
let adminSocketId = null;

io.on('connection', (socket) => {
    // 1. Initial status check for the app
    socket.emit('status_update', { admin_present: !!adminSocketId });

    // 2. Admin Claim
    socket.on('claim_admin', (data) => {
        if (!adminSocketId && data.key === process.env.ADMIN_SECRET_KEY) {
            adminSocketId = socket.id;
            socket.emit('role_assigned', { role: 'MASTER' });
            io.emit('status_update', { admin_present: true });
            console.log("Admin claimed the hub.");
        }
    });

    // 3. User Registration (Viewer/Ghost)
    socket.on('register_user', (data) => {
        users.push({ id: socket.id, name: data.name, role: data.role });
        io.emit('update_list', users);
        console.log(`User engaged: ${data.name} as ${data.role}`);
    });

    // 4. Admin Kick Logic
    socket.on('admin_kick_user', (targetId) => {
        if (socket.id === adminSocketId) {
            io.to(targetId).emit('forced_disconnect', { reason: 'MASTER TERMINATED SESSION' });
            console.log(`User ${targetId} terminated by Admin`);
        }
    });

    socket.on('disconnect', () => {
        if (socket.id === adminSocketId) {
            adminSocketId = null;
            io.emit('status_update', { admin_present: false });
        }
        users = users.filter(u => u.id !== socket.id);
        io.emit('update_list', users);
        console.log("User disconnected.");
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`JoyJet Hub active on port ${PORT}`));
