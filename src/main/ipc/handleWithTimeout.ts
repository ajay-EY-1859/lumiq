import { ipcMain, IpcMainInvokeEvent } from 'electron'

type Handler<TArgs extends unknown[], TResult> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => TResult | Promise<TResult>

export const IPC_TIMEOUT = {
  short: 10_000,
  long: 60_000
} as const

export function handleWithTimeout<TArgs extends unknown[], TResult>(
  channel: string,
  timeoutMs: number,
  handler: Handler<TArgs, TResult>
): void {
  ipcMain.handle(channel, async (event, ...args: TArgs) => {
    let timeoutId: NodeJS.Timeout | undefined

    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`IPC handler "${channel}" timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    try {
      return await Promise.race([Promise.resolve(handler(event, ...args)), timeout])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  })
}
