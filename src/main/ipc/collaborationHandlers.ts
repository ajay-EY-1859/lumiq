import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import { getService } from '@shared/instantiation/instantiationService'
import { ICollaborationService } from '@shared/services'

export function registerCollaborationHandlers(): void {
  ipcMain.handle(IPC.COLLABORATION_CREATE_ROOM, async (_event, req: { roomName: string; passcode?: string }) => {
    return await getService(ICollaborationService).createRoom(req.roomName, req.passcode)
  })

  ipcMain.handle(IPC.COLLABORATION_JOIN_ROOM, async (_event, req: { inviteCode: string; user: string }) => {
    return await getService(ICollaborationService).joinRoom(req.inviteCode, req.user)
  })

  ipcMain.handle(IPC.COLLABORATION_LEAVE_ROOM, async () => {
    return await getService(ICollaborationService).leaveRoom()
  })

  ipcMain.handle(IPC.COLLABORATION_GET_STATE, () => {
    return getService(ICollaborationService).getRoomState()
  })

  ipcMain.on(IPC.COLLABORATION_SEND_CURSOR, (_event, req: { filePath: string; line: number; column: number }) => {
    getService(ICollaborationService).broadcastCursor(req.filePath, req.line, req.column)
  })

  ipcMain.on(IPC.COLLABORATION_SEND_CHANGE, (_event, req: { filePath: string; changeText: string; range: any }) => {
    getService(ICollaborationService).sendChangePacket(req.filePath, req.changeText, req.range)
  })

  ipcMain.handle(IPC.COLLABORATION_GET_TIMELINE, () => {
    return getService(ICollaborationService).getTimeline()
  })

  ipcMain.on(IPC.COLLABORATION_LOG_ACTION, (_event, req: { user: string; action: string }) => {
    getService(ICollaborationService).logTimelineAction(req.user, req.action)
  })

  ipcMain.handle(IPC.COLLABORATION_ENCRYPT, (_event, req: { payload: string }) => {
    return getService(ICollaborationService).encryptPayload(req.payload)
  })

  ipcMain.handle(IPC.COLLABORATION_DECRYPT, (_event, req: { cipher: string }) => {
    return getService(ICollaborationService).decryptPayload(req.cipher)
  })
}
