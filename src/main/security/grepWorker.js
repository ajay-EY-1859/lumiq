// ═══════════════════════════════════════════════════════════════════
// Lumiq — Grep Worker
// Runs inside a Worker Thread spawned by RegexSandbox.
// Keeping this as a separate file avoids eval:true on the Worker
// constructor, which would allow arbitrary code execution if the
// workerData were ever attacker-controlled.
// ═══════════════════════════════════════════════════════════════════

'use strict'

const { parentPort, workerData } = require('worker_threads')
const fs = require('fs')
const path = require('path')

const MAX_RESULTS = 200
const MAX_FILE_SIZE = 5 * 1024 * 1024
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.sqlite', '.db'
])
const IGNORED_DIRS = new Set(['node_modules', '.git', '.svn', '__pycache__', 'dist', 'out'])

const { pattern, searchPath, includeFilter } = workerData
const matches = []
const visited = new Set()

let regex
try {
  regex = new RegExp(pattern, 'i')
} catch {
  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  regex = new RegExp(escapedPattern, 'i')
}

function matchesFilter(filename, filter) {
  const escapedFilter = filter
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*')
    .replace(/\\\?/g, '[^\\/]')
    .replace(/\\\|/g, '|')
  const r = new RegExp('^' + escapedFilter + '$', 'i')
  return r.test(filename)
}

function searchFile(base, filePath) {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > MAX_FILE_SIZE) return

    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const relPath = path.relative(base, filePath)

    for (let i = 0; i < lines.length; i++) {
      regex.lastIndex = 0
      if (regex.test(lines[i])) {
        matches.push({ file: relPath, line: i + 1, content: lines[i] })
        if (matches.length >= MAX_RESULTS * 2) return
      }
    }
  } catch {
    // ignore unreadable files
  }
}

function searchFiles(base, dir) {
  if (matches.length >= MAX_RESULTS * 2) return

  let stat
  try {
    stat = fs.statSync(dir)
  } catch {
    return
  }

  if (stat.isFile()) {
    searchFile(base, dir)
    return
  }

  let realDir
  try {
    realDir = fs.realpathSync(dir)
  } catch {
    return
  }
  if (visited.has(realDir)) return
  visited.add(realDir)

  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (entry.isSymbolicLink()) {
        let target
        try {
          target = fs.realpathSync(fullPath)
        } catch {
          continue
        }
        if (visited.has(target)) continue
      }
      searchFiles(base, fullPath)
    } else if (entry.isFile()) {
      const ext = entry.name.substring(entry.name.lastIndexOf('.'))
      if (BINARY_EXTENSIONS.has(ext.toLowerCase())) continue
      if (includeFilter && !matchesFilter(entry.name, includeFilter)) continue
      searchFile(base, fullPath)
    }
  }
}

try {
  searchFiles(searchPath, searchPath)
  parentPort.postMessage({ status: 'success', matches })
} catch (err) {
  parentPort.postMessage({ status: 'error', error: err.message })
}
