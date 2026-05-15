// ═══════════════════════════════════════════════════════════════════
// Lumiq — ImageReadTool
// Read images and provide base64 encoding for vision models
// ═══════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, statSync } from 'fs'
import { extname } from 'path'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'

const SUPPORTED_FORMATS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'])
const MAX_IMAGE_SIZE = 50 * 1024 * 1024 // 50MB
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml'
}

export class ImageReadTool implements Tool {
  name = 'ImageReadTool'
  description = 'Read images and provide base64 encoding for vision models'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the image file'
      },
      format: {
        type: 'string',
        enum: ['base64', 'metadata'],
        description: 'Output format (base64 for model consumption, metadata for file info)'
      }
    },
    required: ['path']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    let imagePath: string

    try {
      imagePath = validatePathWithinWorkspace(input.path as string)
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    if (!existsSync(imagePath)) {
      return `[ERROR] Image file not found: ${imagePath}`
    }

    const ext = extname(imagePath).toLowerCase()
    if (!SUPPORTED_FORMATS.has(ext)) {
      return `[ERROR] Unsupported image format: ${ext}. Supported: ${Array.from(SUPPORTED_FORMATS).join(', ')}`
    }

    try {
      const stats = statSync(imagePath)

      if (stats.size > MAX_IMAGE_SIZE) {
        return `[ERROR] Image too large (${(stats.size / 1024 / 1024).toFixed(1)}MB). Max: 50MB`
      }

      if (!stats.isFile()) {
        return `[ERROR] Not a file: ${imagePath}`
      }

      const format = (input.format as string) || 'base64'

      if (format === 'metadata') {
        return this.getImageMetadata(imagePath, ext, stats.size)
      } else {
        return this.getImageBase64(imagePath, ext)
      }
    } catch (error) {
      return `[ERROR] Failed to read image: ${(error as Error).message}`
    }
  }

  private getImageMetadata(imagePath: string, ext: string, size: number): string {
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

    return `[IMAGE METADATA]
Path: ${imagePath}
Format: ${ext.slice(1).toUpperCase()}
MIME Type: ${mimeType}
Size: ${(size / 1024).toFixed(2)} KB
Size (bytes): ${size}

Use format: "base64" to get the image data for vision model consumption.`
  }

  private getImageBase64(imagePath: string, ext: string): string {
    const buffer = readFileSync(imagePath)
    const base64Data = buffer.toString('base64')
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

    // Format as data URI for direct use in multimodal APIs
    const dataUri = `data:${mimeType};base64,${base64Data}`

    return `[IMAGE BASE64]
MIME Type: ${mimeType}
Data URI: ${dataUri}

To use in a vision model:
- Pass the entire "Data URI" value to the model's image parameter
- Or use just the base64 data if the model expects { "type": "image", "source": { "type": "base64", "media_type": "...", "data": "..." } }`
  }
}
