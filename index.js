const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    pingTimeout: 60000 
});

let state = { adminId: null, viewers: new Set(), ghosts: {} };

io.on('connection', (socket) => {
    socket.emit('status_update', { admin_present: !!state.adminId });

    socket.on('claim_admin', (data) => {
        if (!state.adminId) {
            state.adminId = socket.id;
            socket.emit('role_assigned', { role: 'MASTER' });
            io.emit('status_update', { admin_present: true });
        } else {
            socket.emit('forced_disconnect', { reason: "Hub Occupied" });
        }
    });

    socket.on('register_user', ({ name, role, netType }) => {
        if (role === 'VIEWER') {
            if (state.viewers.size >= 3) return socket.emit('forced_disconnect', { reason: "Slots Full" });
            state.viewers.add(socket.id);
        }
        if (role === 'GHOST') state.ghosts[socket.id] = { name, netType };
        socket.emit('role_assigned', { role });
    });

    socket.on('screen_frame', (frame) => socket.volatile.broadcast.emit('stream', frame));
    
    socket.on('admin_command', (cmd) => {
        socket.broadcast.emit('admin_command', cmd);
        if (cmd === 'START_LIVE') {
            // Cellular Governor: Force ECO after 5 mins
            setTimeout(() => io.emit('admin_command', 'START_ECO'), 300000);
        }
    });

    socket.on('disconnect', () => {
        if (socket.id === state.adminId) {
            state.adminId = null;
            io.emit('status_update', { admin_present: false });
        }
        state.viewers.delete(socket.id);
        delete state.ghosts[socket.id];
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
