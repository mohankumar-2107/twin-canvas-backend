const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const rooms = {}; // { room: [ {id, name, voiceReady} ] }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // ✅ DRAWING ROOM JOIN
  socket.on('join_room', ({ room, userName }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = [];

    const existingVoiceUsers = rooms[room].filter(u => u.voiceReady).map(u => u.id);
    socket.emit('existing-voice-users', existingVoiceUsers);

    rooms[room].push({ id: socket.id, name: userName, voiceReady: false });
    console.log(`${userName} (${socket.id}) joined DRAW room: ${room}`);

    io.to(room).emit('update_users', rooms[room].map(u => u.name));

    socket.data.room = room;
    socket.data.name = userName;
  });

  // ✅ MOVIE ROOM JOIN
  socket.on('join_movie_room', ({ room, userName }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = [];

    const existingVoiceUsers = rooms[room].filter(u => u.voiceReady).map(u => u.id);
    socket.emit('existing-voice-users', existingVoiceUsers);

    rooms[room].push({ id: socket.id, name: userName, voiceReady: false });
    console.log(`${userName} (${socket.id}) joined MOVIE room: ${room}`);

    io.to(room).emit('update_users', rooms[room].map(u => u.name));

    socket.data.room = room;
    socket.data.name = userName;
  });

  // ✅ ✅ FIX: allow reverse broadcasting
  socket.on("request_movie_users", ({ room }) => {
    const users = rooms[room]?.map(u => u.id) || [];
    socket.emit("movie-users", users.filter(id => id !== socket.id));
  });

  // ✅ MIC SIGNALING
  socket.on('ready-for-voice', ({ room }) => {
    const user = rooms[room]?.find(u => u.id === socket.id);
    if (user) user.voiceReady = true;
    socket.to(room).emit('user-joined-voice', { socketId: socket.id });
  });

  socket.on('voice-offer', (d) => {
    socket.to(d.to).emit('voice-offer', { from: socket.id, offer: d.offer });
  });
  socket.on('voice-answer', (d) => {
    socket.to(d.to).emit('voice-answer', { from: socket.id, answer: d.answer });
  });
  socket.on('ice-candidate', (d) => {
    socket.to(d.to).emit('ice-candidate', { from: socket.id, candidate: d.candidate });
  });

  // ✅ VIDEO SYNC
  socket.on('video_play', ({ room }) => io.to(room).emit('video_play'));
  socket.on('video_pause', ({ room }) => io.to(room).emit('video_pause'));
  socket.on('video_seek', ({ room, time }) => io.to(room).emit('video_seek', time));

  // ✅ DRAWING EVENTS
  socket.on('draw', (d) => socket.to(d.room).emit('draw', d));
  socket.on('clear', (d) => socket.to(d.room).emit('clear'));
  socket.on('undo', (d) => socket.to(d.room).emit('undo', { state: d.state }));

  // ✅ CLEANUP
  socket.on('disconnect', () => {
    const room = socket.data.room;
    console.log(`User disconnected: ${socket.id}`);
    if (!room || !rooms[room]) return;

    const idx = rooms[room].findIndex(u => u.id === socket.id);
    if (idx !== -1) {
      rooms[room].splice(idx, 1);

      io.to(room).emit('user-left-voice', socket.id);
      io.to(room).emit('update_users', rooms[room].map(u => u.name));

      if (rooms[room].length === 0) delete rooms[room];
    }
  });
});

server.listen(PORT, () => {
  console.log(`TwinCanvas server running on http://localhost:${PORT}`);
});
