// ═══════════════════════════════════════════════════════════════════
// Lumiq Native — Rust NAPI Module Entry Point
// High-performance native operations for the Lumiq desktop IDE.
// ═══════════════════════════════════════════════════════════════════

#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

mod scanner;
mod chunker;
mod similarity;
mod search;

// Re-export all public NAPI functions
pub use scanner::*;
pub use chunker::*;
pub use similarity::*;
pub use search::*;
