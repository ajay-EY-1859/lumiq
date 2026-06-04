// ═══════════════════════════════════════════════════════════════════
// Lumiq Native — AST Symbol & Reference Parser (Tree-Sitter Backed)
// High-performance parser mapping source code nodes to global symbols.
// ═══════════════════════════════════════════════════════════════════

use napi::bindgen_prelude::*;
use regex::Regex;
use std::path::Path;

#[napi(object)]
pub struct SymbolData {
    pub name: String,
    pub kind: String,
    pub container_name: Option<String>,
    pub start_line: u32,
    pub start_column: u32,
    pub end_line: u32,
    pub end_column: u32,
    pub signature: Option<String>,
}

#[napi(object)]
pub struct ReferenceData {
    pub target_name: String,
    pub kind: String,
    pub line: u32,
    pub column: u32,
    pub module_specifier: Option<String>,
}

#[napi(object)]
pub struct AstParseResult {
    pub symbols: Vec<SymbolData>,
    pub references: Vec<ReferenceData>,
}

/// Parses a source code file using Tree-Sitter or regex fallback.
/// Extracting symbols and calls/imports natively for sub-millisecond execution.
#[napi]
pub fn parse_file_ast(file_path: String, content: String) -> Result<AstParseResult> {
    let ext = Path::new(&file_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mut symbols = Vec::new();
    let mut references = Vec::new();

    let success = match ext.as_str() {
        "ts" | "js" => {
            parse_with_tree_sitter(&content, tree_sitter_typescript::language_typescript(), "typescript", &mut symbols, &mut references).is_ok()
        }
        "tsx" | "jsx" => {
            parse_with_tree_sitter(&content, tree_sitter_typescript::language_tsx(), "typescript", &mut symbols, &mut references).is_ok()
        }
        "py" => {
            parse_with_tree_sitter(&content, tree_sitter_python::language(), "python", &mut symbols, &mut references).is_ok()
        }
        "rs" => {
            parse_with_tree_sitter(&content, tree_sitter_rust::language(), "rust", &mut symbols, &mut references).is_ok()
        }
        "go" => {
            parse_with_tree_sitter(&content, tree_sitter_go::language(), "go", &mut symbols, &mut references).is_ok()
        }
        _ => false,
    };

    if !success {
        parse_fallback_regex(&content, &mut symbols, &mut references);
    }

    Ok(AstParseResult {
        symbols,
        references,
    })
}

fn parse_with_tree_sitter(
    content: &str,
    language: tree_sitter::Language,
    lang_name: &str,
    symbols: &mut Vec<SymbolData>,
    references: &mut Vec<ReferenceData>,
) -> std::result::Result<(), String> {
    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(language)
        .map_err(|e| format!("Failed to set tree-sitter language: {}", e))?;

    let tree = parser
        .parse(content, None)
        .ok_or_else(|| "Failed to parse content with tree-sitter".to_string())?;

    let root_node = tree.root_node();
    let content_bytes = content.as_bytes();

    traverse_node(root_node, content_bytes, lang_name, None, symbols, references);
    Ok(())
}

fn traverse_node(
    node: tree_sitter::Node,
    content: &[u8],
    language: &str,
    container_name: Option<String>,
    symbols: &mut Vec<SymbolData>,
    references: &mut Vec<ReferenceData>,
) {
    let node_type = node.kind();

    match language {
        "typescript" => match node_type {
            "class_declaration" | "class" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: "Class".to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("class {}", name)),
                    });
                    
                    // Traverse children with this class as container
                    let count = node.child_count();
                    for i in 0..count {
                        if let Some(child) = node.child(i) {
                            traverse_node(child, content, language, Some(name.clone()), symbols, references);
                        }
                    }
                    return;
                }
            }
            "interface_declaration" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: "Interface".to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("interface {}", name)),
                    });
                }
            }
            "function_declaration" | "function" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: "Function".to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("function {}", name)),
                    });
                }
            }
            "method_definition" | "method_declaration" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: "Method".to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("method {}", name)),
                    });
                }
            }
            "variable_declarator" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    let is_func = if let Some(val_node) = node.child_by_field_name("value") {
                        let val_kind = val_node.kind();
                        val_kind == "arrow_function" || val_kind == "function_expression"
                    } else {
                        false
                    };
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: if is_func { "Function".to_string() } else { "Variable".to_string() },
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("{} {}", if is_func { "const" } else { "let" }, name)),
                    });
                }
            }
            "import_specifier" | "import_clause" => {
                if let Some(name_node) = node.child_by_field_name("name").or_else(|| {
                    if node_type == "import_clause" {
                        node.child(0).filter(|c| c.kind() == "identifier")
                    } else {
                        None
                    }
                }) {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = name_node.start_position();
                    let module_specifier = find_ts_module_specifier(node, content);
                    references.push(ReferenceData {
                        target_name: name,
                        kind: "import".to_string(),
                        line: (start.row + 1) as u32,
                        column: (start.column + 1) as u32,
                        module_specifier,
                    });
                }
            }
            "call_expression" => {
                if let Some(func_node) = node.child_by_field_name("function") {
                    if func_node.kind() == "identifier" {
                        let name = func_node.utf8_text(content).unwrap_or("").to_string();
                        let start = func_node.start_position();
                        references.push(ReferenceData {
                            target_name: name,
                            kind: "call".to_string(),
                            line: (start.row + 1) as u32,
                            column: (start.column + 1) as u32,
                            module_specifier: None,
                        });
                    }
                }
            }
            _ => {}
        },
        "python" => match node_type {
            "class_definition" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: "Class".to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("class {}", name)),
                    });
                    
                    // Traverse children with class as container
                    let count = node.child_count();
                    for i in 0..count {
                        if let Some(child) = node.child(i) {
                            traverse_node(child, content, language, Some(name.clone()), symbols, references);
                        }
                    }
                    return;
                }
            }
            "function_definition" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    let kind = if container_name.is_some() { "Method" } else { "Function" };
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: kind.to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("def {}", name)),
                    });
                }
            }
            "aliased_import" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = name_node.start_position();
                    let module_specifier = find_python_module_specifier(node, content);
                    references.push(ReferenceData {
                        target_name: name,
                        kind: "import".to_string(),
                        line: (start.row + 1) as u32,
                        column: (start.column + 1) as u32,
                        module_specifier,
                    });
                }
            }
            "identifier" | "dotted_name" => {
                if let Some(parent) = node.parent() {
                    if parent.kind() == "import_statement" && node_type == "dotted_name" {
                        let name = node.utf8_text(content).unwrap_or("").to_string();
                        let start = node.start_position();
                        references.push(ReferenceData {
                            target_name: name.clone(),
                            kind: "import".to_string(),
                            line: (start.row + 1) as u32,
                            column: (start.column + 1) as u32,
                            module_specifier: Some(name),
                        });
                    } else if parent.kind() == "import_from_statement" {
                        let is_module_name = parent.child_by_field_name("module_name")
                            .map_or(false, |m| m.id() == node.id());
                        if !is_module_name {
                            let name = node.utf8_text(content).unwrap_or("").to_string();
                            let start = node.start_position();
                            let module_specifier = find_python_module_specifier(node, content);
                            references.push(ReferenceData {
                                target_name: name,
                                kind: "import".to_string(),
                                line: (start.row + 1) as u32,
                                column: (start.column + 1) as u32,
                                module_specifier,
                            });
                        }
                    }
                }
            }
            "call" => {
                if let Some(func_node) = node.child_by_field_name("function") {
                    if func_node.kind() == "identifier" {
                        let name = func_node.utf8_text(content).unwrap_or("").to_string();
                        let start = func_node.start_position();
                        references.push(ReferenceData {
                            target_name: name,
                            kind: "call".to_string(),
                            line: (start.row + 1) as u32,
                            column: (start.column + 1) as u32,
                            module_specifier: None,
                        });
                    }
                }
            }
            _ => {}
        },
        "rust" => match node_type {
            "struct_item" | "enum_item" | "union_item" | "trait_item" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    let kind = if node_type == "trait_item" { "Interface" } else { "Class" };
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: kind.to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("struct/trait {}", name)),
                    });
                }
            }
            "function_item" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: "Function".to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("fn {}", name)),
                    });
                }
            }
            "call_expression" => {
                if let Some(func_node) = node.child_by_field_name("function") {
                    if func_node.kind() == "identifier" {
                        let name = func_node.utf8_text(content).unwrap_or("").to_string();
                        let start = func_node.start_position();
                        references.push(ReferenceData {
                            target_name: name,
                            kind: "call".to_string(),
                            line: (start.row + 1) as u32,
                            column: (start.column + 1) as u32,
                            module_specifier: None,
                        });
                    }
                }
            }
            _ => {}
        },
        "go" => match node_type {
            "type_spec" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: "Class".to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("type {}", name)),
                    });
                }
            }
            "function_declaration" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: "Function".to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("func {}", name)),
                    });
                }
            }
            "method_declaration" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = name_node.utf8_text(content).unwrap_or("").to_string();
                    let start = node.start_position();
                    let end = node.end_position();
                    symbols.push(SymbolData {
                        name: name.clone(),
                        kind: "Method".to_string(),
                        container_name: container_name.clone(),
                        start_line: (start.row + 1) as u32,
                        start_column: (start.column + 1) as u32,
                        end_line: (end.row + 1) as u32,
                        end_column: (end.column + 1) as u32,
                        signature: Some(format!("method {}", name)),
                    });
                }
            }
            "call_expression" => {
                if let Some(func_node) = node.child_by_field_name("function") {
                    if func_node.kind() == "identifier" {
                        let name = func_node.utf8_text(content).unwrap_or("").to_string();
                        let start = func_node.start_position();
                        references.push(ReferenceData {
                            target_name: name,
                            kind: "call".to_string(),
                            line: (start.row + 1) as u32,
                            column: (start.column + 1) as u32,
                            module_specifier: None,
                        });
                    }
                }
            }
            _ => {}
        },
        _ => {}
    }

    // Recurse children
    let count = node.child_count();
    for i in 0..count {
        if let Some(child) = node.child(i) {
            traverse_node(child, content, language, container_name.clone(), symbols, references);
        }
    }
}

fn find_ts_module_specifier(node: tree_sitter::Node, content: &[u8]) -> Option<String> {
    let mut curr = node;
    while let Some(parent) = curr.parent() {
        if parent.kind() == "import_statement" {
            if let Some(source_node) = parent.child_by_field_name("source") {
                let text = source_node
                    .utf8_text(content)
                    .unwrap_or("")
                    .trim_matches(&['\'', '"'] as &[char])
                    .to_string();
                return Some(text);
            }
        }
        curr = parent;
    }
    None
}

fn find_python_module_specifier(node: tree_sitter::Node, content: &[u8]) -> Option<String> {
    let mut curr = node;
    while let Some(parent) = curr.parent() {
        if parent.kind() == "import_from_statement" {
            if let Some(module_node) = parent.child_by_field_name("module_name") {
                return Some(module_node.utf8_text(content).unwrap_or("").to_string());
            }
        }
        curr = parent;
    }
    None
}

fn parse_fallback_regex(
    content: &str,
    symbols: &mut Vec<SymbolData>,
    _references: &mut Vec<ReferenceData>,
) {
    let lines: Vec<&str> = content.lines().collect();

    let class_re = Regex::new(r"^(?:pub(?:lic)?\s+|private\s+|protected\s+|export\s+)*(?:struct|class|interface)\s+([a-zA-Z0-9_]+)").unwrap();
    let fn_re = Regex::new(r"^(?:pub(?:lic)?\s+|private\s+|protected\s+|export\s+)*(?:fn|function|def|void|[a-zA-Z0-9_<>]+)\s+([a-zA-Z0-9_]+)\s*\(").unwrap();

    for (i, line) in lines.iter().enumerate() {
        let trim_line = line.trim();
        let line_num = (i + 1) as u32;

        if let Some(cap) = class_re.captures(trim_line) {
            if let Some(m) = cap.get(1) {
                let name = m.as_str().to_string();
                let col = (line.find(&name).unwrap_or(0) + 1) as u32;
                symbols.push(SymbolData {
                    name: name.clone(),
                    kind: "Class".to_string(),
                    container_name: None,
                    start_line: line_num,
                    start_column: col,
                    end_line: line_num,
                    end_column: line.len() as u32,
                    signature: Some(trim_line.to_string()),
                });
                continue;
            }
        }

        if let Some(cap) = fn_re.captures(trim_line) {
            if let Some(m) = cap.get(1) {
                let name = m.as_str().to_string();
                let col = (line.find(&name).unwrap_or(0) + 1) as u32;
                symbols.push(SymbolData {
                    name: name.clone(),
                    kind: "Function".to_string(),
                    container_name: None,
                    start_line: line_num,
                    start_column: col,
                    end_line: line_num,
                    end_column: line.len() as u32,
                    signature: Some(trim_line.to_string()),
                });
            }
        }
    }
}
