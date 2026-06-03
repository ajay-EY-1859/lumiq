// ═══════════════════════════════════════════════════════════════════
// Lumiq Native — Vector Similarity Engine
// SIMD-friendly, Rayon-parallelized cosine similarity batch computation.
// Replaces the O(n) JS loop in EmbeddingManager.cosineSimilarity()
// and the brute-force search in RAGQueryEngine.search().
// ═══════════════════════════════════════════════════════════════════

use napi::bindgen_prelude::*;
use rayon::prelude::*;

/// A single similarity match result returned to Node.js.
#[napi(object)]
#[derive(Clone)]
pub struct SimilarityResult {
    /// Index into the original vectors array
    pub index: i32,
    /// Cosine similarity score (0.0 - 1.0 for normalized vectors)
    pub score: f64,
}

/// Computes cosine similarity between a query vector and a batch of vectors.
///
/// Uses Rayon for data parallelism across CPU cores. Each dot product
/// computation is auto-vectorized by LLVM to use SIMD instructions
/// (SSE2/AVX2 on x86_64) when compiled with `opt-level = 3`.
///
/// Returns the top-K results sorted by score descending, filtered
/// by a minimum threshold.
///
/// This replaces the sequential JS loop in RAGQueryEngine that loaded
/// ALL embeddings and computed dot products one-by-one on the main thread.
#[napi]
pub fn cosine_similarity_batch(
    query_vec: Vec<f64>,
    all_vectors: Vec<Vec<f64>>,
    top_k: u32,
    threshold: f64,
) -> Vec<SimilarityResult> {
    let query = &query_vec;
    let top_k = top_k as usize;

    // Parallel cosine similarity using rayon
    let mut scored: Vec<SimilarityResult> = all_vectors
        .par_iter()
        .enumerate()
        .filter_map(|(idx, vec)| {
            let score = dot_product(query, vec);
            if score > threshold {
                Some(SimilarityResult {
                    index: idx as i32,
                    score,
                })
            } else {
                None
            }
        })
        .collect();

    // Sort descending by score
    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    // Take top-K
    scored.truncate(top_k);
    scored
}

/// Optimized version that takes raw Float32 buffers instead of Vec<Vec<f64>>.
///
/// This avoids the overhead of creating nested JS arrays. Instead, vectors
/// are passed as a single flat Float32Array buffer with a known dimension.
///
/// Memory layout: [v0_d0, v0_d1, ..., v0_dN, v1_d0, v1_d1, ..., v1_dN, ...]
#[napi]
pub fn cosine_similarity_batch_buffer(
    query_vec: Vec<f64>,
    flat_vectors: Buffer,
    vector_dim: u32,
    num_vectors: u32,
    top_k: u32,
    threshold: f64,
) -> Vec<SimilarityResult> {
    let dim = vector_dim as usize;
    let count = num_vectors as usize;
    let top_k = top_k as usize;

    // Reinterpret the buffer as f32 slice
    let float_data: &[f32] = unsafe {
        std::slice::from_raw_parts(
            flat_vectors.as_ptr() as *const f32,
            flat_vectors.len() / std::mem::size_of::<f32>(),
        )
    };

    // Convert query to f32 for matching precision
    let query_f32: Vec<f32> = query_vec.iter().map(|&v| v as f32).collect();

    // Parallel computation across all vectors
    let mut scored: Vec<SimilarityResult> = (0..count)
        .into_par_iter()
        .filter_map(|idx| {
            let offset = idx * dim;
            if offset + dim > float_data.len() {
                return None;
            }
            let vec_slice = &float_data[offset..offset + dim];
            let score = dot_product_f32(&query_f32, vec_slice);
            let score_f64 = score as f64;

            if score_f64 > threshold {
                Some(SimilarityResult {
                    index: idx as i32,
                    score: score_f64,
                })
            } else {
                None
            }
        })
        .collect();

    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);
    scored
}

/// Single-pair cosine similarity (for compatibility).
#[napi]
pub fn cosine_similarity(vec_a: Vec<f64>, vec_b: Vec<f64>) -> f64 {
    dot_product(&vec_a, &vec_b)
}

/// Computes the dot product of two f64 vectors.
/// For normalized vectors, this equals cosine similarity.
///
/// The loop structure is designed for LLVM auto-vectorization:
/// - Simple indexed loop with no early exits
/// - Independent accumulation per iteration
/// - Contiguous memory access pattern
#[inline]
fn dot_product(a: &[f64], b: &[f64]) -> f64 {
    let len = a.len().min(b.len());
    let mut sum = 0.0f64;
    for i in 0..len {
        sum += a[i] * b[i];
    }
    sum
}

/// f32 version of dot product for buffer-based operations.
/// f32 is sufficient for embedding similarity and enables wider SIMD.
#[inline]
fn dot_product_f32(a: &[f32], b: &[f32]) -> f32 {
    let len = a.len().min(b.len());
    let mut sum = 0.0f32;
    for i in 0..len {
        sum += a[i] * b[i];
    }
    sum
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dot_product_identical() {
        let v = vec![1.0, 0.0, 0.0];
        assert!((dot_product(&v, &v) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_dot_product_orthogonal() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        assert!((dot_product(&a, &b)).abs() < 1e-10);
    }

    #[test]
    fn test_batch_returns_sorted() {
        let query = vec![1.0, 0.0, 0.0];
        let vecs = vec![
            vec![0.0, 1.0, 0.0], // orthogonal -> score 0
            vec![0.5, 0.5, 0.0], // partial match
            vec![1.0, 0.0, 0.0], // perfect match -> score 1
        ];
        let results = cosine_similarity_batch(query, vecs, 10, 0.01);
        assert!(results.len() >= 1);
        assert_eq!(results[0].index, 2); // Perfect match first
        assert!(results[0].score > results.last().unwrap().score);
    }

    #[test]
    fn test_threshold_filtering() {
        let query = vec![1.0, 0.0, 0.0];
        let vecs = vec![
            vec![0.0, 1.0, 0.0], // score = 0
            vec![0.1, 0.9, 0.0], // score = 0.1
        ];
        let results = cosine_similarity_batch(query, vecs, 10, 0.5);
        assert!(results.is_empty()); // All below threshold
    }
}
