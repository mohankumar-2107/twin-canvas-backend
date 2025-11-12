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

  // --- DRAWING ROOM HANDLER ---
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

    socket.data.room = room;
    socket.data.name = userName;
  });

  // --- MOVIE ROOM HANDLER ---
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

    // ✅ tell both sides who to talk to
    const otherUsers = rooms[room].map(u => u.id).filter(id => id !== socket.id);
    socket.emit("movie-users", otherUsers);
    socket.to(room).emit("movie-users", [socket.id]);

    socket.data.room = room;
    socket.data.name = userName;
  });

  socket.on("request_movie_users", ({ room }) => {
    const users = rooms[room]?.map(u => u.id) || [];
    console.log("request_movie_users from", socket.id, "->", users);
    socket.emit("movie-users", users.filter(id => id !== socket.id));
  });

  // --- MIC / VOICE SIGNALING ---
  socket.on('ready-for-voice', ({ room }) => {
    const user = rooms[room]?.find(u => u.id === socket.id);
    if (user) user.voiceReady = true;
    socket.to(room).emit('user-joined-voice', { socketId: socket.id });
  });

  socket.on('voice-offer', (data) => {
    console.log("voice-offer FROM", socket.id, "TO", data.to);
    socket.to(data.to).emit('voice-offer', { from: socket.id, offer: data.offer });
  });

  socket.on('voice-answer', (data) => {
    console.log("voice-answer FROM", socket.id, "TO", data.to);
    socket.to(data.to).emit('voice-answer', { from: socket.id, answer: data.answer });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
  });

  // --- 🎬 VIDEO SYNC EVENTS (FIXED VERSION) ---
  // 🔹 These now broadcast to everyone EXCEPT the sender 🔹
  socket.on('video_play', (data) => {
    socket.to(data.room).emit('video_play');
  });

  socket.on('video_pause', (data) => {
    socket.to(data.room).emit('video_pause');
  });

  socket.on('video_seek', (data) => {
    socket.to(data.room).emit('video_seek', data.time);
  });
  // ... after socket.on('video_seek', ...)

  // --- 🎬 NEW EVENT TO SYNC DURATION ---
  socket.on('video_duration', (data) => {
    socket.to(data.room).emit('video_duration', data.duration);
  });

// ... before socket.on('draw', ...)

  // --- DRAW EVENTS ---
  socket.on('draw', (data) => {
    socket.to(data.room).emit('draw', data);
  });
  socket.on('clear', (data) => {
    socket.to(data.room).emit('clear');
  });
  socket.on('undo', (data) => {
    socket.to(data.room).emit('undo', { state: data.state });
  });

  // --- DISCONNECT CLEANUP ---
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

