import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import toast from 'react-hot-toast'
import socketService from '../socket'
import RoomHeader from '../components/RoomHeader'
import UserList from '../components/UserList'
import ChatPanel from '../components/ChatPanel'
import LanguageSelector from '../components/LanguageSelector'
import OutputPanel from '../components/OutputPanel'
import AnalysisPanel from '../components/AnalysisPanel'
import ProblemPanel from '../components/ProblemPanel'
import SUPPORTED_LANGUAGES from '../constants/languages'
import { getBoilerplate } from '../constants/boilerplates'
import { useTheme } from '../components/useTheme'
import { 
  Copy, Download, Maximize2, Minimize2, Settings, 
  Keyboard, Save, Check, Wifi, WifiOff, BookOpen,
  Users, MessageSquare, Terminal, ChevronRight, Menu, Crown
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Languages that support execution via Judge0
const EXECUTABLE_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust']

function EditorPage() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const username = searchParams.get('username')
  const initialLanguage = searchParams.get('language') || 'javascript'
  
  // State
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState(initialLanguage)
  const [users, setUsers] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [isJoining, setIsJoining] = useState(true)
  const [cursors, setCursors] = useState({})
  const [chatMessages, setChatMessages] = useState([])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [executionResult, setExecutionResult] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [editorFontSize, setEditorFontSize] = useState(14)
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [currentProblem, setCurrentProblem] = useState(null)
  const [solvedProblems, setSolvedProblems] = useState([])
  const [showProblemPanel, setShowProblemPanel] = useState(true)
  const [showChatPanel, setShowChatPanel] = useState(true)
  const [chatFullscreen, setChatFullscreen] = useState(false)
  const [bottomPanelHeight, setBottomPanelHeight] = useState(250)
  const [activeMobileTab, setActiveMobileTab] = useState('editor')
  const [mobileBottomSheet, setMobileBottomSheet] = useState(null)
  const { theme } = useTheme()
  
  // Refs
  const editorRef = useRef(null)
  const socketRef = useRef(null)
  const isCodeSyncingRef = useRef(false)
  const codeUpdateTimeoutRef = useRef(null)
  const cursorUpdateTimeoutRef = useRef(null)
  const decorationsRef = useRef([])

  // Watch for cursor updates and render them in Monaco
  useEffect(() => {
    if (!editorRef.current || !window.monaco) return

    const editor = editorRef.current
    const newDecorations = []

    // Map each remote cursor to a Monaco decoration
    Object.entries(cursors).forEach(([user, cursorData]) => {
      // Don't render our own cursor
      if (user === username) return
      
      const { position, color } = cursorData
      if (position && position.lineNumber && position.column) {
        // Create a unique class name for this user's cursor
        const cursorClassName = `cursor-${user.replace(/[^a-zA-Z0-9]/g, '-')}`
        
        // Add dynamic style for this specific cursor color
        let styleEl = document.getElementById(`style-${cursorClassName}`)
        if (!styleEl) {
          styleEl = document.createElement('style')
          styleEl.id = `style-${cursorClassName}`
          // We define a block cursor that takes the height of the line, and a ::before pseudo-element for the nametag
          styleEl.innerHTML = `
            .${cursorClassName} {
              border-left: 2px solid ${color} !important;
              position: relative;
              z-index: 10;
            }
            .${cursorClassName}::before {
              content: '${user}';
              position: absolute;
              top: -16px;
              left: -2px;
              background-color: ${color};
              color: white;
              font-family: 'Press Start 2P', cursive;
              font-size: 8px;
              padding: 2px 6px;
              border-radius: 4px;
              white-space: nowrap;
              z-index: 10;
              pointer-events: none;
            }
          `
          document.head.appendChild(styleEl)
        }

        newDecorations.push({
          range: new window.monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          options: {
            className: cursorClassName,
            stickiness: window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        })
      }
    })

    // Apply decorations and save their IDs so we can remove/update them later
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations)
  }, [cursors, username])

  // Initialize socket connection
  useEffect(() => {
    if (!username || !roomId) {
      toast.error('MISSING USERNAME OR ROOM ID!')
      navigate('/')
      return
    }

    const socket = socketService.connect()
    socketRef.current = socket

    // Socket event handlers
    const handleConnect = () => {
      console.log('Connected to server')
      setIsConnected(true)
      socket.emit('join-room', { roomId, username, language: initialLanguage })
    }

    const handleDisconnect = () => {
      console.log('Disconnected from server')
      setIsConnected(false)
      toast.error('DISCONNECTED FROM SERVER!')
    }

    const handleRoomJoined = (data) => {
      console.log('Room joined:', data)
      setUsers(data.users || [])
      setCode(data.code || '')
      setLanguage(data.language || 'javascript')
      setIsJoining(false)
      toast.success(`JOINED ROOM ${roomId}!`)
      
      // Add welcome message
      const currentUserData = data.users?.find(u => u.username === username)
      const roleMessage = currentUserData?.role === 'owner' || currentUserData?.isHost 
        ? 'the ROOM OWNER' 
        : 'a MEMBER'
      setChatMessages(prev => [...prev, {
        username: 'SYSTEM',
        message: `Welcome to room ${roomId}! You are ${roleMessage}.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleRoomFull = (data) => {
      console.log('Room full:', data)
      toast.error(data.message || 'ROOM IS FULL!')
      setTimeout(() => navigate('/'), 2000)
    }

    const handleUsernameTaken = (data) => {
      console.log('Username taken:', data)
      toast.error(data.message || 'USERNAME ALREADY TAKEN!')
      setTimeout(() => navigate('/'), 2000)
    }

    const handleUserJoined = (data) => {
      console.log('User joined:', data)
      setUsers(data.users || [])
      toast.success(`${data.username} JOINED THE ROOM!`)
      
      setChatMessages(prev => [...prev, {
        username: 'SYSTEM',
        message: `${data.username} joined the room! ${data.isHost ? '(OWNER)' : '(MEMBER)'}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleUserLeft = (data) => {
      console.log('User left:', data)
      setUsers(data.users || [])
      toast(`${data.username} LEFT THE ROOM`, { icon: '👋' })
      
      // Remove user's cursor
      setCursors(prev => {
        const newCursors = { ...prev }
        delete newCursors[data.username]
        return newCursors
      })

      // Clean up cursor style element
      const cursorClassName = `cursor-${data.username.replace(/[^a-zA-Z0-9]/g, '-')}`
      const styleEl = document.getElementById(`style-${cursorClassName}`)
      if (styleEl) {
        styleEl.remove()
      }

      setChatMessages(prev => [...prev, {
        username: 'SYSTEM', 
        message: `${data.username} left the room.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleCodeUpdated = (data) => {
      if (isCodeSyncingRef.current) return
      console.log('Code updated from server')
      isCodeSyncingRef.current = true
      setCode(data.code || '')
      setTimeout(() => {
        isCodeSyncingRef.current = false
      }, 100)
    }

    const handleLanguageUpdated = (data) => {
      if (isCodeSyncingRef.current) return
      console.log('Language updated:', data.language)
      setLanguage(data.language || 'javascript')
      if (data.code) {
        isCodeSyncingRef.current = true
        setCode(data.code)
        setTimeout(() => {
          isCodeSyncingRef.current = false
        }, 100)
      }
      toast(`LANGUAGE CHANGED TO ${data.language.toUpperCase()}!`)
    }

    const handleCursorUpdated = (data) => {
      setCursors(prev => ({
        ...prev,
        [data.username]: {
          position: data.position,
          color: data.color
        }
      }))
    }

    const handleChatReceived = (data) => {
      setChatMessages(prev => [...prev, {
        username: data.username,
        message: data.message,
        timestamp: data.timestamp,
        isSystem: false
      }])
    }

    const handleUserPaused = (data) => {
      setUsers(data.users || [])
      if (data.targetUsername === username) {
        setIsPaused(true)
        toast('⛔ YOU HAVE BEEN PAUSED BY THE HOST', { icon: '⏸️' })
      } else {
        toast(`${data.targetUsername} HAS BEEN PAUSED`, { icon: '⏸️' })
      }
    }

    const handleUserUnpaused = (data) => {
      setUsers(data.users || [])
      if (data.targetUsername === username) {
        setIsPaused(false)
        toast.success('YOU HAVE BEEN UNPAUSED!')
      } else {
        toast(`${data.targetUsername} HAS BEEN UNPAUSED`, { icon: '▶️' })
      }
    }

    const handleUserKicked = (data) => {
      setUsers(data.users || [])
      toast.error(`${data.targetUsername} WAS KICKED BY ${data.kickedBy}!`)
      setChatMessages(prev => [...prev, {
        username: 'SYSTEM',
        message: `${data.targetUsername} was kicked by ${data.kickedBy}.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleKickedFromRoom = (data) => {
      toast.error('YOU HAVE BEEN KICKED FROM THE ROOM!')
      setTimeout(() => navigate('/'), 2000)
    }

    const handleOwnershipTransferred = (data) => {
      setUsers(data.users || [])
      if (data.newOwner === username) {
        toast.success('YOU ARE NOW THE ROOM OWNER!')
      } else {
        toast(`${data.newOwner} IS NOW THE ROOM OWNER`, { icon: '👑' })
      }
      setChatMessages(prev => [...prev, {
        username: 'SYSTEM',
        message: `Ownership transferred from ${data.previousOwner} to ${data.newOwner}.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleNewOwner = (data) => {
      setUsers(data.users || [])
      toast(`${data.newOwner} IS NOW THE ROOM OWNER`, { icon: '👑' })
      setChatMessages(prev => [...prev, {
        username: 'SYSTEM',
        message: `${data.newOwner} is now the room owner.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleActionBlocked = (data) => {
      toast.error(data.message || 'ACTION BLOCKED!')
    }

    const handleProblemSelected = (data) => {
      console.log('Problem selected:', data.problem)
      setCurrentProblem(data.problem)
      if (data.solvedBy) {
        setSolvedProblems(data.solvedBy)
      }
      if (data.code) {
        isCodeSyncingRef.current = true
        setCode(data.code)
        setTimeout(() => {
          isCodeSyncingRef.current = false
        }, 100)
      }
      toast(`PROBLEM: ${data.problem.title}`, { icon: '📋' })
      
      setChatMessages(prev => [...prev, {
        username: 'SYSTEM',
        message: `Problem selected: ${data.problem.title} (${data.problem.difficulty})`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleProblemSolved = (data) => {
      console.log('Problem solved:', data)
      setSolvedProblems(data.solvedProblems)
      toast.success(`${data.problemTitle} SOLVED BY ${data.solvedBy}! 🏆`)
      
      setChatMessages(prev => [...prev, {
        username: 'SYSTEM',
        message: `🎉 ${data.problemTitle} solved by ${data.solvedBy}!`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleProblemReset = (data) => {
      console.log('Problem reset')
      if (data.code) {
        isCodeSyncingRef.current = true
        setCode(data.code)
        setTimeout(() => {
          isCodeSyncingRef.current = false
        }, 100)
      }
      toast('PROBLEM RESET TO BOILERPLATE')
    }

    const handleSubmissionResult = (data) => {
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    }

    // Register event listeners
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('room-joined', handleRoomJoined)
    socket.on('room-full', handleRoomFull)
    socket.on('username-taken', handleUsernameTaken)
    socket.on('user-joined', handleUserJoined)
    socket.on('user-left', handleUserLeft)
    socket.on('code-updated', handleCodeUpdated)
    socket.on('language-updated', handleLanguageUpdated)
    socket.on('cursor-updated', handleCursorUpdated)
    socket.on('chat-received', handleChatReceived)
    socket.on('user-paused', handleUserPaused)
    socket.on('user-unpaused', handleUserUnpaused)
    socket.on('user-kicked', handleUserKicked)
    socket.on('kicked-from-room', handleKickedFromRoom)
    socket.on('ownership-transferred', handleOwnershipTransferred)
    socket.on('new-owner', handleNewOwner)
    socket.on('action-blocked', handleActionBlocked)
    socket.on('problem-selected', handleProblemSelected)
    socket.on('problem-solved', handleProblemSolved)
    socket.on('problem-reset', handleProblemReset)
    socket.on('submission-result', handleSubmissionResult)

    // Connect if already connected
    if (socket.connected) {
      handleConnect()
    }

    // Cleanup
    return () => {
      if (codeUpdateTimeoutRef.current) {
        clearTimeout(codeUpdateTimeoutRef.current)
      }
      if (cursorUpdateTimeoutRef.current) {
        clearTimeout(cursorUpdateTimeoutRef.current)
      }
      
      // Leave room before disconnecting
      if (socket.connected) {
        socket.emit('leave-room', { roomId, username })
      }
      
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('room-joined', handleRoomJoined)
      socket.off('room-full', handleRoomFull)
      socket.off('username-taken', handleUsernameTaken)
      socket.off('user-joined', handleUserJoined)
      socket.off('user-left', handleUserLeft)
      socket.off('code-updated', handleCodeUpdated)
      socket.off('language-updated', handleLanguageUpdated)
      socket.off('cursor-updated', handleCursorUpdated)
      socket.off('chat-received', handleChatReceived)
      socket.off('user-paused', handleUserPaused)
      socket.off('user-unpaused', handleUserUnpaused)
      socket.off('user-kicked', handleUserKicked)
      socket.off('kicked-from-room', handleKickedFromRoom)
      socket.off('ownership-transferred', handleOwnershipTransferred)
      socket.off('new-owner', handleNewOwner)
      socket.off('action-blocked', handleActionBlocked)
      socket.off('problem-selected', handleProblemSelected)
      socket.off('problem-solved', handleProblemSolved)
      socket.off('problem-reset', handleProblemReset)
      socket.off('submission-result', handleSubmissionResult)
      
      socketService.disconnect()
    }
  }, [roomId, username, initialLanguage, navigate])

  // Handle editor changes
  const handleEditorChange = (value) => {
    setCode(value || '')
    
    // Debounce code updates to avoid spamming the server
    if (codeUpdateTimeoutRef.current) {
      clearTimeout(codeUpdateTimeoutRef.current)
    }
    
    codeUpdateTimeoutRef.current = setTimeout(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('code-change', { roomId, code: value || '' })
      }
    }, 300)
  }

  // Handle cursor position changes
  const handleCursorPositionChange = (e) => {
    if (!editorRef.current || !socketRef.current?.connected) return

    const position = e.position
    if (position) {
      // Debounce cursor updates
      if (cursorUpdateTimeoutRef.current) {
        clearTimeout(cursorUpdateTimeoutRef.current)
      }
      
      cursorUpdateTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('cursor-move', { 
          roomId, 
          username, 
          position: {
            lineNumber: position.lineNumber,
            column: position.column
          }
        })
      }, 150)
    }
  }

  // Handle language change — inject boilerplate code for the selected language
  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage)

    // If there's a current problem, use its boilerplate
    let boilerplate;
    if (currentProblem?.boilerplate?.[newLanguage]) {
      boilerplate = currentProblem.boilerplate[newLanguage]
    } else if (currentProblem?.boilerplate?.javascript) {
      boilerplate = currentProblem.boilerplate.javascript
    } else {
      boilerplate = getBoilerplate(newLanguage)
    }
    
    setCode(boilerplate)

    if (socketRef.current?.connected) {
      socketRef.current.emit('language-change', { roomId, language: newLanguage, code: boilerplate })
    }
  }

  // Handle code execution via Judge0
  const handleRunCode = async () => {
    if (isRunning || !EXECUTABLE_LANGUAGES.includes(language)) return

    setIsRunning(true)
    setExecutionResult(null)

    try {
      const response = await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      })

      const data = await response.json()

      if (!response.ok) {
        setExecutionResult({ error: data.error, details: data.details })
        toast.error('EXECUTION FAILED!')
      } else {
        setExecutionResult(data)
        if (data.status?.id === 3) {
          toast.success('CODE EXECUTED SUCCESSFULLY!')
        } else {
          toast(`EXECUTION: ${data.status?.description?.toUpperCase() || 'DONE'}`, { icon: '⚠️' })
        }
      }
    } catch (err) {
      setExecutionResult({ error: 'Network error', details: err.message })
      toast.error('FAILED TO REACH SERVER!')
    } finally {
      setIsRunning(false)
    }
  }

  // Clear execution output
  const handleClearOutput = () => {
    setExecutionResult(null)
  }

  // Handle AI code analysis
  const handleAnalyzeCode = async () => {
    if (isAnalyzing) return

    setIsAnalyzing(true)
    setAnalysisResult(null)

    try {
      const compilerOutput = executionResult
        ? [executionResult.stdout, executionResult.stderr, executionResult.compile_output].filter(Boolean).join('\n')
        : null

      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, compilerOutput }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAnalysisResult(`Error: ${data.error || 'Analysis failed'}`)
        toast.error('ANALYSIS FAILED!')
      } else {
        setAnalysisResult(data.analysis)
        toast.success('ANALYSIS COMPLETE!')
      }
    } catch (err) {
      setAnalysisResult(`Error: ${err.message}`)
      toast.error('FAILED TO REACH SERVER!')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClearAnalysis = () => {
    setAnalysisResult(null)
  }

  // Handle pause/unpause
  const handlePauseUser = (targetUsername) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('pause-user', { roomId, targetUsername })
    }
  }

  const handleUnpauseUser = (targetUsername) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unpause-user', { roomId, targetUsername })
    }
  }

  const handleKickUser = (targetUsername) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('kick-user', { roomId, targetUsername })
    }
  }

  const handleTransferOwnership = (targetUsername) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('transfer-ownership', { roomId, targetUsername })
    }
  }

  // Handle problem selection
  const handleSelectProblem = (problemId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('select-problem', { roomId, problemId })
    }
  }

  const handleSelectRandomProblem = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('select-random-problem', { roomId })
    }
  }

  const handleResetProblem = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('reset-problem', { roomId })
    }
  }

  const handleMarkSolved = (problemId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('mark-solved', { roomId, problemId })
    }
  }

  const handleSubmitSolution = () => {
    if (socketRef.current?.connected && currentProblem) {
      socketRef.current.emit('submit-solution', { roomId, code, language })
    }
  }

  // Handle sending chat messages
  const handleSendMessage = (message) => {
    if (socketRef.current?.connected && message.trim()) {
      socketRef.current.emit('chat-message', { 
        roomId, 
        username, 
        message: message.trim() 
      })
    }
  }

  // Handle leaving the room
  const handleLeaveRoom = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-room', { roomId, username })
    }
    navigate('/')
  }

  // Handle editor mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor
    
    // Define custom dark theme (retro gaming)
    monaco.editor.defineTheme('retro-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '10b981', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc', fontStyle: 'bold' },
        { token: 'string', foreground: 'fbbf24' },
        { token: 'number', foreground: 'f472b6' },
        { token: 'type', foreground: '22d3ee' },
        { token: 'function', foreground: '60a5fa' },
        { token: 'variable', foreground: 'e2e8f0' },
        { token: 'constant', foreground: 'fb923c' },
      ],
      colors: {
        'editor.background': '#070c18',
        'editor.foreground': '#e5edf6',
        'editor.lineHighlightBackground': '#132033',
        'editorCursor.foreground': '#2dd4bf',
        'editor.selectionBackground': '#0f766e80',
        'editorLineNumber.foreground': '#60718c',
        'editorLineNumber.activeForeground': '#2dd4bf',
        'editor.selectionHighlightBackground': '#2dd4bf30',
        'editorIndentGuide.background': '#26364d',
        'editorIndentGuide.activeBackground': '#3d506d',
        'editorBracketMatch.background': '#2dd4bf2f',
        'editorBracketMatch.border': '#2dd4bf',
        'editorGutter.background': '#070c18',
        'minimap.background': '#070c18',
        'scrollbarSlider.background': '#33415580',
        'scrollbarSlider.hoverBackground': '#47556990',
        'scrollbarSlider.activeBackground': '#64748baa',
      }
    });

    // Define custom light theme - Clear & Visible
    monaco.editor.defineTheme('retro-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '059669', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7c3aed', fontStyle: 'bold' },
        { token: 'string', foreground: 'b45309' },
        { token: 'number', foreground: 'c026d3' },
        { token: 'type', foreground: '0891b2' },
        { token: 'function', foreground: '2563eb' },
        { token: 'variable', foreground: '1e293b' },
        { token: 'constant', foreground: 'dc2626' },
        { token: 'operator', foreground: '4f46e5' },
        { token: 'delimiter', foreground: '64748b' },
        { token: 'delimiter.bracket', foreground: '475569' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#0f172a',
        'editor.lineHighlightBackground': '#eef6fb',
        'editorCursor.foreground': '#087ea4',
        'editor.selectionBackground': '#bae6fd',
        'editorLineNumber.foreground': '#94a3b8',
        'editorLineNumber.activeForeground': '#087ea4',
        'editor.selectionHighlightBackground': '#cffafe',
        'editorIndentGuide.background': '#e2e8f0',
        'editorIndentGuide.activeBackground': '#cbd5e1',
        'editorBracketMatch.background': '#bae6fd80',
        'editorBracketMatch.border': '#087ea4',
        'editorGutter.background': '#f8fafc',
        'minimap.background': '#ffffff',
        'editor.findMatchBackground': '#fde04780',
        'editor.findMatchHighlightBackground': '#fde04740',
        'editorWidget.background': '#f8fafc',
        'editorWidget.border': '#cbd5e1',
        'input.background': '#ffffff',
        'input.border': '#cbd5e1',
        'input.foreground': '#1e293b',
        'dropdown.background': '#ffffff',
        'dropdown.border': '#cbd5e1',
        'list.activeSelectionBackground': '#e0f2fe',
        'list.hoverBackground': '#f1f5f9',
        'scrollbar.shadow': '#00000010',
        'scrollbarSlider.background': '#cbd5e180',
        'scrollbarSlider.hoverBackground': '#94a3b880',
        'scrollbarSlider.activeBackground': '#64748b80',
      }
    });
    
    // Set up cursor position change listener
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({ line: e.position.lineNumber, column: e.position.column })
      handleCursorPositionChange(e)
    })
    
    // Configure editor with smooth animations
    editor.updateOptions({
      fontSize: editorFontSize,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Courier New", monospace',
      fontLigatures: true,
      minimap: { enabled: true, scale: 1 },
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      mouseWheelZoom: true,
      padding: { top: 16, bottom: 16 },
      lineHeight: 1.6,
      letterSpacing: 0.5,
      cursorStyle: 'line',
      cursorWidth: 2,
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      trimAutoWhitespace: true,
      formatOnPaste: true,
      formatOnType: true,
      folding: true,
      foldingHighlight: true,
      showFoldingControls: 'mouseover',
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'all',
      selectOnLineNumbers: true,
      roundedSelection: true,
      readOnly: isPaused,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      snippetSuggestions: 'top',
    })

    // Set initial theme
    monaco.editor.setTheme(theme === 'dark' ? 'retro-dark' : 'retro-light')
  }

  // Update editor font size
  const updateEditorFontSize = useCallback((size) => {
    setEditorFontSize(size)
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize: size })
    }
  }, [])

  // Update monaco theme when context theme changes
  useEffect(() => {
    if (editorRef.current && window.monaco) {
      window.monaco.editor.setTheme(theme === 'dark' ? 'retro-dark' : 'retro-light')
    }
  }, [theme])

  // Fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout()
      }
    }, 100)
  }

  // Copy code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('CODE COPIED!')
    } catch {
      toast.error('FAILED TO COPY!')
    }
  }

  // Download code as file
  const handleDownloadCode = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === language)
    const extension = lang?.extension || 'txt'
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `code.${extension}`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CODE DOWNLOADED!')
  }

  // Auto-save indicator
  useEffect(() => {
    if (code && !isCodeSyncingRef.current) {
      setIsSaving(true)
      const timer = setTimeout(() => {
        setIsSaving(false)
        setLastSaved(new Date())
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [code])

  const getCurrentLanguageLabel = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === language)
    return lang ? lang.label : 'JavaScript'
  }

  const getCurrentMonacoLanguage = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === language)
    return lang ? lang.monacoId : 'javascript'
  }

  const formatLastSaved = () => {
    if (!lastSaved) return ''
    const now = new Date()
    const diff = Math.floor((now - lastSaved) / 1000)
    if (diff < 60) return 'Saved'
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`
    return `Saved ${Math.floor(diff / 3600)}h ago`
  }

  if (isJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-retro-bg">
        <div className="pixel-panel text-center px-8 py-6 animate-pulse-slow">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-retro-cyan border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-retro-accent/30 rounded-full"></div>
            </div>
          </div>
          <div className="text-retro-cyan text-sm mb-2 font-bold tracking-wider">
            JOINING SESSION {roomId}
          </div>
          <div className="text-retro-text/60 text-[10px] tracking-widest uppercase">
            AUTHENTICATING AS {username}...
          </div>
          <div className="mt-4 flex justify-center gap-1">
            <span className="w-2 h-2 bg-retro-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-retro-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-retro-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen flex flex-col bg-retro-bg text-retro-text transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Fullscreen Exit Button */}
      {isFullscreen && (
        <div className="absolute top-4 right-4 z-[60]">
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-lg bg-retro-surface/80 backdrop-blur-sm border border-retro-cyan/30 hover:bg-retro-panel transition-all shadow-lg"
            title="Exit Fullscreen (F11)"
          >
            <Minimize2 className="w-5 h-5 text-retro-cyan" />
          </button>
        </div>
      )}

      {/* Header - Desktop Only */}
      {!isFullscreen && (
        <div className="hidden lg:block">
          <RoomHeader
            roomId={roomId}
            users={users}
            currentUser={username}
            isConnected={isConnected}
            onLeaveRoom={handleLeaveRoom}
          />
        </div>
      )}

      {/* Mobile Header */}
      {!isFullscreen && (
        <div className="lg:hidden app-header flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileBottomSheet('users')}
              className="icon-button p-2"
            >
              <Users className="w-5 h-5 text-retro-cyan" />
            </button>
            <div>
              <div className="text-sm text-retro-cyan font-bold">{roomId}</div>
              <div className="text-xs text-retro-text/50 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <LanguageSelector
              currentLanguage={language}
              onLanguageChange={handleLanguageChange}
              languages={SUPPORTED_LANGUAGES}
              compact
            />
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-red-500/20 text-red-400 text-xs rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Bottom Sheet Overlay */}
        {mobileBottomSheet && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setMobileBottomSheet(null)}
          />
        )}

        {/* Sidebar - Desktop Only */}
        <div className={`
          hidden lg:flex app-surface border-r transition-all duration-300 flex-col overflow-hidden
          ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-72 opacity-100'}
        `}>
          {/* Sidebar Toggle */}
          <div className="flex items-center justify-center py-1.5 border-b border-retro-border/50 bg-retro-panel/50">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="icon-button p-1.5"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${!isSidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {!isSidebarCollapsed && (
            <>
              {/* User List - Scrollable */}
              <div className="p-4 border-b border-retro-border/70 flex-shrink-0 max-h-[210px] overflow-y-auto custom-scrollbar">
                <UserList
                  users={users}
                  currentUser={username}
                  isHost={users.find(u => u.username === username)?.isHost}
                  onPauseUser={handlePauseUser}
                  onUnpauseUser={handleUnpauseUser}
                  onKickUser={handleKickUser}
                  onTransferOwnership={handleTransferOwnership}
                />
              </div>

              {/* Chat Panel */}
              <div className="flex-1 flex flex-col min-h-0">
                <ChatPanel
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                  currentUser={username}
                  onFullscreen={chatFullscreen ? () => setChatFullscreen(false) : () => setChatFullscreen(true)}
                  isFullscreen={false}
                />
              </div>
            </>
          )}
        </div>

        {/* Main Area - Editor + Bottom Panels */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Editor Toolbar */}
          <div className="app-header flex items-center justify-between gap-3 px-4 py-2">
            {/* Left Section */}
            <div className="flex items-center gap-4">
              {/* Language & Problem */}
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 bg-retro-cyan/10 text-retro-cyan text-xs font-bold rounded-lg border border-retro-cyan/40 shadow-sm">
                  {getCurrentLanguageLabel()}
                </span>
                
                {currentProblem && (
                  <button
                    onClick={() => setShowProblemPanel(!showProblemPanel)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-retro-yellow/10 text-retro-yellow border border-retro-yellow/40 hover:bg-retro-yellow/20 transition-colors shadow-sm"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span className="text-xs font-bold">{currentProblem.title}</span>
                    <span className="text-[10px] opacity-70">({currentProblem.difficulty})</span>
                  </button>
                )}
              </div>

              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                isConnected ? 'text-emerald-500 dark:text-emerald-400 bg-emerald-400/10 border-emerald-400/30' : 'text-red-500 dark:text-red-400 bg-red-400/10 border-red-400/30'
              }`}>
                {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>

              {/* Save Status */}
              {isSaving ? (
                <span className="text-amber-400 flex items-center gap-2 text-xs">
                  <Save className="w-4 h-4 animate-pulse" />
                  Saving...
                </span>
              ) : lastSaved && (
                <span className="text-emerald-400/60 flex items-center gap-2 text-xs">
                  <Check className="w-4 h-4" />
                  Saved
                </span>
              )}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              {/* Cursor Position */}
              <div className="hidden md:flex items-center gap-3 text-xs text-retro-text/50 mr-3">
                <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
                <span>|</span>
                <span>{code.split('\n').length} lines</span>
              </div>

              {/* Tool Buttons */}
              <div className="flex items-center gap-1">
                {/* Settings */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="icon-button p-2"
                    title="Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  {showSettings && (
                    <div className="absolute right-0 top-full mt-2 app-panel rounded-lg p-4 shadow-xl z-30 min-w-[200px] animate-fade-in">
                      <div className="text-xs text-retro-text/70 mb-3 uppercase tracking-wider font-bold">Font Size</div>
                      <div className="flex items-center justify-center gap-4">
                        <button
                          onClick={() => updateEditorFontSize(Math.max(10, editorFontSize - 2))}
                          className="w-10 h-10 rounded-lg bg-retro-panel hover:bg-retro-border/30 border border-retro-border flex items-center justify-center text-lg font-bold"
                        >
                          -
                        </button>
                        <span className="text-retro-cyan font-bold text-lg w-12 text-center">{editorFontSize}px</span>
                        <button
                          onClick={() => updateEditorFontSize(Math.min(24, editorFontSize + 2))}
                          className="w-10 h-10 rounded-lg bg-retro-panel hover:bg-retro-border/30 border border-retro-border flex items-center justify-center text-lg font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCopyCode}
                  className="icon-button p-2"
                  title="Copy Code"
                >
                  <Copy className="w-4 h-4" />
                </button>

                <button
                  onClick={handleDownloadCode}
                  className="icon-button p-2"
                  title="Download Code"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowShortcuts(!showShortcuts)}
                  className="icon-button p-2"
                  title="Keyboard Shortcuts"
                >
                  <Keyboard className="w-4 h-4" />
                </button>

                {!isFullscreen && (
                  <button
                    onClick={toggleFullscreen}
                    className="icon-button p-2"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-retro-border/30 mx-2"></div>

              {/* Run & Analyze Buttons */}
              <div className="flex items-center gap-2">
                <button
                  id="run-code-button"
                  onClick={handleRunCode}
                  disabled={isRunning || !EXECUTABLE_LANGUAGES.includes(language)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all ${
                    EXECUTABLE_LANGUAGES.includes(language)
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-retro-panel text-retro-text/40 border border-retro-border/50 cursor-not-allowed'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Running
                    </>
                  ) : (
                    <>
                      <span className="text-base">▶</span> Run
                    </>
                  )}
                </button>

                <button
                  id="analyze-code-button"
                  onClick={handleAnalyzeCode}
                  disabled={isAnalyzing || !code.trim()}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all ${
                    code.trim() ? 'bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/20' : 'bg-retro-panel text-retro-text/40 border border-retro-border/50 cursor-not-allowed'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Analyzing
                    </>
                  ) : (
                    <>
                      <span>🔍</span> Analyze
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Panel */}
          {showShortcuts && (
            <div className="app-panel border-b border-retro-border px-4 py-3 animate-slide-down">
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                <span className="text-retro-text/50 uppercase tracking-wider mr-2">Shortcuts:</span>
                <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Ctrl+S</kbd>
                <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Ctrl+Z</kbd>
                <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Ctrl+/</kbd>
                <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Ctrl+D</kbd>
                <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Alt+↑↓</kbd>
                <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">F11</kbd>
              </div>
            </div>
          )}

          {/* Players Bar Above Editor - Desktop Only */}
          {!isFullscreen && (
            <div className="hidden lg:flex items-center justify-between px-4 py-2 bg-retro-bg/60 border-b border-retro-border/50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-retro-text/60">
                  <Users className="w-4 h-4 text-retro-cyan" />
                  <span className="font-bold">{users.length} PLAYER{users.length !== 1 ? 'S' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  {users.slice(0, 6).map((user, idx) => (
                    <div
                      key={user.id || idx}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full app-chip"
                    >
                      <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: user.color || '#3b82f6' }}
                      />
                      <span className="text-xs text-retro-text/90">{user.username}</span>
                      {(user.role === 'owner' || user.isHost) && (
                        <Crown className="w-3.5 h-3.5 text-retro-yellow" />
                      )}
                    </div>
                  ))}
                  {users.length > 6 && (
                    <span className="text-xs text-retro-text/40">+{users.length - 6} more</span>
                  )}
                </div>
              </div>
              
              {/* Quick Problem Toggle */}
              {currentProblem && (
                <button
                  onClick={() => setShowProblemPanel(!showProblemPanel)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-retro-yellow/10 text-retro-yellow border border-retro-yellow/20 hover:bg-retro-yellow/20 transition-colors text-xs"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="font-bold">{currentProblem.title}</span>
                </button>
              )}
            </div>
          )}

          {/* Main Editor + Bottom Panels Container */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Monaco Editor */}
            <div className={`flex-1 monaco-editor-container relative transition-all duration-300 ${showProblemPanel && currentProblem ? 'h-1/2' : 'h-full'}`}>
              <Editor
                height="100%"
                language={getCurrentMonacoLanguage()}
                value={code}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                theme={theme === 'dark' ? 'retro-dark' : 'retro-light'}
                options={{
                  fontSize: editorFontSize,
                  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                  fontLigatures: true,
                  minimap: { enabled: window.innerWidth > 768, scale: 1 },
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  renderWhitespace: 'selection',
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  smoothScrolling: true,
                  mouseWheelZoom: true,
                  padding: { top: 12, bottom: 12 },
                  lineHeight: 1.6,
                  letterSpacing: 0.5,
                  cursorStyle: 'line',
                  cursorWidth: 2,
                  tabSize: 2,
                  insertSpaces: true,
                  detectIndentation: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  folding: true,
                  showFoldingControls: 'mouseover',
                  lineNumbersMinChars: 3,
                  renderLineHighlight: 'all',
                  roundedSelection: true,
                  readOnly: isPaused,
                  quickSuggestions: true,
                  suggestOnTriggerCharacters: true,
                }}
              />
              {/* Paused Overlay */}
              {isPaused && (
                <div className="absolute inset-0 bg-retro-bg/80 backdrop-blur-md flex items-center justify-center z-10 pointer-events-none">
                  <div className="bg-retro-surface border-2 border-red-500/50 rounded-xl px-8 py-4 text-center shadow-2xl">
                    <div className="text-red-400 text-sm font-bold mb-1">⛔ YOU ARE PAUSED</div>
                    <div className="text-retro-text/60 text-xs">The host has paused your editing</div>
                  </div>
                </div>
              )}
            </div>

            {/* Problem Panel (Desktop - Bottom Section) */}
            {showProblemPanel && currentProblem && (
              <div className="hidden md:block h-56 border-t border-retro-border overflow-hidden">
                <ProblemPanel
                  problem={currentProblem}
                  solvedProblems={solvedProblems}
                  onSelectProblem={handleSelectProblem}
                  onSelectRandom={handleSelectRandomProblem}
                  onResetProblem={handleResetProblem}
                  isOwner={users.find(u => u.username === username)?.role === 'owner'}
                  onMarkSolved={handleMarkSolved}
                />
              </div>
            )}

            {/* Output & Analysis Panels - Desktop */}
            <div className="hidden md:block">
              <OutputPanel
                result={executionResult}
                isRunning={isRunning}
                onClear={handleClearOutput}
              />
              <AnalysisPanel
                analysis={analysisResult}
                isAnalyzing={isAnalyzing}
                onClear={handleClearAnalysis}
              />
            </div>
          </div>
        </div>

        {/* Click outside to close settings */}
        {showSettings && (
          <div className="fixed inset-0 z-30" onClick={() => setShowSettings(false)} />
        )}

        {/* Fullscreen Chat Overlay */}
        {chatFullscreen && (
          <div className="fixed inset-0 z-50 bg-retro-bg/95 backdrop-blur-sm">
            <ChatPanel
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              currentUser={username}
              onFullscreen={() => setChatFullscreen(false)}
              isFullscreen={true}
            />
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      {!isFullscreen && (
        <div className="lg:hidden app-header flex items-center justify-around py-3 border-t border-retro-border safe-area-bottom">
          <button
            onClick={() => setMobileBottomSheet('users')}
            className="flex flex-col items-center gap-1 px-5 py-2 rounded-xl hover:bg-retro-surface/70 transition-colors"
          >
            <Users className="w-6 h-6 text-retro-cyan" />
            <span className="text-[9px] text-retro-text/70">Users</span>
            <span className="text-[8px] text-retro-text/40">{users.length}</span>
          </button>
          
          <button
            onClick={() => setMobileBottomSheet('problem')}
            className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-colors ${currentProblem ? 'text-retro-yellow' : 'text-retro-text/40'}`}
          >
            <BookOpen className="w-6 h-6" />
            <span className="text-[9px]">Problem</span>
          </button>
          
          <button
            onClick={() => setMobileBottomSheet('output')}
            className="flex flex-col items-center gap-1 px-5 py-2 rounded-xl hover:bg-retro-surface/70 transition-colors"
          >
            <Terminal className="w-6 h-6 text-emerald-400" />
            <span className="text-[9px] text-retro-text/70">Output</span>
          </button>
          
          <button
            onClick={() => setMobileBottomSheet('chat')}
            className="flex flex-col items-center gap-1 px-5 py-2 rounded-xl hover:bg-retro-surface/70 transition-colors"
          >
            <MessageSquare className="w-6 h-6 text-retro-cyan" />
            <span className="text-[9px] text-retro-text/70">Chat</span>
            <span className="text-[8px] text-retro-text/40">{chatMessages.length}</span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Sheets */}
      {mobileBottomSheet === 'users' && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 h-[55vh] app-panel border-t-2 border-retro-cyan/40 rounded-t-3xl z-50 animate-slide-up shadow-2xl">
          <div className="p-4 border-b border-retro-border/30">
            <div className="w-12 h-1.5 bg-retro-border/50 rounded-full mx-auto mb-4"></div>
            <h3 className="text-retro-text text-sm font-bold uppercase tracking-wider text-center">Room Members</h3>
          </div>
          <div className="p-4 overflow-y-auto h-[calc(100%-80px)]">
            <UserList
              users={users}
              currentUser={username}
              isHost={users.find(u => u.username === username)?.isHost}
              onPauseUser={handlePauseUser}
              onUnpauseUser={handleUnpauseUser}
              onKickUser={handleKickUser}
              onTransferOwnership={handleTransferOwnership}
              compact
            />
          </div>
        </div>
      )}

      {mobileBottomSheet === 'problem' && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 h-[65vh] app-panel border-t-2 border-retro-yellow/40 rounded-t-3xl z-50 animate-slide-up shadow-2xl">
          <div className="p-4 border-b border-retro-border/30">
            <div className="w-12 h-1.5 bg-retro-border/50 rounded-full mx-auto mb-4"></div>
            <h3 className="text-retro-text text-sm font-bold uppercase tracking-wider text-center">Problem</h3>
          </div>
          <div className="overflow-y-auto h-[calc(100%-80px)]">
            <ProblemPanel
              problem={currentProblem}
              solvedProblems={solvedProblems}
              onSelectProblem={handleSelectProblem}
              onSelectRandom={handleSelectRandomProblem}
              onResetProblem={handleResetProblem}
              isOwner={users.find(u => u.username === username)?.role === 'owner'}
              onMarkSolved={handleMarkSolved}
            />
          </div>
        </div>
      )}

      {mobileBottomSheet === 'output' && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 h-[55vh] app-panel border-t-2 border-emerald-500/40 rounded-t-3xl z-50 animate-slide-up shadow-2xl">
          <div className="p-4 border-b border-retro-border/30">
            <div className="w-12 h-1.5 bg-retro-border/50 rounded-full mx-auto mb-4"></div>
            <h3 className="text-retro-text text-sm font-bold uppercase tracking-wider text-center">Output</h3>
          </div>
          <div className="overflow-y-auto h-[calc(100%-80px)]">
            <OutputPanel
              result={executionResult}
              isRunning={isRunning}
              onClear={handleClearOutput}
            />
            <AnalysisPanel
              analysis={analysisResult}
              isAnalyzing={isAnalyzing}
              onClear={handleClearAnalysis}
            />
          </div>
        </div>
      )}

      {mobileBottomSheet === 'chat' && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 h-[65vh] app-panel border-t-2 border-retro-cyan/40 rounded-t-3xl z-50 animate-slide-up shadow-2xl">
          <div className="p-4 border-b border-retro-border/30">
            <div className="w-12 h-1.5 bg-retro-border/50 rounded-full mx-auto mb-4"></div>
            <h3 className="text-retro-text text-sm font-bold uppercase tracking-wider text-center">Live Chat</h3>
          </div>
          <div className="h-[calc(100%-80px)]">
            <ChatPanel
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              currentUser={username}
              isFullscreen={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default EditorPage
