import { Crown, User, Pause, Play, X, UserPlus } from 'lucide-react'

function UserList({ users, currentUser, isHost, onPauseUser, onUnpauseUser, onKickUser, onTransferOwnership, compact = false }) {
  if (!users || users.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <h3 className="text-retro-text text-[10px] mb-3 uppercase flex items-center gap-2 opacity-70 tracking-widest pl-1">
          <User className="w-3.5 h-3.5" />
          PLAYERS <span className="opacity-50">(0/4)</span>
        </h3>
        <div className="text-retro-text text-[10px] opacity-60 text-center py-4 border border-dashed border-retro-border/40 rounded-lg bg-retro-panel/30">
          NO PLAYERS CONNECTED
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-retro-text text-[10px] mb-3 uppercase flex items-center gap-2 opacity-70 tracking-widest pl-1">
        <User className="w-3.5 h-3.5" />
        PLAYERS <span className="opacity-50">({users.length}/4)</span>
      </h3>
      
      <div className="space-y-2">
        {users.map((user) => {
          const isCurrentUser = user.username === currentUser
          const isOwner = user.role === 'owner' || user.isHost
          
          return (
            <div
              key={user.id || user.username}
              className={`
                flex items-center gap-2 p-2 rounded-lg border transition-all duration-200
                ${user.isPaused
                  ? 'border-red-500/30 bg-red-500/5 opacity-70'
                  : isCurrentUser 
                    ? 'border-retro-cyan/60 bg-retro-cyan/10 shadow-sm' 
                    : 'border-retro-border/20 bg-retro-panel/20 hover:border-retro-border/50 hover:bg-retro-panel/50'
                }
                ${isOwner ? 'border-retro-yellow/30 bg-retro-yellow/5' : ''}
              `}
            >
              {/* User Color Indicator */}
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                style={{ 
                  backgroundColor: user.isPaused ? '#6b7280' : (user.color || '#3b82f6'),
                  boxShadow: user.isPaused ? 'none' : `0 0 8px ${user.color || '#3b82f6'}40`
                }}
              ></div>

              {/* Username and Status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span 
                    className={`text-[10px] truncate ${isCurrentUser ? 'font-bold' : ''}`}
                    style={{ color: user.isPaused ? '#6b7280' : (isCurrentUser ? (user.color || '#0ea5e9') : 'rgb(var(--color-text))') }}
                  >
                    {user.username}
                  </span>
                  {isOwner && (
                    <Crown className="w-3 h-3 text-retro-yellow flex-shrink-0" />
                  )}
                </div>
                
                {/* User badges */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {isOwner && (
                    <span className="text-retro-yellow text-[8px] uppercase tracking-wider bg-retro-yellow/20 px-1.5 py-0.5 rounded font-semibold">
                      OWNER
                    </span>
                  )}
                  {!isOwner && user.role === 'member' && (
                    <span className="text-retro-cyan/70 text-[8px] uppercase tracking-wider bg-retro-cyan/10 px-1.5 py-0.5 rounded">
                      MEMBER
                    </span>
                  )}
                  {isCurrentUser && (
                    <span className="text-retro-cyan text-[8px] uppercase tracking-wider bg-retro-cyan/20 px-1.5 py-0.5 rounded">
                      YOU
                    </span>
                  )}
                  {user.isPaused && (
                    <span className="text-red-400 text-[8px] uppercase tracking-wider bg-red-400/20 px-1.5 py-0.5 rounded animate-pulse">
                      PAUSED
                    </span>
                  )}
                </div>
              </div>

              {/* Owner Controls */}
              {isOwner && !isCurrentUser && (
                <div className="flex-shrink-0 flex items-center gap-1">
                  {/* Transfer Ownership */}
                  {!compact && (
                    <button
                      onClick={() => onTransferOwnership(user.username)}
                      className="p-1.5 rounded hover:bg-retro-yellow/10 transition-colors text-retro-yellow"
                      title={`Transfer ownership to ${user.username}`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* Kick */}
                  <button
                    onClick={() => onKickUser(user.username)}
                    className="p-1.5 rounded hover:bg-red-500/10 transition-colors text-red-400"
                    title={`Kick ${user.username}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Member Controls (owner only, not on self) */}
              {!isOwner && isHost && !isCurrentUser && (
                <div className="flex-shrink-0">
                  {user.isPaused ? (
                    <button
                      onClick={() => onUnpauseUser(user.username)}
                      className="p-1.5 rounded hover:bg-emerald-500/10 transition-colors text-emerald-400"
                      title={`Unpause ${user.username}`}
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onPauseUser(user.username)}
                      className="p-1.5 rounded hover:bg-red-500/10 transition-colors text-red-400"
                      title={`Pause ${user.username}`}
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Connection Status */}
              <div className="flex-shrink-0">
                <div className={`w-1.5 h-1.5 rounded-full ${user.isPaused ? 'bg-red-400' : 'bg-emerald-400 shadow-[0_0_4px_#10b981]'}`}></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Role Legend - Only show on desktop */}
      {!compact && (
        <div className="mt-4 pt-3 border-t border-retro-border/30">
          <div className="text-retro-text/50 text-[8px] uppercase tracking-wider mb-2 px-1">ROLES</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[9px] text-retro-text/60">
              <Crown className="w-3 h-3 text-retro-yellow" />
              <span>Owner - Full control</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] text-retro-text/60">
              <User className="w-3 h-3 text-retro-cyan" />
              <span>Member - Can edit code</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty slots - Only show on desktop */}
      {!compact && users.length < 4 && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 - users.length }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-dashed border-retro-border/30 bg-retro-panel/30 opacity-70"
            >
              <div className="w-3 h-3 rounded-full border border-dashed border-retro-border/40"></div>
              <span className="text-retro-text text-[9px] tracking-widest uppercase opacity-40">WAITING...</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default UserList
