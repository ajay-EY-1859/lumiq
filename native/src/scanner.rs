// ═══════════════════════════════════════════════════════════════════
// Lumiq Native — Workspace Scanner
// Parallel recursive directory walker using walkdir + rayon.
// Replaces Node.js readdirSync which blocks the Electron main thread.
// ═══════════════════════════════════════════════════════════════════

use napi::bindgen_prelude::*;
use rayon::prelude::*;
use std::collections::HashSet;
use std::path::Path;
use walkdir::WalkDir;

/// A single discovered file entry returned to Node.js.
#[napi(object)]
#[derive(Clone)]
pub struct FileEntry {
    /// Absolute file path (forward slashes)
    pub path: String,
    /// File size in bytes
    pub size: f64,
    /// File modification time in milliseconds since epoch
    pub mtime_ms: f64,
}

/// Options for workspace scanning.
#[napi(object)]
pub struct ScanOptions {
    /// Allowed file extensions (e.g. [".ts", ".js", ".py"])
    pub allowed_extensions: Vec<String>,
    /// Directory names to ignore (e.g. ["node_modules", ".git"])
    pub ignored_dirs: Vec<String>,
    /// Maximum number of files to return (safety cap)
    pub max_files: Option<u32>,
}

/// Asynchronously scans a workspace directory for code files.
///
/// Uses walkdir for traversal and rayon for parallel stat() calls.
/// Returns a Vec of FileEntry with normalized forward-slash paths.
///
/// This function runs on a Tokio thread pool and does NOT block
/// the Node.js event loop.
#[napi]
pub async fn scan_workspace(dir: String, options: ScanOptions) -> Result<Vec<FileEntry>> {
    let allowed_exts: HashSet<String> = options
        .allowed_extensions
        .iter()
        .map(|e| {
            let e = e.to_lowercase();
            if e.starts_with('.') {
                e
            } else {
                format!(".{}", e)
            }
        })
        .collect();

    let ignored_dirs: HashSet<String> = options
        .ignored_dirs
        .iter()
        .map(|d| d.to_lowercase())
        .collect();

    let max_files = options.max_files.unwrap_or(50_000) as usize;
    let dir_path = dir.clone();

    // Run the blocking walk on a separate thread to avoid blocking NAPI
    let result = tokio::task::spawn_blocking(move || {
        let walker = WalkDir::new(&dir_path)
            .follow_links(false)
            .into_iter()
            .filter_entry(|entry| {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                // Skip hidden directories, ignored directories, and .asar files
                if entry.file_type().is_dir() {
                    !name.starts_with('.')
                        && !name.starts_with('$')
                        && !ignored_dirs.contains(&name)
                } else {
                    true
                }
            });

        // Collect paths first (single-threaded walk is fastest for directory traversal)
        let mut paths: Vec<walkdir::DirEntry> = Vec::with_capacity(10_000);
        for entry in walker {
            if let Ok(entry) = entry {
                if entry.file_type().is_file() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if let Some(dot_pos) = name.rfind('.') {
                        let ext = &name[dot_pos..];
                        if allowed_exts.contains(ext) && !name.ends_with(".asar") {
                            paths.push(entry);
                            if paths.len() >= max_files {
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Parallel stat() + metadata extraction via rayon
        let entries: Vec<FileEntry> = paths
            .par_iter()
            .filter_map(|entry| {
                let metadata = entry.metadata().ok()?;
                let mtime = metadata
                    .modified()
                    .ok()?
                    .duration_since(std::time::UNIX_EPOCH)
                    .ok()?;

                Some(FileEntry {
                    path: entry.path().to_string_lossy().replace('\\', "/"),
                    size: metadata.len() as f64,
                    mtime_ms: mtime.as_secs_f64() * 1000.0,
                })
            })
            .collect();

        entries
    })
    .await
    .map_err(|e| Error::from_reason(format!("Scanner thread panicked: {}", e)))?;

    Ok(result)
}

/// Synchronous version for benchmarking. Avoid in production — use scan_workspace instead.
#[napi]
pub fn scan_workspace_sync(dir: String, options: ScanOptions) -> Result<Vec<FileEntry>> {
    let allowed_exts: HashSet<String> = options
        .allowed_extensions
        .iter()
        .map(|e| {
            let e = e.to_lowercase();
            if e.starts_with('.') {
                e
            } else {
                format!(".{}", e)
            }
        })
        .collect();

    let ignored_dirs: HashSet<String> = options
        .ignored_dirs
        .iter()
        .map(|d| d.to_lowercase())
        .collect();

    let max_files = options.max_files.unwrap_or(50_000) as usize;

    let walker = WalkDir::new(&dir)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if entry.file_type().is_dir() {
                !name.starts_with('.')
                    && !name.starts_with('$')
                    && !ignored_dirs.contains(&name)
            } else {
                true
            }
        });

    let mut entries: Vec<FileEntry> = Vec::with_capacity(10_000);

    for entry in walker {
        if let Ok(entry) = entry {
            if entry.file_type().is_file() {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                if let Some(dot_pos) = name.rfind('.') {
                    let ext = &name[dot_pos..];
                    if allowed_exts.contains(ext) && !name.ends_with(".asar") {
                        if let Ok(metadata) = entry.metadata() {
                            if let Ok(mtime) = metadata.modified() {
                                if let Ok(dur) = mtime.duration_since(std::time::UNIX_EPOCH) {
                                    entries.push(FileEntry {
                                        path: entry.path().to_string_lossy().replace('\\', "/"),
                                        size: metadata.len() as f64,
                                        mtime_ms: dur.as_secs_f64() * 1000.0,
                                    });
                                    if entries.len() >= max_files {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(entries)
}
