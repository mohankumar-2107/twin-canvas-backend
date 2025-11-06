const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // Use Server class

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const rooms = {}; // { [room]: [{ id, name, voiceReady }] }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // --- DRAWING ROOM HANDLER (Your working code) ---
  socket.on('join_room', ({ room, userName }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = [];

    const existingVoiceUsers = rooms[room]
      .filter(u => u.voiceReady)
      .map(u => u.id);
    socket.emit('existing-voice-users', existingVoiceUsers);

    rooms[room].push({ id: socket.id, name: userName, voiceReady: false });
    console.log(`${userName} (${socket.id}) joined DRAW room: ${room}`);

    const userNames = rooms[room].map(u => u.name);
    io.to(room).emit('update_users', userNames);

    socket.data.room = room; // For cleanup
    socket.data.name = userName;
  });

  // --- NEW: MOVIE ROOM HANDLER (Added) ---
  socket.on('join_movie_room', ({ room, userName }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = [];

    const existingVoiceUsers = rooms[room]
      .filter(u => u.voiceReady)
      .map(u => u.id);
    socket.emit('existing-voice-users', existingVoiceUsers);

    rooms[room].push({ id: socket.id, name: userName, voiceReady: false });
    console.log(`${userName} (${socket.id}) joined MOVIE room: ${room}`);

    const userNames = rooms[room].map(u => u.name);
    io.to(room).emit('update_users', userNames);

    socket.data.room = room; // For cleanup
    socket.data.name = userName;
  });

  // --- MIC / VOICE SIGNALING (Your working code) ---
  socket.on('ready-for-voice', ({ room }) => {
    const user = rooms[room]?.find(u => u.id === socket.id);
    if (user) user.voiceReady = true;
    // --- FIX: Use correct { socketId: ... } object ---
    socket.to(room).emit('user-joined-voice', { socketId: socket.id });
  });

  socket.on('voice-offer', (data) => {
    socket.to(data.to).emit('voice-offer', { from: socket.id, offer: data.offer });
  });

  socket.on('voice-answer', (data) => {
    socket.to(data.to).emit('voice-answer', { from: socket.id, answer: data.answer });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
  });

  // --- NEW: VIDEO SYNC EVENTS (Added) ---
  // We use io.to() to broadcast to EVERYONE, including the sender, to fix lag.
  socket.on('video_play', (data) => {
    io.to(data.room).emit('video_play');
  });

  socket.on('video_pause', (data) => {
    io.to(data.room).emit('video_pause');
  });

  socket.on('video_seek', (data) => {
    io.to(data.room).emit('video_seek', data.time);
  });

  // --- DRAWING EVENTS (Your working code) ---
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

  // --- CLEANUP (Updated to work for both rooms) ---
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
