import { IPC } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getService } from '@shared/instantiation/instantiationService'
import { IComposerService } from '@shared/services'

export function registerComposerHandlers(): void {
  // Start a new composer swarm task
  handleWithTimeout(IPC.COMPOSER_START, IPC_TIMEOUT.short, (_event, req: { goal: string, workspacePath: string }): void => {
    void getService(IComposerService).startComposerTask(req.goal, req.workspacePath)
  })

  // Cancel/Abort active task
  handleWithTimeout(IPC.COMPOSER_CANCEL, IPC_TIMEOUT.short, (): void => {
    getService(IComposerService).cancelActiveTask()
  })

  // Approve and apply changes
  handleWithTimeout(IPC.COMPOSER_APPROVE, IPC_TIMEOUT.short, (): void => {
    getService(IComposerService).approveChanges()
  })

  // Reject and clear changes
  handleWithTimeout(IPC.COMPOSER_REJECT, IPC_TIMEOUT.short, (): void => {
    getService(IComposerService).rejectChanges()
  })

  // Fetch proposed vs original content for diff view
  handleWithTimeout('composer:diff-preview', IPC_TIMEOUT.short, (_event, req: { filePath: string }): { original: string, proposed: string } => {
    return getService(IComposerService).getStagedFileContent(req.filePath)
  })
}
