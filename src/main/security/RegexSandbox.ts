import { Worker } from 'worker_threads'
import { join } from 'path'

export interface GrepMatch {
  file: string
  line: number
  content: string
}

export class RegexSandbox {
  /**
   * Executes a regex search in a CPU-sandboxed Worker Thread.
   * If the search exceeds the CPU timeout limit (default: 3000ms),
   * the thread is terminated forcefully to prevent Regex DoS (ReDoS).
   *
   * SECURITY: The worker is loaded from a static file (grepWorker.js)
   * rather than an eval'd string.  This eliminates the eval:true flag
   * on the Worker constructor, which would otherwise allow arbitrary
   * code execution if workerData were ever attacker-controlled.
   */
  static runGrep(
    pattern: string,
    searchPath: string,
    includeFilter?: string,
    timeoutMs = 3000
  ): Promise<GrepMatch[]> {
    return new Promise((resolve, reject) => {
      // Resolve the worker script relative to this file so it works both
      // in development (TypeScript source tree) and in the packaged build
      // (compiled output directory).
      const workerPath = join(__dirname, 'grepWorker.js')

      const worker = new Worker(workerPath, {
        workerData: { pattern, searchPath, includeFilter }
      })

      let isTimeout = false

      const timer = setTimeout(async () => {
        isTimeout = true
        await worker.terminate()
        reject(new Error('Regex search timed out due to CPU/ReDoS limit'))
      }, timeoutMs)

      worker.on('message', (msg) => {
        clearTimeout(timer)
        if (msg.status === 'success') {
          resolve(msg.matches)
        } else {
          reject(new Error(msg.error))
        }
      })

      worker.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })

      worker.on('exit', (code) => {
        clearTimeout(timer)
        if (code !== 0 && !isTimeout) {
          reject(new Error(`Worker stopped with exit code ${code}`))
        }
      })
    })
  }
}
