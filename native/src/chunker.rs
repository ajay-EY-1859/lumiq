// ═══════════════════════════════════════════════════════════════════
// Lumiq Native — Text Chunker
// Parallel text chunking using rayon for semantic code indexing.
// Replaces the single-threaded JS chunkText() in CodebaseIndexer.
// ═══════════════════════════════════════════════════════════════════

use napi::bindgen_prelude::*;
use rayon::prelude::*;
use std::fs;

/// Input file for batch chunking.
#[napi(object)]
pub struct ChunkInput {
    /// Absolute file path
    pub file_path: String,
    /// Workspace-relative path (forward slashes)
    pub relative_path: String,
}

/// A single text chunk produced from a source file.
#[napi(object)]
#[derive(Clone)]
pub struct TextChunk {
    /// Workspace-relative file path (forward slashes)
    pub file_path: String,
    /// Zero-based chunk index within the file
    pub chunk_index: i32,
    /// The actual text content of this chunk
    pub content: String,
}

/// Chunking configuration options.
#[napi(object)]
pub struct ChunkOptions {
    /// Target chunk size in characters (default: 1000)
    pub chunk_size: Option<u32>,
    /// Overlap between adjacent chunks in characters (default: 200)
    pub overlap: Option<u32>,
    /// Minimum chunk length to include (default: 20)
    pub min_chunk_length: Option<u32>,
}

/// Reads and chunks multiple files in parallel using rayon.
///
/// Each file is read from disk, split into overlapping text chunks
/// aligned to paragraph/line boundaries, and returned as a flat Vec.
///
/// This replaces the sequential JS loop that called readFileSync +
/// chunkText() per file on the main thread.
#[napi]
pub async fn chunk_files(files: Vec<ChunkInput>, options: Option<ChunkOptions>) -> Result<Vec<TextChunk>> {
    let chunk_size = options.as_ref().and_then(|o| o.chunk_size).unwrap_or(1000) as usize;
    let overlap = options.as_ref().and_then(|o| o.overlap).unwrap_or(200) as usize;
    let min_len = options.as_ref().and_then(|o| o.min_chunk_length).unwrap_or(20) as usize;

    let result = tokio::task::spawn_blocking(move || {
        let chunks: Vec<TextChunk> = files
            .par_iter()
            .flat_map(|input| {
                match fs::read_to_string(&input.file_path) {
                    Ok(content) => {
                        if content.trim().is_empty() {
                            return Vec::new();
                        }
                        chunk_text(&content, chunk_size, overlap, min_len)
                            .into_iter()
                            .enumerate()
                            .map(|(idx, text)| TextChunk {
                                file_path: input.relative_path.clone(),
                                chunk_index: idx as i32,
                                content: text,
                            })
                            .collect::<Vec<_>>()
                    }
                    Err(_) => Vec::new(),
                }
            })
            .collect();

        chunks
    })
    .await
    .map_err(|e| Error::from_reason(format!("Chunker thread panicked: {}", e)))?;

    Ok(result)
}

fn adjust_to_char_boundary(text: &str, mut index: usize) -> usize {
    if index >= text.len() {
        return text.len();
    }
    while index > 0 && !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

/// Smart character-based sliding window chunking with boundary alignment.
///
/// Tries to align chunk boundaries to paragraph breaks (double newline)
/// or line breaks (single newline) for higher semantic coherence.
fn chunk_text(text: &str, chunk_size: usize, overlap: usize, min_len: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let bytes = text.as_bytes();
    let total_len = text.len();
    let mut start = 0;

    while start < total_len {
        let mut end = (start + chunk_size).min(total_len);

        // Try to align end to a paragraph boundary (\n\n)
        if end < total_len {
            let search_start = if end > 100 { adjust_to_char_boundary(text, end - 100) } else { 0 };
            let search_end = adjust_to_char_boundary(text, (end + 100).min(total_len));
            let search_slice = &text[search_start..search_end];

            if let Some(pos) = search_slice.find("\n\n") {
                let candidate = search_start + pos + 2;
                if candidate > start && candidate <= search_end {
                    end = candidate;
                }
            } else if let Some(pos) = search_slice.find('\n') {
                // Fall back to single newline boundary
                let search_narrow_start = if end > 50 { adjust_to_char_boundary(text, end - 50) } else { 0 };
                let narrow_slice = &text[search_narrow_start..search_end];
                if let Some(npos) = narrow_slice.find('\n') {
                    let candidate = search_narrow_start + npos + 1;
                    if candidate > start && candidate <= search_end {
                        end = candidate;
                    }
                }
            }
        }

        // Ensure we're at a valid UTF-8 boundary
        while end < total_len && !text.is_char_boundary(end) {
            end += 1;
        }

        let chunk = text[start..end].trim().to_string();
        if chunk.len() >= min_len {
            chunks.push(chunk);
        }

        // Move start forward with overlap
        let new_start = if end >= total_len {
            total_len // Exit condition
        } else if overlap < end {
            end - overlap
        } else {
            0
        };

        // Ensure we're at a valid UTF-8 boundary
        start = new_start;
        while start < total_len && !text.is_char_boundary(start) {
            start += 1;
        }

        // Guard: if we haven't advanced, force progress
        if start == 0 && end == 0 {
            break;
        }
        if end >= total_len {
            break;
        }
    }

    chunks
}

/// Reads a single file and chunks it. Convenience wrapper for incremental indexing.
#[napi]
pub fn chunk_single_file(
    file_path: String,
    relative_path: String,
    chunk_size: Option<u32>,
    overlap: Option<u32>,
) -> Result<Vec<TextChunk>> {
    let chunk_size = chunk_size.unwrap_or(1000) as usize;
    let overlap = overlap.unwrap_or(200) as usize;

    let content = fs::read_to_string(&file_path)
        .map_err(|e| Error::from_reason(format!("Failed to read file {}: {}", file_path, e)))?;

    if content.trim().is_empty() {
        return Ok(Vec::new());
    }

    let chunks = chunk_text(&content, chunk_size, overlap, 20);
    Ok(chunks
        .into_iter()
        .enumerate()
        .map(|(idx, text)| TextChunk {
            file_path: relative_path.clone(),
            chunk_index: idx as i32,
            content: text,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_chunking() {
        let text = "Hello world\n\nThis is a test\n\nAnother paragraph here with more text";
        let chunks = chunk_text(text, 30, 10, 5);
        assert!(!chunks.is_empty());
        // All chunks should be non-empty
        for chunk in &chunks {
            assert!(chunk.len() >= 5);
        }
    }

    #[test]
    fn test_empty_text() {
        let chunks = chunk_text("", 1000, 200, 20);
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_small_text() {
        let chunks = chunk_text("Hello", 1000, 200, 3);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "Hello");
    }

    #[test]
    fn test_unicode_safety() {
        let text = "こんにちは世界\n\nRustは素晴らしい\n\nUTF-8テスト";
        let chunks = chunk_text(text, 20, 5, 3);
        assert!(!chunks.is_empty());
        // Verify all chunks are valid UTF-8 (they must be, being Strings)
        for chunk in &chunks {
            assert!(chunk.len() >= 3);
        }
    }
}
