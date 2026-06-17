import { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, Terminal, Hash, Sparkles, Maximize2, Minimize2 } from 'lucide-react'

function ChatPanel({ messages, onSendMessage, currentUser, onFullscreen, isFullscreen = false }) {
  const [newMessage, setNewMessage] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const quickEmojis = ['👍', '✅', '❌', '🔥', '💯', '🎉', '🤔', '💡', '👏', '🚀']

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isFullscreen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isFullscreen])

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    onSendMessage(newMessage.trim())
    setNewMessage('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const insertEmoji = (emoji) => {
    setNewMessage(prev => prev + emoji)
    setShowEmoji(false)
    inputRef.current?.focus()
  }

  const getUserColor = (username) => {
    const colors = {
      'SYSTEM': { bg: 'bg-retro-yellow/20', text: 'text-retro-yellow', border: 'border-retro-yellow/30' },
      'OWNER': { bg: 'bg-retro-yellow/20', text: 'text-retro-yellow', border: 'border-retro-yellow/30' }
    }
    return colors[username] || { bg: 'bg-retro-cyan/10', text: 'text-retro-cyan', border: 'border-retro-cyan/30' }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const [hours, minutes] = timestamp.split(':')
    return `${hours}:${minutes}`
  }

  const getInitials = (username) => {
    if (username === 'SYSTEM') return 'SYS'
    return username.slice(0, 2).toUpperCase()
  }

  return (
    <div className={`flex flex-col h-full min-h-0 app-panel ${isFullscreen ? 'fixed inset-4 z-50 rounded-xl border-2 border-retro-cyan/40 shadow-2xl shadow-black/50' : ''}`}>
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 border-b border-retro-border/50 bg-retro-panel/70">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Terminal className={`w-4 h-4 ${isFullscreen ? 'text-retro-accent' : 'text-retro-cyan'}`} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
          </div>
          <h3 className={`text-[10px] font-bold uppercase tracking-wider ${isFullscreen ? 'text-retro-accent' : 'text-retro-text'}`}>
            {isFullscreen ? 'FULLSCREEN CHAT' : 'LIVE CHAT'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Hash className="w-3 h-3 text-retro-text/40" />
            <span className="text-retro-text/60 text-[9px]">{messages.length}</span>
          </div>
          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="icon-button p-1.5"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="relative mb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isFullscreen ? 'bg-retro-accent/10' : 'bg-retro-cyan/10'}`}>
                <MessageSquare className={`w-8 h-8 ${isFullscreen ? 'text-retro-accent/50' : 'text-retro-cyan/50'}`} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-retro-accent/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-retro-accent" />
              </div>
            </div>
            <div className={`text-[10px] uppercase tracking-wider font-medium ${isFullscreen ? 'text-retro-accent/50' : 'text-retro-text/50'}`}>
              NO MESSAGES YET
            </div>
            <div className={`text-[8px] mt-1 ${isFullscreen ? 'text-retro-accent/30' : 'text-retro-text/30'}`}>
              Start the conversation!
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isSystem = message.isSystem
            const isOwn = message.username === currentUser
            const colors = getUserColor(message.username)
            const showAvatar = !isSystem && (index === 0 || messages[index - 1]?.username !== message.username)
            
            return (
              <div key={`${message.timestamp}-${index}`} className="group">
                {isSystem ? (
                  <div className="flex justify-center my-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-retro-panel/80 rounded-full border border-retro-border/40">
                      <div className="w-1.5 h-1.5 rounded-full bg-retro-yellow animate-pulse"></div>
                      <span className="text-[9px] text-retro-text/60 uppercase tracking-wider">
                        {message.message}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`flex gap-2 ${showAvatar ? 'mt-3' : 'mt-1'}`}>
                    {/* Avatar */}
                    {showAvatar ? (
                      <div className={`w-8 h-8 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <span className={`text-[9px] font-bold ${colors.text}`}>
                          {getInitials(message.username)}
                        </span>
                      </div>
                    ) : (
                      <div className="w-8 flex-shrink-0"></div>
                    )}
                    
                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      {showAvatar && (
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className={`text-[11px] font-bold ${isOwn ? 'text-retro-cyan' : 'text-retro-text/90'}`}>
                            {message.username}
                          </span>
                          <span className="text-retro-text/30 text-[8px]">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      )}
                      
                      <div className={`px-3 py-2 rounded-xl shadow-sm ${
                        isOwn 
                          ? 'bg-retro-cyan/15 border border-retro-cyan/30 rounded-tl-sm' 
                          : 'bg-retro-panel/70 border border-retro-border/40 rounded-tl-sm'
                      }`}>
                        <p className={`text-[12px] leading-relaxed ${isOwn ? 'text-retro-cyan/90' : 'text-retro-text/90'}`}>
                          {message.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-retro-border/30 bg-retro-panel/30">
        {/* Quick Emoji Bar */}
        {showEmoji && (
          <div className="flex flex-wrap gap-1 mb-2 p-2 bg-retro-bg/60 rounded-lg border border-retro-border/40">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded border border-transparent hover:border-retro-border/40 hover:bg-retro-surface/70 transition-colors text-base"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              maxLength={200}
              className={`w-full border rounded-lg px-3 py-2.5 text-[11px] placeholder:${isFullscreen ? 'text-retro-accent/30' : 'text-retro-text/30'} focus:outline-none transition-colors pr-16 ${
                isFullscreen 
                  ? 'bg-retro-accent/10 border-retro-accent/40 text-retro-accent focus:border-retro-accent/70' 
                  : 'bg-retro-surface border-retro-border/60 text-retro-text focus:border-retro-cyan/70'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${showEmoji ? 'text-retro-cyan' : 'text-retro-text/40 hover:text-retro-text/60'}`}
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
          
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className={`px-4 py-2.5 border rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              isFullscreen
                ? 'bg-retro-accent/20 hover:bg-retro-accent/30 border-retro-accent/30 text-retro-accent'
                : 'bg-retro-cyan/20 hover:bg-retro-cyan/30 border-retro-cyan/30 text-retro-cyan'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        
        {/* Character Counter */}
        <div className="flex justify-between items-center mt-1.5 px-1">
          <span className={`text-[8px] ${isFullscreen ? 'text-retro-accent/30' : 'text-retro-text/30'}`}>Press Enter to send</span>
          <span className={`text-[8px] ${newMessage.length > 180 ? 'text-red-400' : isFullscreen ? 'text-retro-accent/30' : 'text-retro-text/30'}`}>
            {newMessage.length}/200
          </span>
        </div>
      </div>

      {/* Fullscreen backdrop */}
      {isFullscreen && (
        <div className="absolute inset-0 bg-black/20 -z-10 rounded-xl" />
      )}
    </div>
  )
}

export default ChatPanel
