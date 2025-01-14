const API_URL = 'http://localhost:5000'; // Backend API URL
let currentRoomId = null;
const socket = io(API_URL);

// Create a new room
async function createRoom() {
  const response = await fetch(`${API_URL}/create-room`, { method: 'POST' });
  const data = await response.json();

  alert(`Room created! Share this link: ${window.location.origin}?roomId=${data.roomId}`);
  joinRoomById(data.roomId);
}

// Join a room by ID
async function joinRoom() {
  const roomId = document.getElementById('roomIdInput').value.trim();
  if (!roomId) {
    alert('Please enter a valid Room ID.');
    return;
  }
  joinRoomById(roomId);
}

// Join a room and listen for updates
async function joinRoomById(roomId) {
  currentRoomId = roomId;
  document.getElementById('room-container').style.display = 'none';
  document.getElementById('chat-container').style.display = 'block';

  socket.emit('joinRoom', roomId);

  fetchMessages();
  setInterval(fetchMessages, 2000); // Fetch new messages every 2 seconds

  socket.on('newMessage', appendMessage);

  socket.on('typing', (username) => {
    const typingIndicator = document.getElementById('typing-indicator');
    typingIndicator.textContent = `${username} is typing...`;
  });

  socket.on('stopTyping', () => {
    const typingIndicator = document.getElementById('typing-indicator');
    typingIndicator.textContent = '';
  });
}

// Fetch messages
async function fetchMessages() {
  if (!currentRoomId) return;

  const response = await fetch(`${API_URL}/rooms/${currentRoomId}/messages`);
  const messages = await response.json();

  const messagesContainer = document.getElementById('messages');
  messagesContainer.innerHTML = ''; // Clear existing messages

  messages.forEach((msg) => appendMessage(msg));
}

// Append message
function appendMessage(msg) {
  const messagesContainer = document.getElementById('messages');
  const messageElement = document.createElement('div');
  
  if (msg.type === 'text') {
    messageElement.textContent = `${msg.username || 'Anonymous'}: ${msg.message}`;
  } else if (msg.type === 'image' || msg.type === 'video') {
    const mediaElement = document.createElement(msg.type);
    mediaElement.src = msg.fileUrl;
    mediaElement.controls = true;
    messageElement.appendChild(mediaElement);
  }

  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
}

// Send a message
async function sendMessage() {
  const username = document.getElementById('usernameInput').value.trim() || 'Anonymous';
  const message = document.getElementById('messageInput').value.trim();

  if (!message || !currentRoomId) return;

  await fetch(`${API_URL}/rooms/${currentRoomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, message, type: 'text' }),
  });

  document.getElementById('messageInput').value = '';
}

// Send a file
async function sendFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  const { fileUrl } = await response.json();

  const username = document.getElementById('usernameInput').value.trim() || 'Anonymous';

  await fetch(`${API_URL}/rooms/${currentRoomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, type: file.type.startsWith('video') ? 'video' : 'image', fileUrl }),
  });
}

// Typing indicator
function notifyTyping() {
  const username = document.getElementById('usernameInput').value.trim() || 'Anonymous';
  socket.emit('typing', currentRoomId, username);
}

function notifyStopTyping() {
  socket.emit('stopTyping', currentRoomId);
}

// Handle file upload
document.getElementById('fileInput').addEventListener('change', (e) => {
  sendFile(e.target.files[0]);
});
