# 🎮 Collaborative Platform — Project Documentation

> **A real-time collaborative code editor** designed for pair programming, coding interviews, teaching sessions, and hackathon teams.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Proof of Work (Screenshots)](#proof-of-work-screenshots)
6. [Setup & Installation](#setup--installation)
7. [API Reference](#api-reference)
8. [Socket.io Events](#socketio-events)
9. [Project Structure](#project-structure)
10. [Deployment](#deployment)
11. [Known Limitations](#known-limitations)
12. [Troubleshooting](#troubleshooting)

---

## 🚀 Project Overview

**Collaborative Platform** is a browser-based real-time code editor where multiple developers can write, run, and analyze code together in a shared room session. It combines the power of Monaco Editor (same engine as VS Code), real-time WebSocket sync via Socket.io, remote code execution through JDoodle, and AI-powered code analysis through OpenRouter.

The project is split into:
- **Client** — React 18 + Vite SPA
- **Server** — Node.js + Express + Socket.io

Room state is stored in-memory for speed and simplicity. Up to **4 users** can share a single room.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔄 Real-Time Sync | Code changes broadcast instantly to all room members via Socket.io |
| 👥 Multi-User Rooms | Up to 4 developers per room |
| 🎯 Cursor Tracking | See remote cursor positions in the Monaco Editor |
| 💬 Live Chat | In-room text chat for all members |
| 🏆 Room Ownership | First user becomes the Room Owner with management powers |
| 🚫 Pause / Kick | Owner can pause editing rights or kick any member |
| 🔀 Transfer Ownership | Owner can hand off host rights to another member |
| 🌐 8+ Languages | JavaScript, TypeScript, Python, Java, C++, Go, Rust, HTML |
| ▶️ Code Execution | Run code through JDoodle and view stdout in the output panel |
| 🤖 AI Analysis | Send code + output to OpenRouter for instant AI feedback |
| 📚 DSA Problems | Built-in problem set with boilerplate code |
| 🌙 Dark / Light Theme | Toggle-able theme persisted in localStorage |

---

## 🛠️ Tech Stack

### Frontend (Client)

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool & dev server |
| React Router | Client-side routing |
| Monaco Editor (`@monaco-editor/react`) | Code editing engine |
| Socket.io Client | Real-time WebSocket communication |
| Tailwind CSS | Utility-first styling |
| Lucide React | Icon library |
| React Hot Toast | Notification toasts |

### Backend (Server)

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express | HTTP server framework |
| Socket.io | WebSocket event handling |
| Axios | HTTP client for external APIs |
| Helmet | Security headers |
| CORS | Cross-Origin Resource Sharing |
| Dotenv | Environment variable management |
| UUID | Unique room ID generation |

### External Services

| Service | Purpose |
|---|---|
| **JDoodle** | Remote multi-language code execution |
| **OpenRouter** | AI-powered code analysis (`deepseek/deepseek-v4-flash` by default) |

---

## 🏗️ Architecture

```
Browser (React SPA)
        │
        │  HTTP Requests
        │  ├── GET  /api/create-room
        │  ├── GET  /api/problems
        │  ├── POST /api/execute
        │  └── POST /api/analyze
        │
        │  WebSocket (Socket.io)
        │  ├── join-room / leave-room
        │  ├── code-change / language-change
        │  ├── cursor-move / chat-message
        │  └── owner controls (pause/kick/transfer)
        │
        ▼
Node.js / Express Server
        │
        ├── In-Memory Room Store  (rooms: Map<roomId, roomState>)
        │
        └── External APIs
            ├── JDoodle  → code execution
            └── OpenRouter → AI analysis
```

### Room State Shape (In-Memory)

```js
{
  users: [],                  // Connected user objects
  code: "",                   // Shared code content
  language: "javascript",    // Active language
  currentProblem: null,       // Selected DSA problem (if any)
  solvedProblems: Set,        // Set of solved problem IDs
  problemBoilerplates: {},    // Per-language boilerplates
  cleanupTimeout: null        // Timer to delete empty rooms
}
```

> ⚠️ **Note:** Room state is lost on server restart. No database persistence currently.

---

## 📸 Proof of Work (Screenshots)

The following screenshots demonstrate the platform running live with 2 concurrent users — **developer_1** and **developer_2** — in a real collaborative session.

---

### 1. Lobby / Home Screen

The entry point of the application. Users enter a display name, choose their default coding language, and either **Create Room** or **Join Room**.

![Lobby — Home Screen](./docs/screenshots/01_lobby_home.jpg)

**Highlights:**
- Pixel/retro-console aesthetic with dark background
- "Max 4 Players Per Room" constraint displayed
- Feature overview cards: Real-Time Sync, 8+ Languages, AI Analysis, Code Execute

---

### 2. Collaborative Editor — Member View (developer_1)

Two players inside a live session. **developer_1** is logged in as a **Member**, **developer_2** is the **Owner**. Both users are visible in the sidebar player list. Code is synchronized between both clients.

![Collaborative Editor — Member View](./docs/screenshots/02_editor_collaborative.jpg)

**Highlights:**
- Session ID displayed in the header (`81D435E5`)
- `2/4 PLAYERS` indicator — room has capacity for 2 more
- `CONNECTED` status confirmed
- Live Chat panel with welcome message
- Monaco Editor with shared JavaScript code
- `STDOUT` output panel showing `Hello, world!`

---

### 3. AI Analysis — Member Perspective

**developer_1** (Member) triggers the **Analyze** button. The AI analysis panel displays a full breakdown of the submitted code.

![AI Analysis — Member View](./docs/screenshots/03_ai_analysis_member.jpg)

**Highlights:**
- **NO ISSUES DETECTED** — code compiles and runs correctly
- **Suggested Fix** — "No fixes needed — the code is correct"
- **Explanation** — plain-English description of what the code does
- **Improvement Suggestions** — visible below (further detail)
- Output panel shows accepted stdout: `Hello, world!`

---

### 4. AI Analysis — Host Perspective (developer_2)

**developer_2** (Owner / Host) sees the same collaborative session with the AI analysis panel open from the host's point of view. Live chat shows full join/leave history.

![AI Analysis — Host View](./docs/screenshots/04_ai_analysis_host.jpg)

**Highlights:**
- Owner crown icon (`👑`) visible for **developer_2**
- Live chat shows: `DEVELOPER_1 JOINED THE ROOM`, `DEVELOPER_1 LEFT THE ROOM`, `DEVELOPER_1 JOINED THE ROOM (MEMBER)` — demonstrating real-time join/leave events
- AI analysis result: `ISSUE DETECTED → No issues detected. Code compiles and runs successfully.`
- `SUGGESTED FIX` and `EXPLANATION` sections rendered correctly on the host side

---

### 5. Editor — Output Ready State (Host View)

Shows the editor after code has been saved and is ready for execution, with the output panel and AI analysis panel both in their "ready" idle states.

![Editor — Output Ready](./docs/screenshots/05_editor_output_ready.jpg)

**Highlights:**
- `OUTPUT READY` — click ▶ Run to execute
- `AI ANALYSIS` — click ✨ Analyze to get AI feedback
- `Ln 4, Col 30 | 4 lines` — Monaco cursor position tracking
- Code auto-saved (Saved indicator in header)
- Both players still `CONNECTED`

---

## ⚙️ Setup & Installation

### Prerequisites

- Node.js **18+**
- npm
- A modern browser (Chrome, Firefox, Edge)
- JDoodle account + credentials (for code execution)
- OpenRouter API key (for AI analysis)

---

### 1. Clone & Install

```bash
# Clone the repository
git clone <your-repo-url>
cd collaborative-platform

# Install all dependencies (root + server + client)
npm run install:all
```

Or manually:

```bash
npm install
cd server && npm install
cd ../client && npm install
```

---

### 2. Configure Environment Variables

**Server** — `server/.env`:

```env
NODE_ENV=development
PORT=3001
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

JDOODLE_CLIENT_ID=your_jdoodle_client_id
JDOODLE_CLIENT_SECRET=your_jdoodle_client_secret

OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=deepseek/deepseek-v4-flash
OPENROUTER_HTTP_REFERER=http://localhost:5173
OPENROUTER_APP_TITLE=Collaborative Platform
```

**Client** — `client/.env`:

```env
VITE_SOCKET_URL=http://localhost:3001
VITE_API_URL=http://localhost:3001
```

> 🔒 Never commit real API keys. Keep `.env` files private and listed in `.gitignore`.

---

### 3. Run in Development

```bash
# From project root — starts both server and client
npm run dev
```

| Service | URL |
|---|---|
| Server | http://localhost:3001 |
| Client | http://localhost:5173 |

---

## 📡 API Reference

### `GET /api/health`
Returns server status and active room count.

```json
{ "status": "ok", "rooms": 1, "timestamp": "2026-06-17T12:00:00.000Z" }
```

### `GET /api/create-room`
Creates a new 8-character room ID.

```json
{ "roomId": "81D435E5" }
```

### `GET /api/problems`
Returns the built-in DSA problem list.

### `POST /api/execute`
Runs code through JDoodle.

```json
// Request
{ "code": "console.log('hello')", "language": "javascript" }

// Response
{ "output": "hello\n", "statusCode": 200 }
```

**Supported languages:** JavaScript, TypeScript, Python, Java, C++, Go, Rust

### `POST /api/analyze`
Sends code + compiler output to OpenRouter AI.

```json
// Request
{ "code": "const x = 1 + 1;", "language": "javascript", "compilerOutput": "2" }

// Response
{ "analysis": "Markdown-formatted AI feedback..." }
```

---

## 🔌 Socket.io Events

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `join-room` | `{ roomId, username, language }` | Join or create a room |
| `code-change` | `{ roomId, code }` | Broadcast code update |
| `language-change` | `{ roomId, language, code }` | Change room language |
| `cursor-move` | `{ roomId, username, position }` | Share cursor position |
| `chat-message` | `{ roomId, username, message }` | Send chat message |
| `pause-user` | `{ roomId, targetUsername }` | Owner: pause a member |
| `unpause-user` | `{ roomId, targetUsername }` | Owner: unpause a member |
| `kick-user` | `{ roomId, targetUsername }` | Owner: remove a member |
| `transfer-ownership` | `{ roomId, targetUsername }` | Owner: transfer host role |
| `select-problem` | `{ roomId, problemId }` | Owner: load a DSA problem |
| `submit-solution` | `{ roomId, code, language }` | Submit solution |
| `leave-room` | `{ roomId, username }` | Leave the room |

### Server → Client

| Event | Payload | Purpose |
|---|---|---|
| `room-joined` | `{ users, code, language, roomId }` | Initial room state |
| `room-full` | `{ message }` | Room at 4 user capacity |
| `user-joined` | `{ username, users, color, isHost }` | New user joined |
| `user-left` | `{ username, users, isKicked }` | User left or was kicked |
| `code-updated` | `{ code }` | Another user changed code |
| `cursor-updated` | `{ username, position, color }` | Remote cursor moved |
| `chat-received` | `{ username, message, timestamp }` | New chat message |
| `ownership-transferred` | `{ newOwner, previousOwner, users }` | Host role changed |
| `problem-selected` | `{ problem, code, solvedBy }` | Problem loaded |

---

## 📁 Project Structure

```
collaborative-platform/
├── package.json              ← Root scripts (dev, build, install:all)
├── README.md
├── DOCUMENTATION.md          ← This file
├── docs/
│   └── screenshots/          ← Proof-of-Work screenshots
│       ├── 01_lobby_home.jpg
│       ├── 02_editor_collaborative.jpg
│       ├── 03_ai_analysis_member.jpg
│       ├── 04_ai_analysis_host.jpg
│       └── 05_editor_output_ready.jpg
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── socket.js           ← Socket.io singleton
│       ├── pages/
│       │   ├── Home.jsx        ← Lobby page
│       │   └── Editor.jsx      ← Main editor page
│       ├── components/
│       │   ├── AnalysisPanel.jsx
│       │   ├── ChatPanel.jsx
│       │   ├── LanguageSelector.jsx
│       │   ├── OutputPanel.jsx
│       │   ├── ProblemPanel.jsx
│       │   ├── RoomHeader.jsx
│       │   ├── ThemeContext.jsx
│       │   ├── ThemeToggle.jsx
│       │   └── UserList.jsx
│       ├── constants/
│       │   ├── boilerplates.js
│       │   └── languages.js
│       └── styles/
│           └── pixel.css       ← Global theme tokens & dark/light mode
└── server/
    ├── index.js                ← Express + Socket.io server
    ├── problems.js             ← Built-in DSA problem set
    ├── .env.example
    └── package.json
```

---

## 🚢 Deployment

### Client (Static Host)

Build and deploy to Cloudflare Pages, Vercel, or Netlify:

```bash
cd client
npm run build
# or for Cloudflare Pages from root:
npm run deploy:cf
```

Set environment variables in your hosting dashboard:

```env
VITE_SOCKET_URL=https://your-server-domain.com
VITE_API_URL=https://your-server-domain.com
```

### Server (Node.js Host)

Deploy to Railway, Render, Fly.io, or any VPS that supports WebSockets.

```env
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://your-client-domain.com
JDOODLE_CLIENT_ID=...
JDOODLE_CLIENT_SECRET=...
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=deepseek/deepseek-v4-flash
OPENROUTER_HTTP_REFERER=https://your-client-domain.com
OPENROUTER_APP_TITLE=Collaborative Platform
```

---

## ⚠️ Known Limitations

- Room state is **in-memory only** — lost on server restart
- No user authentication or persistent accounts
- Code execution depends on JDoodle API limits and credentials
- AI analysis depends on OpenRouter key, credits, and model availability
- Max **4 users per room**
- Problem submission is a workflow signal, not an automated judge

---

## 🔧 Troubleshooting

| Issue | Fix |
|---|---|
| Client can't connect to server | Check `VITE_SOCKET_URL` in `client/.env` and `CORS_ORIGINS` in `server/.env` |
| `OpenRouter rate limit reached` | Wait, add credits, or switch `OPENROUTER_MODEL` in `.env` |
| `OpenRouter authentication failed` | Check `OPENROUTER_API_KEY` for typos or extra spaces |
| Code execution fails | Verify `JDOODLE_CLIENT_ID` and `JDOODLE_CLIENT_SECRET`, check usage limits |
| Room is full | Rooms cap at 4 users — create a new room or wait for someone to leave |
| Username already taken | Usernames must be unique per room — choose a different display name |

---

## 🧰 Useful Commands

```bash
# Development
npm run dev             # Start both server + client
npm run install:all     # Install all dependencies

# Client only
cd client
npm run dev             # Dev server at localhost:5173
npm run build           # Production build
npm run preview         # Preview production build
npm run lint            # Run ESLint

# Server only
cd server
npm run dev             # Dev server with nodemon
npm start               # Production start
```

---

## 📝 Development Notes

- Keep all secrets in `.env` files only — never commit them
- Update `.env.example` when adding new environment variables
- Keep Socket.io event names in sync between `server/index.js` and `client/src/pages/Editor.jsx`
- Run `npm run build` before deploying the client
- Restart the server after changing any backend environment variables

---

*Documentation generated: June 2026*
