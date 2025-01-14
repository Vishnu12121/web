const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose
  .connect('mongodb://localhost:27017/chatDB', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Could not connect to MongoDB', err));

// Define Schemas
const roomSchema = new mongoose.Schema({
  roomId: String,
  messages: [
    {
      username: String,
      message: String,
      type: { type: String, default: 'text' }, // text, image, or video
      fileUrl: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

const Room = mongoose.model('Room', roomSchema);

// Multer Setup for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// API Endpoints
app.post('/create-room', async (req, res) => {
  const roomId = uuidv4(); // Generate unique room ID
  const newRoom = new Room({ roomId, messages: [] });
  await newRoom.save();
  res.send({ roomId });
});

app.get('/rooms/:roomId/messages', async (req, res) => {
  const { roomId } = req.params;
  const room = await Room.findOne({ roomId });
  if (!room) return res.status(404).send('Room not found');
  res.send(room.messages);
});

app.post('/rooms/:roomId/messages', async (req, res) => {
  const { roomId } = req.params;
  const { username, message, type, fileUrl } = req.body;

  const room = await Room.findOne({ roomId });
  if (!room) return res.status(404).send('Room not found');

  room.messages.push({ username, message, type, fileUrl });
  await room.save();

  // Notify clients about the new message
  io.to(roomId).emit('newMessage', { username, message, type, fileUrl });
  res.send(room);
});

// Endpoint for file uploads
app.post('/upload', upload.single('file'), (req, res) => {
  const fileUrl = `/uploads/${req.file.filename}`;
  res.send({ fileUrl });
});

// WebSocket Setup
io.on('connection', (socket) => {
  console.log('User connected');

  // Join a room
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  // Typing notification
  socket.on('typing', (roomId, username) => {
    socket.to(roomId).emit('typing', username);
  });

  // Stop typing notification
  socket.on('stopTyping', (roomId) => {
    socket.to(roomId).emit('stopTyping');
  });
});

// Start Server
const PORT = 5000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
