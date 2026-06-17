require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const helmet = require('helmet');
const { DSA_PROBLEMS } = require('./problems');

// JDoodle API language mapping (free: 200 credits/day, email signup only)
const JDOODLE_LANGUAGES = {
  javascript: { language: 'nodejs', versionIndex: '4' },
  typescript: { language: 'typescript', versionIndex: '0' },
  python:     { language: 'python3', versionIndex: '4' },
  java:       { language: 'java', versionIndex: '4' },
  cpp:        { language: 'cpp17', versionIndex: '1' },
  go:         { language: 'go', versionIndex: '4' },
  rust:       { language: 'rust', versionIndex: '4' },
};

const JDOODLE_API_URL = 'https://api.jdoodle.com/v1/execute';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Parse CORS origins from env or use defaults
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

// Enable CORS
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true
}));

// Security headers
app.use(helmet());

// Parse JSON request bodies with size limits
app.use(express.json({ limit: '1mb' }));

const io = socketIo(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Room storage: rooms[roomId] = { users: [], code: "", language: "javascript", cleanupTimeout: null }
const rooms = new Map();

// User colors for cursor identification
const userColors = ["#00ff88", "#00d4ff", "#ffff00", "#ff00ff"];

function getUserColor(userIndex) {
  return userColors[userIndex % userColors.length];
}

function generateRoomId() {
  return uuidv4().substring(0, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  // Handle room joining
  socket.on('join-room', ({ roomId, username, language }) => {
    console.log(`👤 ${username} attempting to join room: ${roomId}`);

      // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      const initialLanguage = language || 'javascript';
      rooms.set(roomId, {
        users: [],
        code: '// Welcome to Collaborative Platform!\n// Start collaborating by typing here...\n\nconsole.log("Hello, world!");',
        language: initialLanguage,
        currentProblem: null,
        solvedProblems: new Set(),
        problemBoilerplates: {}
      });
      console.log(`🏠 Created new room: ${roomId} with language: ${initialLanguage}`);
    }

    const room = rooms.get(roomId);

    // Check if room is full (max 4 users)
    if (room.users.length >= 4) {
      socket.emit('room-full', { 
        message: 'Room is full! Maximum 4 players allowed.' 
      });
      console.log(`❌ Room ${roomId} is full, rejected ${username}`);
      return;
    }

    // Check if username already exists in room
    const existingUser = room.users.find(u => u.username === username);
    if (existingUser) {
      socket.emit('username-taken', { 
        message: 'Username already taken in this room!' 
      });
      console.log(`❌ Username ${username} already taken in room ${roomId}`);
      return;
    }

    // Add user to room
    const isHost = room.users.length === 0;
    const userColor = getUserColor(room.users.length);
    
    const newUser = {
      id: socket.id,
      username,
      color: userColor,
      role: isHost ? 'owner' : 'member',
      isHost,
      isPaused: false,
      cursor: null
    };

    room.users.push(newUser);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    // Send current room state to the joining user
    socket.emit('room-joined', {
      users: room.users,
      code: room.code,
      language: room.language,
      roomId: roomId
    });

    // Notify other users in the room
    socket.to(roomId).emit('user-joined', {
      username,
      users: room.users,
      color: userColor,
      isHost
    });

    console.log(`✅ ${username} joined room ${roomId} (${room.users.length}/4 users)`);
  });

  // Handle code changes
  socket.on('code-change', ({ roomId, code }) => {
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);

    // Block code changes from paused users
    const sender = room.users.find(u => u.id === socket.id);
    if (sender && sender.isPaused) {
      socket.emit('action-blocked', { message: 'You are paused by the host.' });
      return;
    }

    room.code = code;
    
    // Broadcast to all other users in the room (not the sender)
    socket.to(roomId).emit('code-updated', { code });
    console.log(`📝 Code updated in room ${roomId} by ${socket.username}`);
  });

  // Handle language changes
  socket.on('language-change', ({ roomId, language, code }) => {
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    room.language = language;
    if (code !== undefined) {
      room.code = code;
    }
    
    // Broadcast to all users in the room (including sender for consistency)
    io.to(roomId).emit('language-updated', { 
      language,
      code: code !== undefined ? code : room.code
    });
    console.log(`🔧 Language changed to ${language} in room ${roomId} by ${socket.username}`);
  });

  // Handle cursor movements
  socket.on('cursor-move', ({ roomId, username, position }) => {
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    const user = room.users.find(u => u.username === username);
    
    if (user) {
      user.cursor = position;
      // Broadcast cursor position to other users only
      socket.to(roomId).emit('cursor-updated', {
        username,
        position,
        color: user.color
      });
    }
  });

  // Handle chat messages
  socket.on('chat-message', ({ roomId, username, message }) => {
    if (!rooms.has(roomId) || !message.trim()) return;

    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Broadcast to all users in the room (including sender)
    io.to(roomId).emit('chat-received', {
      username,
      message: message.trim(),
      timestamp
    });

    console.log(`💬 Chat message in room ${roomId} from ${username}: ${message}`);
  });

  // Handle pause user (host only)
  socket.on('pause-user', ({ roomId, targetUsername }) => {
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    // Only the host can pause users
    const host = room.users.find(u => u.id === socket.id);
    if (!host || !host.isHost) return;

    const target = room.users.find(u => u.username === targetUsername);
    if (!target || target.isHost) return; // Can't pause the host

    target.isPaused = true;
    io.to(roomId).emit('user-paused', { targetUsername, users: room.users });
    console.log(`⏸️ ${targetUsername} paused by ${host.username} in room ${roomId}`);
  });

  // Handle unpause user (host only)
  socket.on('unpause-user', ({ roomId, targetUsername }) => {
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const host = room.users.find(u => u.id === socket.id);
    if (!host || !host.isHost) return;

    const target = room.users.find(u => u.username === targetUsername);
    if (!target) return;

    target.isPaused = false;
    io.to(roomId).emit('user-unpaused', { targetUsername, users: room.users });
    console.log(`▶️ ${targetUsername} unpaused by ${host.username} in room ${roomId}`);
  });

  // Handle kick user (owner only)
  socket.on('kick-user', ({ roomId, targetUsername }) => {
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const owner = room.users.find(u => u.id === socket.id);
    if (!owner || owner.role !== 'owner') return;

    const target = room.users.find(u => u.username === targetUsername);
    if (!target || target.role === 'owner') return;

    io.to(roomId).emit('user-kicked', { targetUsername, users: room.users, kickedBy: owner.username });
    handleUserLeave(socket, roomId, targetUsername, true, target.id);
    console.log(`👢 ${targetUsername} kicked by ${owner.username} from room ${roomId}`);
  });

  // Handle transfer ownership (owner only)
  socket.on('transfer-ownership', ({ roomId, targetUsername }) => {
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const currentOwner = room.users.find(u => u.id === socket.id);
    if (!currentOwner || currentOwner.role !== 'owner') return;

    const target = room.users.find(u => u.username === targetUsername);
    if (!target || target.role === 'owner') return;

    currentOwner.role = 'member';
    currentOwner.isHost = false;
    target.role = 'owner';
    target.isHost = true;

    io.to(roomId).emit('ownership-transferred', { 
      newOwner: targetUsername, 
      previousOwner: currentOwner.username,
      users: room.users 
    });
    console.log(`👑 Ownership transferred from ${currentOwner.username} to ${targetUsername} in room ${roomId}`);
  });

  // Problem-related handlers
  socket.on('get-problems', () => {
    socket.emit('problems-list', { problems: DSA_PROBLEMS });
  });

  socket.on('select-problem', ({ roomId, problemId }) => {
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    const problem = DSA_PROBLEMS.find(p => p.id === problemId);
    if (!problem) return;

    room.currentProblem = problem;
    const boilerplate = problem.boilerplate[room.language] || problem.boilerplate.javascript;
    room.code = boilerplate;
    room.problemBoilerplates[problem.id] = boilerplate;

    io.to(roomId).emit('problem-selected', { 
      problem,
      code: boilerplate,
      solvedBy: Array.from(room.solvedProblems)
    });
    console.log(`📋 Problem "${problem.title}" selected in room ${roomId} by ${user.username}`);
  });

  socket.on('select-random-problem', ({ roomId }) => {
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    const unsolvedProblems = DSA_PROBLEMS.filter(p => !room.solvedProblems.has(p.id));
    const problemPool = unsolvedProblems.length > 0 ? unsolvedProblems : DSA_PROBLEMS;
    const randomProblem = problemPool[Math.floor(Math.random() * problemPool.length)];

    room.currentProblem = randomProblem;
    const boilerplate = randomProblem.boilerplate[room.language] || randomProblem.boilerplate.javascript;
    room.code = boilerplate;
    room.problemBoilerplates[randomProblem.id] = boilerplate;

    io.to(roomId).emit('problem-selected', { 
      problem: randomProblem,
      code: boilerplate,
      solvedBy: Array.from(room.solvedProblems)
    });
    console.log(`🎲 Random problem "${randomProblem.title}" selected in room ${roomId} by ${user.username}`);
  });

  socket.on('submit-solution', ({ roomId, code, language }) => {
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    if (!room.currentProblem) {
      socket.emit('submission-result', { success: false, message: 'No problem selected!' });
      return;
    }

    const user = room.users.find(u => u.id === socket.id);
    if (!user) return;

    socket.emit('submission-result', { 
      success: true, 
      problemId: room.currentProblem.id,
      problemTitle: room.currentProblem.title,
      message: 'Solution submitted for verification!'
    });
    console.log(`✅ Solution submitted by ${user.username} for problem "${room.currentProblem.title}"`);
  });

  socket.on('mark-solved', ({ roomId, problemId }) => {
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    const problem = DSA_PROBLEMS.find(p => p.id === problemId);
    if (!problem) return;

    room.solvedProblems.add(problemId);

    io.to(roomId).emit('problem-solved', { 
      problemId,
      problemTitle: problem.title,
      solvedBy: user.username,
      solvedProblems: Array.from(room.solvedProblems)
    });
    console.log(`🏆 Problem "${problem.title}" marked as solved by ${user.username}`);
  });

  socket.on('reset-problem', ({ roomId }) => {
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    if (room.currentProblem) {
      const boilerplate = room.currentProblem.boilerplate[room.language] || room.currentProblem.boilerplate.javascript;
      room.code = boilerplate;
      io.to(roomId).emit('problem-reset', { 
        code: boilerplate,
        problem: room.currentProblem
      });
      console.log(`🔄 Problem "${room.currentProblem.title}" reset by ${user.username}`);
    }
  });

  // Handle leaving room
  socket.on('leave-room', ({ roomId, username }) => {
    handleUserLeave(socket, roomId, username);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    
    if (socket.roomId && socket.username) {
      handleUserLeave(socket, socket.roomId, socket.username);
    }
  });

  function handleUserLeave(socket, roomId, username, isKicked = false, kickedSocketId = null) {
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    const userIndex = room.users.findIndex(u => u.username === username);

    if (userIndex !== -1) {
      room.users.splice(userIndex, 1);
      socket.leave(roomId);

      // If kicked, disconnect the kicked user's socket
      if (isKicked && kickedSocketId) {
        const kickedSocket = io.sockets.sockets.get(kickedSocketId);
        if (kickedSocket) {
          kickedSocket.emit('kicked-from-room', { roomId });
          kickedSocket.leave(roomId);
        }
      }

      // Clear any pending cleanup timeout
      if (room.cleanupTimeout) {
        clearTimeout(room.cleanupTimeout);
        room.cleanupTimeout = null;
      }

      // If room is empty, schedule deletion after timeout (allows quick rejoin)
      if (room.users.length === 0) {
        room.cleanupTimeout = setTimeout(() => {
          if (rooms.has(roomId)) {
            const currentRoom = rooms.get(roomId);
            if (currentRoom.users.length === 0) {
              rooms.delete(roomId);
              console.log(`🗑️ Deleted empty room: ${roomId} after timeout`);
            }
          }
        }, 60000); // 1 minute timeout before room cleanup
      } else {
        // If the owner left, make the first remaining user the new owner
        if (userIndex === 0 && room.users.length > 0) {
          room.users[0].isHost = true;
          room.users[0].role = 'owner';
          io.to(roomId).emit('new-owner', { newOwner: room.users[0].username, users: room.users });
          console.log(`👑 ${room.users[0].username} is now the owner of room ${roomId}`);
        }

        // Notify remaining users
        socket.to(roomId).emit('user-left', {
          username,
          users: room.users,
          isKicked
        });
      }

      console.log(`👋 ${username} ${isKicked ? 'kicked from' : 'left'} room ${roomId} (${room.users.length}/4 users remaining)`);
    }
  }
});

// API endpoint to create a new room
app.get('/api/create-room', (req, res) => {
  const roomId = generateRoomId();
  res.json({ roomId });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// API endpoint to get problems list
app.get('/api/problems', (req, res) => {
  res.json({ problems: DSA_PROBLEMS });
});

// Code execution endpoint via JDoodle (free: 200 credits/day)
app.post('/api/execute', async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'code and language are required' });
    }

    if (code.length > 50000) {
      return res.status(400).json({ error: 'Code exceeds maximum length of 50,000 characters' });
    }

    const jdoodleLang = JDOODLE_LANGUAGES[language];
    if (!jdoodleLang) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    const clientId = process.env.JDOODLE_CLIENT_ID;
    const clientSecret = process.env.JDOODLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'JDoodle API is not configured. Add JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET to server/.env',
      });
    }

    // Send to JDoodle API
    const response = await axios.post(
      JDOODLE_API_URL,
      {
        clientId,
        clientSecret,
        script: code,
        language: jdoodleLang.language,
        versionIndex: jdoodleLang.versionIndex,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    const result = response.data;

    // JDoodle returns { output, statusCode, memory, cpuTime, error }
    // Map to our standard format
    const isError = result.statusCode !== 200;
    const isTimeLimit = result.statusCode === 139 || result.cpuTime > 15;
    const isMemoryLimit = result.memory && result.memory > 256000;
    
    let status;
    if (isTimeLimit) {
      status = { id: 5, description: 'Time Limit Exceeded (>15s)' };
    } else if (isMemoryLimit) {
      status = { id: 8, description: 'Memory Limit Exceeded' };
    } else if (isError) {
      status = { id: 11, description: 'Runtime Error' };
    } else {
      status = { id: 3, description: 'Accepted' };
    }

    res.json({
      stdout: isError || isTimeLimit || isMemoryLimit ? null : (result.output || null),
      stderr: (isError && !isTimeLimit && !isMemoryLimit) ? (result.output || result.error || null) : null,
      compile_output: null,
      status,
      memory: result.memory,
      cpuTime: result.cpuTime,
      error: result.error || (isTimeLimit ? 'Execution time exceeded 15 seconds limit' : null),
    });
  } catch (err) {
    console.error('❌ Code execution error:', err.message);
    
    if (err.code === 'ECONNABORTED') {
      return res.status(408).json({
        error: 'Request Timeout',
        details: 'Code execution took too long (>30s). Try optimizing your code.',
        status: { id: 5, description: 'Time Limit Exceeded' },
      });
    }
    
    if (err.response) {
      const status = err.response.status;
      const data = err.response.data;
      
      // JDoodle specific errors
      if (data && data.error) {
        return res.status(status).json({
          error: 'JDoodle API Error',
          details: data.error,
        });
      }
      
      // Rate limit or other HTTP errors
      if (status === 429) {
        return res.status(429).json({
          error: 'Rate Limit Exceeded',
          details: 'Too many requests. Please wait a moment before running code again.',
        });
      }
      
      return res.status(status).json({
        error: 'JDoodle API error',
        details: data,
      });
    }
    
    res.status(500).json({ error: 'Code execution failed', details: err.message });
  }
});

// AI Code Analysis endpoint via OpenRouter
app.post('/api/analyze', async (req, res) => {
  try {
    const { code, language, compilerOutput } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'code and language are required' });
    }

    if (code.length > 50000) {
      return res.status(400).json({ error: 'Code exceeds maximum length of 50,000 characters' });
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openRouterModel = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';

    if (!openRouterKey) {
      return res.status(500).json({
        error: 'OpenRouter API is not configured. Add OPENROUTER_API_KEY to server/.env',
      });
    }

    const systemPrompt = `You are an AI programming assistant embedded inside a real-time collaborative coding platform called Collaborative Platform.
Analyze the provided code and compiler output carefully.

Your responsibilities:
1. Identify syntax errors, logical errors, runtime problems, or bad coding practices.
2. Provide a clear explanation of each detected issue.
3. Suggest a corrected or improved version of the code.
4. Recommend improvements for readability, structure, performance, or best practices.
5. If the code has no errors, suggest optimizations or cleaner design.

Keep explanations short and developer-friendly. Assume users may be beginners.
Format your response in markdown with these sections:
## Issue Detected
## Suggested Fix
## Explanation
## Improvement Suggestions`;

    const userPrompt = `Language: ${language}

User Code:
\`\`\`${language}
${code}
\`\`\`

Compiler Output:
${compilerOutput || 'No compiler output available (code not yet executed).'}`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: openRouterModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      },
      {
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:5173',
          'X-OpenRouter-Title': process.env.OPENROUTER_APP_TITLE || 'Collaborative Platform',
        },
        timeout: 30000,
      }
    );

    const result = response.data;
    const analysisText = result?.choices?.[0]?.message?.content || 'No analysis generated.';

    res.json({ analysis: analysisText });
  } catch (err) {
    console.error('\u274c AI analysis error:', err.message);
    if (err.response) {
      const status = err.response.status;
      const details = err.response.data?.error?.message || err.response.data;

      if (status === 429) {
        return res.status(429).json({
          error: 'OpenRouter rate limit reached',
          details: 'The selected OpenRouter model is currently rate-limited or out of quota. Try again later, add credits, or switch OPENROUTER_MODEL to another available model.',
        });
      }

      if (status === 401 || status === 403) {
        return res.status(status).json({
          error: 'OpenRouter authentication failed',
          details: 'Check OPENROUTER_API_KEY in server/.env and restart the server.',
        });
      }

      return res.status(err.response.status).json({
        error: 'OpenRouter API error',
        details,
      });
    }
    res.status(500).json({ error: 'AI analysis failed', details: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Collaborative Platform server running on port ${PORT}`);
  console.log(`🌐 Socket.io enabled with CORS for localhost:5173`);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('💤 Server closed');
    process.exit(0);
  });
});
