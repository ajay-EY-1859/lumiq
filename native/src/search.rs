// ═══════════════════════════════════════════════════════════════════
// Lumiq Native — File Search Engine
// Parallel ripgrep-style search using rayon + regex.
// Replaces the synchronous walkAndSearch() in searchHandlers.ts
// that blocked the Electron main process IPC thread.
// ═══════════════════════════════════════════════════════════════════

use napi::bindgen_prelude::*;
use rayon::prelude::*;
use regex::RegexBuilder;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// A single search match result returned to Node.js.
#[napi(object)]
#[derive(Clone)]
pub struct NativeSearchMatch {
    /// Workspace-relative file path (forward slashes)
    pub file: String,
    /// 1-based line number
    pub line: i32,
    /// 1-based column number
    pub column: i32,
    /// The trimmed content of the matching line
    pub content: String,
}

/// Search result container with metadata.
#[napi(object)]
pub struct SearchResult {
    /// All matches found
    pub matches: Vec<NativeSearchMatch>,
    /// Total number of matches (may exceed returned matches if truncated)
    pub total_matches: i32,
    /// Whether results were truncated at max_results
    pub truncated: bool,
    /// Time elapsed in milliseconds
    pub elapsed_ms: f64,
}

/// Binary file extensions to skip during search.
const BINARY_EXTENSIONS: &[&str] = &[
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".bmp", ".webp",
    ".mp3", ".mp4", ".avi", ".mov", ".wav",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".exe", ".dll", ".so", ".dylib",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".sqlite", ".db", ".node", ".asar",
];

/// Maximum file size to search (5 MB)
const MAX_FILE_SIZE: u64 = 5 * 1024 * 1024;

/// Performs a parallel, non-blocking file content search across a workspace.
///
/// 1. Walks the directory tree (single-threaded, fast)
/// 2. Reads and searches files in parallel via rayon
/// 3. Returns matches sorted by file path, then line number
///
/// This replaces the synchronous walkAndSearch() function in searchHandlers.ts
/// that used readdirSync + readFileSync on the main process IPC thread.
#[napi]
pub async fn search_files(
    dir: String,
    pattern: String,
    is_regex: bool,
    case_sensitive: bool,
    include_exts: Vec<String>,
    exclude_dirs: Vec<String>,
    max_results: Option<u32>,
) -> Result<SearchResult> {
    let max_results = max_results.unwrap_or(500) as usize;

    let result = tokio::task::spawn_blocking(move || {
        let start = std::time::Instant::now();

        // Build regex pattern
        let regex_pattern = if is_regex {
            pattern.clone()
        } else {
            regex::escape(&pattern)
        };

        let regex = RegexBuilder::new(&regex_pattern)
            .case_insensitive(!case_sensitive)
            .build()
            .map_err(|e| Error::from_reason(format!("Invalid regex: {}", e)))?;

        // Parse include extensions
        let include_set: HashSet<String> = include_exts
            .iter()
            .map(|e| {
                let e = e.trim().to_lowercase();
                let e = e.trim_start_matches('*');
                if e.starts_with('.') { e.to_string() } else { format!(".{}", e) }
            })
            .filter(|e| !e.is_empty() && e != ".")
            .collect();

        // Parse exclude directories
        let exclude_set: HashSet<String> = {
            let mut set: HashSet<String> = HashSet::from_iter(
                ["node_modules", ".git", ".svn", "__pycache__", "dist", "out", ".next", ".cache"]
                    .iter()
                    .map(|s| s.to_string()),
            );
            for d in &exclude_dirs {
                let d = d.trim().to_lowercase();
                if !d.is_empty() {
                    set.insert(d);
                }
            }
            set
        };

        let binary_exts: HashSet<&str> = BINARY_EXTENSIONS.iter().cloned().collect();

        // Phase 1: Collect file paths (single-threaded walk is fastest)
        let mut file_paths: Vec<String> = Vec::with_capacity(10_000);
        let walker = WalkDir::new(&dir)
            .follow_links(false)
            .into_iter()
            .filter_entry(|entry| {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                if entry.file_type().is_dir() {
                    !name.starts_with('.') && !name.starts_with('$') && !exclude_set.contains(&name)
                } else {
                    true
                }
            });

        for entry in walker {
            if let Ok(entry) = entry {
                if entry.file_type().is_file() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if let Some(dot_pos) = name.rfind('.') {
                        let ext = &name[dot_pos..];
                        if binary_exts.contains(ext) {
                            continue;
                        }
                        if !include_set.is_empty() && !include_set.contains(ext) {
                            continue;
                        }
                    }
                    // Check file size
                    if let Ok(meta) = entry.metadata() {
                        if meta.len() <= MAX_FILE_SIZE {
                            file_paths.push(entry.path().to_string_lossy().to_string());
                        }
                    }
                }
            }
        }

        // Phase 2: Parallel search across all files
        let base_path = Path::new(&dir);
        let all_matches: Vec<NativeSearchMatch> = file_paths
            .par_iter()
            .flat_map(|file_path| {
                let mut matches = Vec::new();
                if let Ok(content) = fs::read_to_string(file_path) {
                    let rel_path = Path::new(file_path)
                        .strip_prefix(base_path)
                        .map(|p| p.to_string_lossy().replace('\\', "/"))
                        .unwrap_or_else(|_| file_path.replace('\\', "/"));

                    for (line_idx, line) in content.lines().enumerate() {
                        for mat in regex.find_iter(line) {
                            matches.push(NativeSearchMatch {
                                file: rel_path.clone(),
                                line: (line_idx + 1) as i32,
                                column: (mat.start() + 1) as i32,
                                content: line.trim().to_string(),
                            });

                            // Early exit per file if we have way too many matches
                            if matches.len() > max_results * 2 {
                                return matches;
                            }
                        }
                    }
                }
                matches
            })
            .collect();

        let total_matches = all_matches.len();
        let truncated = total_matches > max_results;
        let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;

        let final_matches: Vec<NativeSearchMatch> = all_matches
            .into_iter()
            .take(max_results)
            .collect();

        Ok::<SearchResult, napi::Error>(SearchResult {
            matches: final_matches,
            total_matches: total_matches as i32,
            truncated,
            elapsed_ms,
        })
    })
    .await
    .map_err(|e| Error::from_reason(format!("Search thread panicked: {}", e)))??;

    Ok(result)
}
