// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new socketIo.Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;
const rooms = {}; // drawing rooms
const movieRooms = {}; // movie rooms

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  // ✅ DRAWING ROOM JOIN
  socket.on('join_room', ({ room, userName }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = [];

    const voiceUsers = rooms[room].filter(u => u.voiceReady).map(u => u.id);
    socket.emit('existing-voice-users', voiceUsers);

    rooms[room].push({ id: socket.id, name: userName, voiceReady: false });

    io.to(room).emit('update_users', rooms[room].map(u => u.name));
  });

  // ✅ DRAWING EVENTS
  socket.on('draw', data => socket.to(data.room).emit('draw', data));
  socket.on('clear', ({ room }) => socket.to(room).emit('clear'));
  socket.on('undo', ({ room, state }) => socket.to(room).emit('undo', { state }));

  // ✅ MIC for DRAWING
  socket.on('ready-for-voice', ({ room }) => {
    const user = rooms[room]?.find(u => u.id === socket.id);
    if (user) user.voiceReady = true;
    socket.to(room).emit('user-joined-voice', socket.id);
  });
  socket.on('voice-offer', d => socket.to(d.to).emit('voice-offer', { from: socket.id, offer: d.offer }));
  socket.on('voice-answer', d => socket.to(d.to).emit('voice-answer', { from: socket.id, answer: d.answer }));
  socket.on('ice-candidate', d => socket.to(d.to).emit('ice-candidate', { from: socket.id, candidate: d.candidate }));

  // ============================================================
  // ✅ ✅ ✅ MOVIE ROOM LOGIC (NEW, does NOT affect drawing)
  // ============================================================
  socket.on('join_movie_room', ({ room, userName }) => {
    socket.join(room);
    if (!movieRooms[room]) movieRooms[room] = [];

    movieRooms[room].push(socket.id);

    // tell new user who is already here
    socket.emit('movie-users', movieRooms[room].filter(id => id !== socket.id));
  });

  // WebRTC for movie video
  socket.on('movie-offer', d => socket.to(d.to).emit('movie-offer', { from: socket.id, offer: d.offer }));
  socket.on('movie-answer', d => socket.to(d.to).emit('movie-answer', { from: socket.id, answer: d.answer }));
  socket.on('movie-ice', d => socket.to(d.to).emit('movie-ice', { from: socket.id, candidate: d.candidate }));

  // Video sync
  socket.on('movie_play', d => socket.to(d.room).emit('movie_play'));
  socket.on('movie_pause', d => socket.to(d.room).emit('movie_pause'));
  socket.on('movie_seek', d => socket.to(d.room).emit('movie_seek', d.time));
  // ============================================================

  // ✅ DISCONNECT CLEANUP
  socket.on('disconnect', () => {
    for (const room in rooms) {
      const idx = rooms[room].findIndex(u => u.id === socket.id);
      if (idx !== -1) {
        rooms[room].splice(idx, 1);
        io.to(room).emit('user-left-voice', socket.id);
        io.to(room).emit('update_users', rooms[room].map(u => u.name));
        if (!rooms[room].length) delete rooms[room];
        break;
      }
    }

    // Movie cleanup
    for (const room in movieRooms) {
      movieRooms[room] = movieRooms[room].filter(id => id !== socket.id);
      if (!movieRooms[room].length) delete movieRooms[room];
    }
  });
});

server.listen(PORT, () => console.log(`TwinCanvas server live @ ${PORT}`));
