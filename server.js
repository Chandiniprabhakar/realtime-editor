const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Action');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve React frontend from build
// app.use(express.static('build'));
// app.use((req, res, next) => {
//     res.sendFile(path.join(__dirname, 'build', 'index.html'));
// });

// Map to track username by socket ID
const userSocketMap = {};

// Get all connected clients in a room
function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        socketId => ({
            socketId,
            username: userSocketMap[socketId],
        })
    );
}

io.on('connection', socket => {
    console.log('🔌 Socket connected:', socket.id);

    // Handle joining a room
    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);

        const clients = getAllConnectedClients(roomId);
        console.log(`${username} joined room ${roomId}`);

        io.in(roomId).emit(ACTIONS.JOINED, {
            clients,
            username,
            socketId: socket.id,
        });
    });

    // Handle code change
    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // Sync code with newly joined client
    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // Handle disconnection
    socket.on('disconnecting', () => {
    const rooms = [...socket.rooms];

    rooms.forEach(roomId => {
        socket.to(roomId).emit(ACTIONS.DISCONNECTED, {
            socketId: socket.id,
            username: userSocketMap[socket.id],
        });
    });

    delete userSocketMap[socket.id];
});

});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
