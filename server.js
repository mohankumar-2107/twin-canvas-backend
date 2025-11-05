// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // <-- fix: get Server class

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const rooms = {}; // { [room]: [{ id, name, voiceReady }] }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // --- ROOM JOIN (movie room) ---
  socket.on('join_movie_room', ({ room, userName }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = [];

    // send list of users who already declared voice readiness
    const existingVoiceUsers = rooms[room]
      .filter(u => u.voiceReady)
      .map(u => u.id);
    socket.emit('existing-voice-users', existingVoiceUsers);

    // add this user to room state
    rooms[room].push({ id: socket.id, name: userName, voiceReady: false });
    console.log(`${userName} (${socket.id}) joined room: ${room}`);

    // update name badges
    const userNames = rooms[room].map(u => u.name);
    io.to(room).emit('update_users', userNames);

    // keep track which room this socket is in (for cleanup)
    socket.data.room = room;
    socket.data.name = userName;
  });

  // --- MIC / VOICE SIGNALING ---
  socket.on('ready-for-voice', ({ room }) => {
    const user = rooms[room]?.find(u => u.id === socket.id);
    if (user) user.voiceReady = true;
    // notify others that this user is ready to establish P2P
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

  // --- VIDEO SYNC EVENTS ---
  socket.on('video_play', ({ room }) => {
    socket.to(room).emit('video_play');
  });

  socket.on('video_pause', ({ room }) => {
    socket.to(room).emit('video_pause');
  });

  socket.on('video_seek', ({ room, time }) => {
    socket.to(room).emit('video_seek', time);
  });

  // --- OPTIONAL: drawing events (pass-through) ---
  socket.on('draw', (data) => {
    const { room } = data;
    socket.to(room).emit('draw', data);
  });

  socket.on('clear', ({ room }) => {
    socket.to(room).emit('clear');
  });

  socket.on('undo', ({ room, state }) => {
    socket.to(room).emit('undo', { state });
  });

  // --- CLEANUP ---
  socket.on('disconnect', () => {
    const room = socket.data.room;
    console.log(`User disconnected: ${socket.id}`);
    if (!room || !rooms[room]) return;

    const idx = rooms[room].findIndex(u => u.id === socket.id);
    if (idx !== -1) {
      rooms[room].splice(idx, 1);
      io.to(room).emit('user-left-voice', socket.id);
      const userNames = rooms[room].map(u => u.name);
      io.to(room).emit('update_users', userNames);
      if (rooms[room].length === 0) delete rooms[room];
    }
  });
});

server.listen(PORT, () => {
  console.log(`TwinCanvas server running on http://localhost:${PORT}`);
});
