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
    console.log(`User connected: ${socket.id}`);

    socket.on('join_room', (data) => {
        const { room, userName } = data;
        socket.join(room);
        if (!rooms[room]) rooms[room] = [];
        rooms[room].push({ id: socket.id, name: userName });
        console.log(`${userName} (${socket.id}) joined room: ${room}`);

        // --- 1. ADD THIS ---
        // Send the updated user list to everyone in the room
        const userNames = rooms[room].map(user => user.name);
        io.to(room).emit('update_users', userNames);
    });

    socket.on('draw', (data) => {
        console.log(`Draw event received for room: ${data.room}`);
        socket.to(data.room).emit('draw', data);
    });

    socket.on('clear', (data) => {
        socket.to(data.room).emit('clear');
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const room in rooms) {
            const userIndex = rooms[room].findIndex(user => user.id === socket.id);
            if (userIndex !== -1) {
                rooms[room].splice(userIndex, 1);
                
                // --- 2. ADD THIS ---
                // Send the updated list after a user leaves
                const userNames = rooms[room].map(user => user.name);
                io.to(room).emit('update_users', userNames);

                if (rooms[room].length === 0) {
                    delete rooms[room];
                }
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`TwinCanvas server running on http://localhost:${PORT}`);
});
