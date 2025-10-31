const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new socketIo.Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const rooms = {};

io.on('connection', (socket) => {
    // ... (join_room and voice chat logic is the same) ...

    socket.on('draw', (data) => {
        console.log(`Draw event received for room: ${data.room}`);
        socket.to(data.room).emit('draw', data);
    });

    socket.on('clear', (data) => {
        socket.to(data.room).emit('clear');
    });

    // --- ADDED THIS UNDO HANDLER ---
    socket.on('undo', (data) => {
        socket.to(data.room).emit('undo', { state: data.state });
    });
    // --- END OF ADDITION ---

    socket.on('disconnect', () => {
        // ... (disconnect logic is the same) ...
    });
});

server.listen(PORT, () => {
    console.log(`TwinCanvas server running on http://localhost:${PORT}`);
});
