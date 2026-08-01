// ═══════════════════════════════════════════════════════════════════
// Lumiq — Collaboration Room UI Component (Milestone 31)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'

interface CollaborationRoomProps {
  onBack: () => void
}

type RoomState = {
  roomId: string
  roomName: string
  users: string[]
  active: boolean
}

type TimelineItem = {
  id: string
  timestamp: string
  user: string
  action: string
}

export function CollaborationRoom({ onBack }: CollaborationRoomProps): React.JSX.Element {
  const [roomState, setRoomState] = useState<RoomState>({
    roomId: '',
    roomName: '',
    users: [],
    active: false
  })
  
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  
  // Create room inputs
  const [createRoomName, setCreateRoomName] = useState('')
  const [createPasscode, setCreatePasscode] = useState('')
  const [createdInviteCode, setCreatedInviteCode] = useState('')
  
  // Join room inputs
  const [joinInviteCode, setJoinInviteCode] = useState('')
  const [joinUser, setJoinUser] = useState('Developer')
  
  // Encryption Playground inputs
  const [plainText, setPlainText] = useState('')
  const [cipherText, setCipherText] = useState('')
  const [decryptedText, setDecryptedText] = useState('')
  
  // Sync Status
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [cursorPresence, setCursorPresence] = useState<{ user: string; filePath: string; line: number; column: number } | null>(null)
  
  // Load initial state and set up event listeners
  useEffect(() => {
    // Get initial state
    window.electronAPI.collaboration.getRoomState().then((state) => {
      setRoomState(state)
    })
    
    window.electronAPI.collaboration.getTimeline().then((tl) => {
      setTimeline(tl.reverse()) // show newest first
    })

    // Listen to updates from main process
    const unsubscribeState = window.electronAPI.collaboration.onStateUpdate((state) => {
      setRoomState(state)
      if (!state.active) {
        setCreatedInviteCode('')
      }
    })

    const unsubscribeTimeline = window.electronAPI.collaboration.onTimelineUpdate((action) => {
      setTimeline((prev) => [action, ...prev])
    })

    const unsubscribeCursor = window.electronAPI.collaboration.onCursorSync((presence) => {
      setCursorPresence(presence)
      setSyncStatus(`Syncing cursors...`)
      const timer = setTimeout(() => setSyncStatus(null), 3000)
      return () => clearTimeout(timer)
    })

    const unsubscribeChange = window.electronAPI.collaboration.onChangePacket((packet) => {
      setSyncStatus(`Received CRDT change packet from ${packet.user}!`)
      const timer = setTimeout(() => setSyncStatus(null), 3500)
      return () => clearTimeout(timer)
    })

    return () => {
      unsubscribeState()
      unsubscribeTimeline()
      unsubscribeCursor()
      unsubscribeChange()
    }
  }, [])

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createRoomName) return
    try {
      const res = await window.electronAPI.collaboration.createRoom(createRoomName, createPasscode)
      setCreatedInviteCode(res.inviteCode)
      // refresh timeline
      const tl = await window.electronAPI.collaboration.getTimeline()
      setTimeline(tl.reverse())
    } catch (err) {
      console.error('Failed to create room:', err)
    }
  }

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinInviteCode || !joinUser) return
    try {
      const success = await window.electronAPI.collaboration.joinRoom(joinInviteCode, joinUser)
      if (success) {
        const state = await window.electronAPI.collaboration.getRoomState()
        setRoomState(state)
        const tl = await window.electronAPI.collaboration.getTimeline()
        setTimeline(tl.reverse())
      }
    } catch (err) {
      console.error('Failed to join room:', err)
    }
  }

  const handleLeaveRoom = async () => {
    try {
      await window.electronAPI.collaboration.leaveRoom()
      setRoomState({ roomId: '', roomName: '', users: [], active: false })
      setTimeline([])
    } catch (err) {
      console.error('Failed to leave room:', err)
    }
  }

  const handleEncrypt = async () => {
    if (!plainText) return
    try {
      const res = await window.electronAPI.collaboration.encrypt(plainText)
      setCipherText(res)
    } catch (err) {
      console.error('Encryption failed:', err)
    }
  }

  const handleDecrypt = async () => {
    if (!cipherText) return
    try {
      const res = await window.electronAPI.collaboration.decrypt(cipherText)
      setDecryptedText(res)
    } catch (err) {
      console.error('Decryption failed:', err)
    }
  }

  const handleSimulateCursor = () => {
    window.electronAPI.collaboration.broadcastCursor('src/main/index.ts', 240, 10)
  }

  const handleSimulateChange = () => {
    window.electronAPI.collaboration.sendChangePacket('src/main/index.ts', '  // Simulated CRDT package broadcast', {
      startLineNumber: 243,
      startColumn: 1,
      endLineNumber: 243,
      endColumn: 1
    })
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[var(--bg-primary)] p-6 custom-scrollbar flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤝</span>
            <h1 className="text-2xl font-extrabold text-white">Collaboration Hub</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Establish secure end-to-end encrypted rooms, coordinate with peers, and inspect CRDT edit timelines.
          </p>
        </div>
        <button
          onClick={onBack}
          className="py-2 px-4 rounded-lg bg-white/5 border border-[var(--border)] text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
        >
          ← Hub Dashboard
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start min-h-0 overflow-y-visible">
        
        {/* Left Column: Management / Presence */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {!roomState.active ? (
            <>
              {/* Create Room Panel */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
                <h2 className="text-sm font-bold text-white mb-4">Create TeamSpace Room</h2>
                <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                      Room Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apollo Project"
                      value={createRoomName}
                      onChange={(e) => setCreateRoomName(e.target.value)}
                      className="py-2 px-3 bg-black/40 border border-[var(--border)] rounded-lg text-xs text-white outline-none focus:border-indigo-500/50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                      Passcode (For Payload XOR-Cipher)
                    </label>
                    <input
                      type="password"
                      placeholder="Enter secure password"
                      value={createPasscode}
                      onChange={(e) => setCreatePasscode(e.target.value)}
                      className="py-2 px-3 bg-black/40 border border-[var(--border)] rounded-lg text-xs text-white outline-none focus:border-indigo-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition cursor-pointer"
                  >
                    🚀 Establish Room
                  </button>
                </form>
              </div>

              {/* Join Room Panel */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
                <h2 className="text-sm font-bold text-white mb-4">Join Room via Invite Code</h2>
                <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                      Invite Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LUMIQ-XYZ123"
                      value={joinInviteCode}
                      onChange={(e) => setJoinInviteCode(e.target.value)}
                      className="py-2 px-3 bg-black/40 border border-[var(--border)] rounded-lg text-xs text-white uppercase outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                      Your Display Name
                    </label>
                    <input
                      type="text"
                      value={joinUser}
                      onChange={(e) => setJoinUser(e.target.value)}
                      className="py-2 px-3 bg-black/40 border border-[var(--border)] rounded-lg text-xs text-white outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg font-bold text-xs text-white bg-purple-600 hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-500/10 transition cursor-pointer"
                  >
                    🤝 Join TeamSpace
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              {/* Room Details & Presence */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-white">Active Room</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                    SECURED
                  </span>
                </div>
                
                <div className="mb-4">
                  <div className="text-xs text-[var(--text-muted)]">Room Name</div>
                  <div className="text-lg font-extrabold text-white">{roomState.roomName}</div>
                </div>

                <div className="mb-4">
                  <div className="text-xs text-[var(--text-muted)]">Room ID</div>
                  <div className="text-[10px] font-mono bg-black/30 p-1.5 rounded text-indigo-300 select-all overflow-x-auto">
                    {roomState.roomId}
                  </div>
                </div>

                {createdInviteCode && (
                  <div className="mb-4 bg-indigo-950/20 border border-indigo-500/20 p-3 rounded-lg">
                    <div className="text-xs text-indigo-400 font-bold">Invite Code</div>
                    <div className="text-xl font-mono font-black text-white mt-1 tracking-wider">
                      {createdInviteCode}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">Share this code with teammates to invite them.</div>
                  </div>
                )}

                <div className="mb-6">
                  <div className="text-xs text-[var(--text-muted)] mb-2">Active Team Members ({roomState.users.length})</div>
                  <div className="flex flex-col gap-1.5">
                    {roomState.users.map((user) => (
                      <div key={user} className="flex items-center gap-2 text-xs text-slate-200 bg-white/5 py-1.5 px-3 rounded-lg border border-white/5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-semibold">{user}</span>
                        {user === joinUser && <span className="text-[9px] text-[var(--text-muted)] ml-auto">(You)</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleLeaveRoom}
                  className="w-full py-2 rounded-lg font-bold text-xs text-white bg-red-600/20 border border-red-500/30 hover:bg-red-600/40 hover:text-white transition cursor-pointer"
                >
                  🚪 Leave Room
                </button>
              </div>

              {/* Simulation Center */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
                <h2 className="text-sm font-bold text-white mb-2">Simulate Real-time Sync</h2>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Manually trigger cursor sync events or CRDT packet transmissions to test listeners.
                </p>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleSimulateCursor}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-lg border border-slate-700 transition cursor-pointer"
                  >
                    🖱️ Simulate Cursor Sync
                  </button>
                  <button
                    onClick={handleSimulateChange}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-lg border border-slate-700 transition cursor-pointer"
                  >
                    📝 Send CRDT Change Packet
                  </button>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Right Columns: Playgrounds & Timelines */}
        <div className="lg:col-span-2 flex flex-col gap-6 h-full min-h-0">
          
          {/* Sync status overlay if present */}
          {syncStatus && (
            <div className="py-2.5 px-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-2 animate-bounce">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {syncStatus}
            </div>
          )}

          {cursorPresence && (
            <div className="py-2 px-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-lg text-[11px] font-mono">
              📍 **Presence Location:** {cursorPresence.user} at `{cursorPresence.filePath}` (L{cursorPresence.line}, C{cursorPresence.column})
            </div>
          )}

          {/* XOR cipher playground */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex flex-col">
            <h2 className="text-sm font-bold text-white mb-1">Encrypted Payload Playground</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Test the cyclical XOR cipher utilizing your room passcode. Note: Encryption handles serialization safety via Base64.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Encrypt side */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Plaintext Payload</label>
                <textarea
                  rows={3}
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  placeholder="Type sensitive message here..."
                  className="p-2 bg-black/40 border border-[var(--border)] rounded-lg text-xs text-white font-mono outline-none resize-none focus:border-indigo-500/50"
                />
                <button
                  onClick={handleEncrypt}
                  disabled={!roomState.active}
                  className="py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-xs font-bold text-white rounded-lg transition cursor-pointer"
                >
                  🔒 Encrypt String
                </button>
              </div>

              {/* Decrypt side */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Base64 Ciphertext</label>
                <textarea
                  rows={3}
                  value={cipherText}
                  onChange={(e) => setCipherText(e.target.value)}
                  placeholder="Paste base64 ciphertext here..."
                  className="p-2 bg-black/40 border border-[var(--border)] rounded-lg text-xs text-white font-mono outline-none resize-none focus:border-indigo-500/50"
                />
                <button
                  onClick={handleDecrypt}
                  disabled={!roomState.active}
                  className="py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-xs font-bold text-white rounded-lg transition cursor-pointer"
                >
                  🔓 Decrypt Cipher
                </button>
              </div>
            </div>

            {decryptedText && (
              <div className="mt-4 p-3 bg-black/30 border border-[var(--border)] rounded-lg">
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">Decrypted Output</div>
                <div className={`text-xs font-mono ${decryptedText.startsWith('[ERROR]') ? 'text-red-400' : 'text-emerald-400 font-semibold'}`}>
                  {decryptedText}
                </div>
              </div>
            )}
          </div>

          {/* Interactive timeline */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex flex-col flex-1 min-h-[250px]">
            <h2 className="text-sm font-bold text-white mb-3 shrink-0">System Collaboration Timeline</h2>

            <div className="flex-1 bg-black/45 border border-[var(--border)] rounded-lg p-4 font-mono text-xs text-slate-300 overflow-y-auto custom-scrollbar select-text">
              {timeline.length === 0 ? (
                <div className="text-[var(--text-muted)] italic text-center py-8">
                  No activity logged. {roomState.active ? 'Perform activities or simulate events above.' : 'Establish/Join a room to activate.'}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {timeline.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 border-b border-white/5 pb-2 last:border-0">
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0 bg-white/5 px-1.5 py-0.5 rounded">
                        {item.timestamp}
                      </span>
                      <span className="text-indigo-400 font-bold shrink-0">{item.user}</span>
                      <span className="text-slate-300">{item.action}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
