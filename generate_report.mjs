import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, ImageRun, PageBreak, BorderStyle,
  WidthType, ShadingType, TableLayoutType, convertInchesToTwip,
  Header, Footer, PageNumberElement
} from "docx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Helper: read image buffer ────────────────────────────────────────────────
function img(filename) {
  return fs.readFileSync(path.join(__dirname, "docs", "screenshots", filename));
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  darkBlue:   "1E3A5F",
  midBlue:    "2563EB",
  lightBlue:  "DBEAFE",
  accent:     "0EA5E9",
  teal:       "0D9488",
  lightGray:  "F3F4F6",
  medGray:    "D1D5DB",
  darkGray:   "374151",
  white:      "FFFFFF",
  tableHead:  "1E3A5F",
  tableAlt:   "EFF6FF",
};

// ─── Font helpers ─────────────────────────────────────────────────────────────
const bold   = (t, sz=22, color=C.darkGray) => new TextRun({ text: t, bold: true,  size: sz, font: "Calibri", color });
const normal = (t, sz=20, color=C.darkGray) => new TextRun({ text: t, bold: false, size: sz, font: "Calibri", color });
const italic = (t, sz=19, color="555555")   => new TextRun({ text: t, italics: true, size: sz, font: "Calibri", color });
const code   = (t, sz=18, color="1E3A5F")   => new TextRun({ text: t, font: "Courier New", size: sz, color, bold: true });

// ─── Paragraph helpers ────────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 44, font: "Calibri", color: C.darkBlue })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 180 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.midBlue, space: 4 } },
  });
}

function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 30, font: "Calibri", color: C.midBlue })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
  });
}

function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, font: "Calibri", color: C.teal })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
  });
}

function para(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing: { before: 60, after: 100 },
    ...opts,
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [normal(text, 20)],
    bullet: { level },
    spacing: { before: 40, after: 40 },
  });
}

function spacer(n = 1) {
  return [...Array(n)].map(() => new Paragraph({ children: [new TextRun("")], spacing: { before: 0, after: 0 } }));
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function captionPara(text) {
  return new Paragraph({
    children: [italic(`Figure: ${text}`, 18, "555555")],
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 160 },
  });
}

function centered(children) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
  });
}

// ─── Table helpers ────────────────────────────────────────────────────────────
function makeCell(text, isHeader = false, isAlt = false) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({
        text,
        bold: isHeader,
        size: isHeader ? 19 : 18,
        font: "Calibri",
        color: isHeader ? C.white : C.darkGray,
      })],
      spacing: { before: 60, after: 60 },
    })],
    shading: isHeader
      ? { fill: C.tableHead, type: ShadingType.CLEAR }
      : isAlt
        ? { fill: C.tableAlt, type: ShadingType.CLEAR }
        : { fill: C.white, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function twoColTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: rows.map((r, i) =>
      new TableRow({
        children: [
          makeCell(r[0], i === 0, i % 2 === 0 && i !== 0),
          makeCell(r[1], i === 0, i % 2 === 0 && i !== 0),
        ],
      })
    ),
  });
}

function threeColTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: rows.map((r, i) =>
      new TableRow({
        children: [
          makeCell(r[0], i === 0, i % 2 === 0 && i !== 0),
          makeCell(r[1], i === 0, i % 2 === 0 && i !== 0),
          makeCell(r[2], i === 0, i % 2 === 0 && i !== 0),
        ],
      })
    ),
  });
}

// ─── Image helper ─────────────────────────────────────────────────────────────
function imageBlock(filename, widthIn = 5.8, heightIn = 3.4) {
  return new Paragraph({
    children: [
      new ImageRun({
        data: img(filename),
        transformation: {
          width:  Math.round(widthIn  * 96),
          height: Math.round(heightIn * 96),
        },
        type: "jpg",
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
  });
}

// ─── COVER PAGE ───────────────────────────────────────────────────────────────
function coverPage() {
  return [
    ...spacer(4),
    centered([bold("COLLABORATIVE PLATFORM", 56, C.darkBlue)]),
    centered([bold("Real-Time Collaborative Code Editor", 28, C.midBlue)]),
    ...spacer(2),
    centered([new TextRun({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", color: C.accent, size: 24, font: "Calibri" })]),
    ...spacer(1),
    centered([bold("PROJECT REPORT", 36, C.darkBlue)]),
    centered([italic("Submitted in partial fulfillment of the project requirements", 22)]),
    ...spacer(2),
    new Table({
      width: { size: 70, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        ["Student Name",        "[YOUR NAME]"],
        ["College / Institute", "[COLLEGE NAME]"],
        ["Department",          "[DEPARTMENT]"],
        ["Submission Date",     "June 2026"],
        ["GitHub Repository",   "[GITHUB LINK]"],
        ["Technology Stack",    "React · Node.js · Socket.io · Monaco Editor"],
        ["Version",             "1.0.0  |  License: MIT"],
      ].map((r, i) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [bold(r[0], 20, C.white)], spacing: { before: 80, after: 80 } })],
              shading: { fill: C.darkBlue, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              width: { size: 35, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ children: [normal(r[1], 20)], spacing: { before: 80, after: 80 } })],
              shading: { fill: i % 2 === 0 ? C.lightGray : C.white, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              width: { size: 65, type: WidthType.PERCENTAGE },
            }),
          ],
        })
      ),
    }),
    ...spacer(2),
    centered([new TextRun({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", color: C.accent, size: 24, font: "Calibri" })]),
    pageBreak(),
  ];
}

// ─── SECTION 1 — Overview ─────────────────────────────────────────────────────
function section1() {
  return [
    h1("1.  Project Overview"),

    h2("1.1  Project Name"),
    para([bold("Collaborative Platform", 22, C.darkBlue), normal(" — Real-Time Collaborative Code Editor with AI-Powered Analysis", 22)]),

    h2("1.2  Problem Statement"),
    para([normal(
      "In modern software development, teams increasingly work in distributed or remote environments. " +
      "Existing collaborative coding tools either require expensive subscriptions (VS Code Live Share, CodePair) " +
      "or lack integrated AI feedback, code execution, and structured problem sets. Students, interviewers, " +
      "and hackathon teams need a free, browser-accessible platform where multiple developers can write, run, " +
      "and discuss code simultaneously — without installing any software.",
    22)]),

    h2("1.3  Objectives"),
    bullet("Design and develop a real-time multi-user code editor using WebSocket technology."),
    bullet("Implement room-based session management supporting up to 4 concurrent users."),
    bullet("Integrate remote code execution for 7+ programming languages via the JDoodle API."),
    bullet("Integrate AI-powered code analysis using the OpenRouter API (DeepSeek v4 Flash model)."),
    bullet("Provide in-room live chat, remote cursor tracking, and room ownership controls."),
    bullet("Include a built-in DSA problem set with multi-language boilerplate code templates."),
    bullet("Deliver a polished, responsive UI with dark/light theme switching."),

    h2("1.4  Target Users"),
    twoColTable([
      ["User Group",           "Use Case"],
      ["CS Students",          "Practice DSA problems collaboratively in a structured environment"],
      ["Interview Candidates", "Conduct mock coding interviews with real-time code sharing"],
      ["Software Developers",  "Pair programming and remote debugging sessions"],
      ["Educators / Mentors",  "Live teaching and code review with students"],
      ["Hackathon Teams",      "Rapid prototyping in a shared, multi-language workspace"],
    ]),
    ...spacer(1),
  ];
}

// ─── SECTION 2 — Tech Stack ───────────────────────────────────────────────────
function section2() {
  return [
    h1("2.  Technology Stack"),
    para([normal(
      "The application is split into a React/Vite client and a Node.js/Express server. Real-time collaboration " +
      "is handled with Socket.io. Remote code execution is powered by the JDoodle API (200 free credits/day) " +
      "and AI analysis by OpenRouter (DeepSeek v4 Flash). No persistent database is used — all room state is " +
      "maintained in server-side in-memory Map structures for zero-overhead development and deployment.",
    22)]),

    h2("Frontend"),
    threeColTable([
      ["Technology",            "Version",   "Purpose"],
      ["React",                 "18.2.0",    "Component-based UI rendering"],
      ["Vite",                  "5.2.0",     "Build tool & dev server"],
      ["React Router DOM",      "6.22.0",    "Client-side routing (/, /room/:roomId)"],
      ["Monaco Editor",         "4.6.0",     "VS Code-grade in-browser code editor"],
      ["Socket.io Client",      "4.7.2",     "Real-time WebSocket communication"],
      ["Tailwind CSS",          "3.4.3",     "Utility-first styling"],
      ["Lucide React",          "0.383.0",   "SVG icon library"],
      ["React Hot Toast",       "2.4.1",     "Toast notifications"],
    ]),
    ...spacer(1),

    h2("Backend"),
    threeColTable([
      ["Technology",   "Version",  "Purpose"],
      ["Node.js",      "18+",      "Server-side JavaScript runtime"],
      ["Express",      "4.18.2",   "HTTP API server and middleware"],
      ["Socket.io",    "4.7.2",    "WebSocket room event management"],
      ["Axios",        "1.13.6",   "External API calls (JDoodle, OpenRouter)"],
      ["Helmet",       "8.1.0",    "HTTP security headers"],
      ["cors",         "2.8.5",    "Cross-origin resource sharing"],
      ["uuid",         "9.0.0",    "Unique 8-char room ID generation"],
      ["dotenv",       "17.3.1",   "Environment variable management"],
      ["nodemon",      "3.0.1",    "Dev server auto-restart"],
    ]),
    ...spacer(1),

    h2("External APIs"),
    twoColTable([
      ["API / Service",                  "Purpose"],
      ["JDoodle Execute API",            "Remote multi-language code compilation and execution (200 credits/day free)"],
      ["OpenRouter Chat Completions",    "AI code analysis using DeepSeek v4 Flash model (credit-based quota)"],
    ]),
  ];
}

// ─── SECTION 3 — Architecture ─────────────────────────────────────────────────
function section3() {
  return [
    h1("3.  System Architecture & Implementation"),

    h2("3.1  Architecture Overview"),
    para([normal(
      "The application follows a Client-Server architecture with WebSocket-based real-time communication. " +
      "The React SPA communicates with the Express server via both REST HTTP calls and persistent Socket.io " +
      "WebSocket connections. The server maintains all shared room state in an in-memory Map and proxies " +
      "code execution and AI analysis requests to external APIs.",
    22)]),

    h2("3.2  API Endpoints"),
    threeColTable([
      ["Endpoint",           "Method", "Description"],
      ["/api/health",        "GET",    "Server status and active room count"],
      ["/api/create-room",   "GET",    "Generates unique 8-char room ID via UUID"],
      ["/api/problems",      "GET",    "Returns built-in DSA problem dataset"],
      ["/api/execute",       "POST",   "Proxies code to JDoodle; returns stdout/stderr/status"],
      ["/api/analyze",       "POST",   "Sends code + output to OpenRouter AI; returns markdown analysis"],
    ]),
    ...spacer(1),

    h2("3.3  Key Socket.io Events"),
    threeColTable([
      ["Event (Client → Server)",  "Event (Server → Client)",   "Purpose"],
      ["join-room",                "room-joined / user-joined",  "Create or join a room; sync state"],
      ["code-change",              "code-updated",               "Broadcast code edits to all members"],
      ["language-change",          "language-updated",           "Change room language and boilerplate"],
      ["cursor-move",              "cursor-updated",             "Share real-time cursor positions"],
      ["chat-message",             "chat-received",              "In-room timestamped chat messages"],
      ["pause-user / kick-user",   "user-paused / user-kicked",  "Owner room management controls"],
      ["transfer-ownership",       "ownership-transferred",      "Delegate host role to another user"],
      ["select-problem",           "problem-selected",           "Load DSA problem with boilerplate"],
      ["leave-room",               "user-left / new-owner",      "Handle departure and owner promotion"],
    ]),
    ...spacer(1),

    h2("3.4  Folder Structure"),
    new Paragraph({
      children: [
        code("collaborative-platform/\n", 18),
      ],
      spacing: { before: 60, after: 0 },
    }),
    ...[
      "├── package.json           ← Root scripts (dev, build, install:all)",
      "├── server/",
      "│   ├── index.js           ← Express + Socket.io server (729 lines)",
      "│   ├── problems.js        ← DSA problem dataset (5 problems, 4 languages)",
      "│   └── .env / .env.example",
      "└── client/src/",
      "    ├── pages/",
      "    │   ├── Home.jsx       ← Lobby: name input, room create / join",
      "    │   └── Editor.jsx     ← Main editor: all state + socket events",
      "    ├── components/        ← ChatPanel, UserList, OutputPanel, AnalysisPanel …",
      "    ├── socket.js          ← Socket.io singleton with auto-reconnect",
      "    └── styles/pixel.css   ← CSS variables, dark/light theme tokens",
    ].map(line => new Paragraph({
      children: [code(line, 17, "374151")],
      spacing: { before: 20, after: 20 },
    })),

    ...spacer(1),

    h2("3.5  Key Implementation Details"),
    bullet("300ms debounce on Monaco Editor onChange prevents socket flooding during fast typing."),
    bullet("Socket singleton (SocketService class) implements exponential backoff — up to 5 reconnect attempts, 1 s → 5 s delay."),
    bullet("Server-side authorization: pause/kick/transfer/problem selection validated on every socket event — not client-side."),
    bullet("Empty rooms auto-deleted after a 60-second cleanup timeout; owner disconnection triggers automatic promotion."),
    bullet("JDoodle responses normalized to { stdout, stderr, status: Accepted / Runtime Error / Time Limit Exceeded }."),
    bullet("OpenRouter prompt: system role defines 4-section markdown output (Issue / Fix / Explanation / Suggestions); temperature 0.3."),
    bullet("Helmet.js enforces HTTP security headers; JSON body size capped at 1 MB; code input capped at 50,000 chars."),
  ];
}

// ─── SECTION 4 — Screenshots ──────────────────────────────────────────────────
function section4() {
  return [
    h1("4.  Project Snapshots"),
    para([normal(
      "The following screenshots were captured during a live 2-user collaborative session " +
      "(developer_1 as Member, developer_2 as Owner/Host) demonstrating the platform's core features.",
    22)]),

    h3("Figure 1 — Lobby / Home Screen"),
    para([normal(
      "The application entry point. Users enter a display name, select a default programming language, " +
      "and either Create Room or Join Room. The features panel highlights Real-Time Sync, 8+ Languages, " +
      "AI Analysis, and Code Execution.",
    21)]),
    imageBlock("01_lobby_home.jpg", 5.8, 3.3),
    captionPara("Home / Lobby Screen — Room creation with display name and language selection"),

    h3("Figure 2 — Live Collaborative Editor (Member View)"),
    para([normal(
      "Two developers sharing the same room session (81D435E5) in real-time. developer_1 is logged in " +
      "as a Member, developer_2 is the Room Owner. The sidebar shows both users with color-coded identifiers. " +
      "The Monaco Editor displays the shared code, and the Output panel shows the accepted stdout.",
    21)]),
    imageBlock("02_editor_collaborative.jpg", 5.8, 3.3),
    captionPara("Collaborative Editor — Member View showing 2/4 Players, live chat, Monaco Editor, and STDOUT output"),

    h3("Figure 3 — AI Code Analysis (Member Perspective)"),
    para([normal(
      "The AI Analysis panel after clicking Analyze. The DeepSeek v4 Flash model returns a structured " +
      "markdown response: No Issues Detected, Suggested Fix, plain-English Explanation, and Improvement Suggestions. " +
      "The Output panel simultaneously shows the accepted Hello, world! output.",
    21)]),
    imageBlock("03_ai_analysis_member.jpg", 5.8, 3.5),
    captionPara("AI Analysis Panel — Member View showing Issue, Fix, Explanation, and Improvement sections"),

    h3("Figure 4 — AI Code Analysis (Host/Owner Perspective)"),
    para([normal(
      "The host view of the same session with the AI analysis panel open. The Live Chat panel shows the " +
      "full join/leave event history (DEVELOPER_1 JOINED THE ROOM, LEFT THE ROOM, JOINED AS MEMBER), " +
      "demonstrating real-time event broadcasting. The Owner crown icon is visible on developer_2.",
    21)]),
    imageBlock("04_ai_analysis_host.jpg", 5.8, 3.5),
    captionPara("AI Analysis Panel — Host View with Owner crown icon, chat history, and AI feedback"),

    h3("Figure 5 — Editor Ready State (Pre-Execution)"),
    para([normal(
      "The editor workspace in its idle state after code has been auto-saved. The Output panel shows " +
      "'OUTPUT READY — Click ▶ Run to execute' and the AI Analysis panel shows its placeholder prompt. " +
      "Monaco displays the cursor position (Ln 4, Col 30 | 4 lines) and both players remain CONNECTED.",
    21)]),
    imageBlock("05_editor_output_ready.jpg", 5.8, 3.5),
    captionPara("Editor Idle State — Saved code, Output Ready, AI Analysis ready, both players Connected"),
  ];
}

// ─── SECTION 5 — Challenges, Testing, Future, Conclusion ─────────────────────
function section5() {
  return [
    h1("5.  Challenges, Testing & Conclusion"),

    h2("5.1  Challenges Faced & Solutions"),
    threeColTable([
      ["Challenge",                         "Impact",          "Solution Implemented"],
      ["Real-time sync without echo loops", "High",            "300 ms debounce + socket.to() excludes sender"],
      ["Cursor tracking across updates",    "Medium",          "Monaco decoration API with per-user hex colors"],
      ["Unexpected owner disconnect",       "High",            "Unified handleUserLeave() promotes room.users[0]"],
      ["Third-party API rate limits",       "Medium",          "Layered error handling: 401/403/429/timeout/500"],
      ["CORS in dev vs. production",        "Medium",          "CORS_ORIGINS env var parsed at runtime"],
      ["In-memory state cleanup",           "Low",             "60-second cleanup timeout on empty rooms"],
    ]),
    ...spacer(1),

    h2("5.2  Testing Summary"),
    para([normal("Manual functional and integration testing was performed with two simultaneous browser sessions.", 22)]),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        ["Test Case",               "Expected",                         "Result"],
        ["Create room",             "8-char room ID, redirect to editor","✅ PASS"],
        ["Join same room",          "Both users in sidebar",            "✅ PASS"],
        ["Code sync",               "User B sees edits within 300 ms",  "✅ PASS"],
        ["Code execution",          "stdout: Hello, world!",            "✅ PASS"],
        ["AI analysis",             "Markdown sections rendered",       "✅ PASS"],
        ["Room full (5th user)",    "room-full toast, join rejected",   "✅ PASS"],
        ["Duplicate username",      "username-taken toast",             "✅ PASS"],
        ["Pause user",              "Paused user edit blocked",         "✅ PASS"],
        ["Kick user",               "User removed, session ends",       "✅ PASS"],
        ["Owner disconnect",        "Next user auto-promoted",          "✅ PASS"],
        ["Theme toggle",            "Dark ↔ Light persisted",           "✅ PASS"],
        ["DSA problem select",      "Boilerplate loads on all clients", "✅ PASS"],
      ].map((r, i) =>
        new TableRow({
          children: r.map(cell => makeCell(cell, i === 0, i % 2 === 0 && i !== 0)),
        })
      ),
    }),
    ...spacer(1),

    h2("5.3  Future Enhancements"),
    bullet("Persistent database (Redis / MongoDB) to survive server restarts."),
    bullet("OAuth-based user authentication (GitHub / Google login)."),
    bullet("Automated test judge for DSA problems against expected outputs."),
    bullet("WebRTC-based voice/video communication within rooms."),
    bullet("Operational Transformation (OT) or CRDT for conflict-free code merging."),
    bullet("Extended language support: Ruby, PHP, Swift, Kotlin via JDoodle."),
    bullet("File system emulation — multiple code files (tabs) per room."),
    bullet("Selectable AI model (GPT-4o, Claude, Gemini) via OpenRouter."),
    ...spacer(1),

    h2("5.4  Learning Outcomes"),
    bullet("Real-Time Systems: WebSocket protocol, Socket.io event architecture, room-based pub/sub broadcasting."),
    bullet("Frontend: React 18 hooks lifecycle, Monaco Editor API, debouncing, performance optimization."),
    bullet("Backend: Express.js REST design, Helmet security, SIGTERM graceful shutdown, middleware chaining."),
    bullet("AI / LLM Integration: OpenRouter API, prompt engineering, structured markdown output, temperature tuning."),
    bullet("DevOps: Vite build config, Cloudflare Pages deployment, Wrangler CLI, environment-based configuration."),
    bullet("Security: Server-side role authorization, CORS whitelisting, request size limits, API key management."),
    ...spacer(1),

    h2("5.5  Conclusion"),
    para([normal(
      "The Collaborative Platform project successfully demonstrates the integration of real-time WebSocket " +
      "communication, cloud-based code execution, and AI-powered code analysis within a single cohesive web " +
      "application. Built from scratch using a modern JavaScript stack — React 18 on the frontend and " +
      "Node.js/Express on the backend — the platform handles complex real-time scenarios including multi-user " +
      "code synchronization, cursor tracking, dynamic ownership transfer, and graceful disconnection handling.",
    22)]),
    para([normal(
      "The project provides direct practical value as a tool for educational, interview, and team collaboration " +
      "contexts. It demonstrates proficiency in full-stack web development, real-time systems architecture, " +
      "API integration, and software engineering best practices. Future development will focus on persistent " +
      "storage, authentication, and automated test judging — transforming the platform into a production-ready " +
      "competitive programming and interview preparation tool.",
    22)]),
    ...spacer(1),

    h2("5.6  How to Run the Project"),
    bullet("Prerequisites: Node.js 18+, npm, JDoodle credentials, OpenRouter API key."),
    new Paragraph({
      children: [
        code("git clone [GITHUB LINK]  &&  npm run install:all", 18, C.darkBlue),
      ],
      spacing: { before: 80, after: 40 },
    }),
    new Paragraph({
      children: [
        code("# Configure server/.env and client/.env, then:", 18, "555555"),
      ],
      spacing: { before: 20, after: 40 },
    }),
    new Paragraph({
      children: [
        code("npm run dev      # Starts server (:3001) + client (:5173) concurrently", 18, C.darkBlue),
      ],
      spacing: { before: 20, after: 80 },
    }),
    bullet("Open http://localhost:5173 in two browser tabs to test collaboration."),

    ...spacer(2),
    new Paragraph({
      children: [new TextRun({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", color: C.medGray, size: 22, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
    }),
    centered([italic("Report prepared by [YOUR NAME] | [COLLEGE NAME] | [DEPARTMENT] | June 2026", 19)]),
  ];
}

// ─── BUILD DOCUMENT ───────────────────────────────────────────────────────────
async function build() {
  const doc = new Document({
    numbering: {
      config: [],
    },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: C.darkGray },
          paragraph: { spacing: { line: 280 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1.0),
              bottom: convertInchesToTwip(1.0),
              left:   convertInchesToTwip(1.0),
              right:  convertInchesToTwip(1.0),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Collaborative Platform  —  Project Report", size: 17, font: "Calibri", color: "999999" }),
                  new TextRun({ text: "\t[YOUR NAME]  |  [COLLEGE NAME]", size: 17, font: "Calibri", color: "999999" }),
                ],
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.medGray, space: 4 } },
                tabStops: [{ type: "right", position: convertInchesToTwip(6.5) }],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Page ", size: 17, font: "Calibri", color: "999999" }),
                  new PageNumberElement(),
                  new TextRun({ text: "  |  Collaborative Platform  ·  Real-Time Code Editor  ·  2026", size: 17, font: "Calibri", color: "999999" }),
                ],
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.medGray, space: 4 } },
              }),
            ],
          }),
        },
        children: [
          ...coverPage(),
          ...section1(),
          pageBreak(),
          ...section2(),
          pageBreak(),
          ...section3(),
          pageBreak(),
          ...section4(),
          pageBreak(),
          ...section5(),
        ],
      },
    ],
  });

  const outPath = path.join(__dirname, "Collaborative_Platform_Project_Report.docx");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Word document created: ${outPath}`);
  console.log(`   Size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

build().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
