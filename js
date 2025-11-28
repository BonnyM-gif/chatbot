const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static UI
app.use(express.static(path.join(__dirname, 'public')));

// Simple API route to show service is up
app.get('/ping', (req, res) => res.json({ ok: true, time: new Date() }));

// Load knowledge base (simple keyword -> answer)
const kbPath = path.join(__dirname, 'data', 'knowledge.json');
let knowledge = [];
try {
  const raw = fs.readFileSync(kbPath, 'utf8');
  knowledge = JSON.parse(raw);
} catch (err) {
  console.error('Failed to load knowledge base:', err);
}

// Basic keyword-based intent matcher
function getBotReply(message) {
  if (!message || typeof message !== 'string') return "Sorry, I didn't get that.";

  const text = message.toLowerCase().trim();

  // short greetings
  if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(text)) {
    return lookupAnswerByKeywords(text) || "Hello! How can I help today?";
  }

  // look for direct matches in knowledge base
  const kbAns = lookupAnswerByKeywords(text);
  if (kbAns) return kbAns;

  // teacher contact example: "contact ms lopez" or "ms lopez email"
  const teacherMatch = text.match(/(mr|mrs|ms|miss|dr)\.?.+?/i);
  if (teacherMatch) {
    const name = teacherMatch[0];
    // Example static reply; in real deployment query a school directory
    return `I found ${name}. You can email ${name.replace(/\s+/g, '.').toLowerCase()}@school.edu (example).`;
  }

  // fallback
  return "Sorry, I don't have that info yet. Would you like me to notify an admin or add this question to the knowledge base?";
}

function lookupAnswerByKeywords(textLower) {
  for (const item of knowledge) {
    for (const kw of item.keywords) {
      if (textLower.includes(kw.toLowerCase())) {
        return item.answer;
      }
    }
  }
  return null;
}

// Socket.io chat handlers
io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // send welcome message
  socket.emit('bot message', {
    text: "Welcome to SchoolBot! Ask me about homework, schedules, teachers, or contact info. Try: 'homework', 'schedule', or 'contact admin'."
  });

  socket.on('user message', (payload) => {
    try {
      const userText = String(payload && payload.text || '');
      console.log(`message from ${socket.id}:`, userText);

      // echo user message to other clients if you want multi-user chat; here we send back only to sender and broadcast bot messages
      socket.emit('user message', { text: userText });

      // compute bot reply
      const reply = getBotReply(userText);

      // simulate typing delay
      setTimeout(() => {
        socket.emit('bot message', { text: reply });
      }, 500 + Math.min(1500, userText.length * 20));

    } catch (err) {
      console.error('Error handling message', err);
      socket.emit('bot message', { text: "Oops, something went wrong on the server." });
    }
  });

  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`School chatbot running at http://localhost:${PORT}`);
});
