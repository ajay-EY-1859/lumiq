import { ICollaborationService } from '@shared/services'
import { CollaborationState, TimelineAction } from '@shared/types'
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions'
import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import * as crypto from 'crypto'

export class CollaborationService implements ICollaborationService {
  private state: CollaborationState = {
    roomId: '',
    roomName: '',
    users: [],
    active: false
  }

  private passcode = ''
  private timeline: TimelineAction[] = []
  private currentUser = 'Developer'

  async createRoom(roomName: string, passcode?: string): Promise<{ roomId: string; inviteCode: string }> {
    const roomId = uuidv4()
    const inviteCode = `LUMIQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    
    this.state = {
      roomId,
      roomName,
      users: [this.currentUser],
      active: true
    }
    
    this.passcode = passcode || 'default-secret'
    this.timeline = []
    
    this.logTimelineAction(this.currentUser, `created room "${roomName}"`)
    this.broadcastState()
    
    return { roomId, inviteCode }
  }

  async joinRoom(inviteCode: string, user: string): Promise<boolean> {
    if (!inviteCode) return false
    
    // Simulate joining a room
    this.currentUser = user
    this.state = {
      roomId: uuidv4(),
      roomName: `Shared TeamSpace (${inviteCode})`,
      users: Array.from(new Set([...this.state.users, 'AI Assistant', user])),
      active: true
    }
    
    this.logTimelineAction(user, `joined the room via invite code ${inviteCode}`)
    this.broadcastState()
    return true
  }

  async leaveRoom(): Promise<void> {
    const user = this.currentUser
    this.logTimelineAction(user, 'left the room')
    
    this.state = {
      roomId: '',
      roomName: '',
      users: [],
      active: false
    }
    this.passcode = ''
    this.broadcastState()
  }

  getRoomState(): CollaborationState {
    return { ...this.state }
  }

  broadcastCursor(filePath: string, line: number, column: number): void {
    if (!this.state.active) return
    
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (window) {
      window.webContents.send('collaboration:cursor-sync', {
        user: 'AI Assistant',
        filePath: filePath.replace(/\\/g, '/'),
        line: Math.max(1, line + (Math.random() > 0.5 ? 1 : -1)), // simulate other user typing nearby
        column: Math.max(1, column + 2)
      })
    }
  }

  sendChangePacket(filePath: string, changeText: string, range: any): void {
    if (!this.state.active) return
    
    this.logTimelineAction('AI Assistant', `applied change packet to: ${filePath.split('/').pop()}`)
    
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (window) {
      window.webContents.send('collaboration:change-packet', {
        user: 'AI Assistant',
        filePath: filePath.replace(/\\/g, '/'),
        changeText,
        range
      })
    }
  }

  getTimeline(): TimelineAction[] {
    return [...this.timeline]
  }

  logTimelineAction(user: string, action: string): void {
    const item: TimelineAction = {
      id: uuidv4(),
      timestamp: new Date().toLocaleTimeString(),
      user,
      action
    }
    this.timeline.push(item)
    
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (window) {
      window.webContents.send('collaboration:timeline-update', item)
    }
  }

  encryptPayload(payload: string): string {
    const secret = this.passcode || 'default-secret'
    const key = crypto.createHash('sha256').update(secret).digest()
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let encrypted = cipher.update(payload, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return JSON.stringify({
      iv: iv.toString('hex'),
      ciphertext: encrypted,
      authTag
    })
  }

  decryptPayload(cipher: string): string {
    try {
      const parsed = JSON.parse(cipher)
      if (parsed && parsed.iv && parsed.ciphertext && parsed.authTag) {
        const secret = this.passcode || 'default-secret'
        const key = crypto.createHash('sha256').update(secret).digest()
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'hex'))
        decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'))
        let decrypted = decipher.update(parsed.ciphertext, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
      }
    } catch {
      // Try legacy XOR decrypt fallback
    }

    try {
      const key = this.passcode || 'default-secret'
      const binary = Buffer.from(cipher, 'base64').toString('binary')
      let payload = ''
      for (let i = 0; i < binary.length; i++) {
        const charCode = binary.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        payload += String.fromCharCode(charCode)
      }
      return payload
    } catch {
      return '[ERROR] Decryption failed. Invalid passcode.'
    }
  }

  private broadcastState(): void {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (window) {
      window.webContents.send('collaboration:state-update', this.state)
    }
  }
}

registerSingleton(ICollaborationService, CollaborationService, InstantiationType.Delayed)
