// server.js
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

    // Voice users list
    const existingVoiceUsers = rooms[room]
      .filter(user => user.voiceReady)
      .map(user => user.id);
    socket.emit('existing-voice-users', existingVoiceUsers);

    rooms[room].push({ id: socket.id, name: userName, voiceReady: false });
    console.log(`${userName} (${socket.id}) joined room: ${room}`);

    const userNames = rooms[room].map(user => user.name);
    io.to(room).emit('update_users', userNames);
  });

  // ✅ ✅ ✅ MIC FEATURE (added safely)
  socket.on('ready-for-voice', ({ room }) => {
    const user = rooms[room]?.find(u => u.id === socket.id);
    if (user) user.voiceReady = true;
    socket.to(room).emit('user-joined-voice', { socketId: socket.id });
  });

  socket.on('voice-offer', ({ room, to, offer }) => {
    io.to(to).emit('voice-offer', { from: socket.id, offer });
  });

  socket.on('voice-answer', ({ room, to, answer }) => {
    io.to(to).emit('voice-answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ room, to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });
  // ✅ MIC FEATURE ENDS HERE

  // ✅ ✅ ✅ MOVIE SYNC (added without touching draw logic)
  socket.on('video_play', ({ room }) => {
    socket.to(room).emit('video_play');
  });

  socket.on('video_pause', ({ room }) => {
    socket.to(room).emit('video_pause');
  });

  socket.on('video_seek', ({ room, time }) => {
    socket.to(room).emit('video_seek', time);
  });
  // ✅ MOVIE SYNC ENDS HERE

  // ✅ ✅ ✅ DRAWING — UNTOUCHED
  socket.on('draw', (data) => {
    console.log(`Draw event received for room: ${data.room}`);
    socket.to(data.room).emit('draw', data);
  });

  socket.on('clear', (data) => {
    socket.to(data.room).emit('clear');
  });

  socket.on('undo', (data) => {
    socket.to(data.room).emit('undo', { state: data.state });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const room in rooms) {
      const userIndex = rooms[room].findIndex(user => user.id === socket.id);
      if (userIndex !== -1) {
        rooms[room].splice(userIndex, 1);

        // update voice list
        io.to(room).emit('user-left-voice', socket.id);

        // update initials list
        const userNames = rooms[room].map(user => user.name);
        io.to(room).emit('update_users', userNames);

        if (rooms[room].length === 0) delete rooms[room];
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`TwinCanvas server running on http://localhost:${PORT}`);
});
