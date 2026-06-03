// ═══════════════════════════════════════════════════════════════════
// Lumiq — Local Embedding Generation Worker Thread
// Offloads heavy Transformers.js/ONNX inference from main event loop.
// ═══════════════════════════════════════════════════════════════════

import { parentPort } from 'worker_threads'

let pipelineInstance: any = null

async function getLocalPipeline(): Promise<any> {
  if (pipelineInstance) {
    return pipelineInstance
  }

  try {
    const { pipeline } = await import('@xenova/transformers')
    console.log('[EmbeddingWorker] Loading offline embedding model "Xenova/all-MiniLM-L6-v2" in worker thread...')
    pipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    console.log('[EmbeddingWorker] Local embedding model loaded successfully in worker thread!')
    return pipelineInstance
  } catch (err) {
    console.error('[EmbeddingWorker] Failed to load @xenova/transformers in worker:', err)
    throw err
  }
}

if (parentPort) {
  parentPort.on('message', async (data: { id: string; text: string }) => {
    try {
      const pipeline = await getLocalPipeline()
      if (!pipeline) {
        throw new Error('Pipeline failed to initialize')
      }

      const output = await pipeline(data.text, { pooling: 'mean', normalize: true })
      const vector = Array.from(output.data) as number[]
      
      parentPort!.postMessage({ id: data.id, vector })
    } catch (err) {
      parentPort!.postMessage({ id: data.id, error: (err as Error).message })
    }
  })
}
