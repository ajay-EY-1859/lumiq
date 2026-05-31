# Tech-Vidvan LM Data Strategy

## Goal

Tech-Vidvan must learn software engineering workflows, not just code syntax.

The data strategy should focus on:

- repository-level structure
- issue/PR/task workflows
- debugging traces and CI output
- code review and test-based reasoning
- project planning and documentation

## Data categories

### 1. Code and repository structure

Primary sources:

- permissively licensed code corpora (`the-stack`, `StarCoderData`, BigCode)
- repository archives with file metadata
- build manifests, dependency files, CI workflows, infra config

Tech-Vidvan-specific requirements:

- preserve file boundaries and project layout
- include commit messages or changelog context when available
- avoid training on private or license-incompatible repos unless explicitly permitted

### 2. Software engineering artifacts

High-value artifacts:

- issues, PR descriptions, review comments, and final patch diffs
- architecture docs, ADRs, design proposals
- release notes, migration plans, incident reports
- test cases, coverage reports, fuzz findings
- linter output, compiler errors, stack traces, and CI logs

These artifacts teach the model the workflow from problem statement to fix and verification.

### 3. Error/diagnosis / debugging traces

Collect examples that connect:

- failing tests → root cause
- stack trace → source location
- deployment failure → rollback plan
- broken behavior → bug fix with regression tests

This is essential for making Tech-Vidvan reliable in debugging and triage.

### 4. Instruction-style task traces

Preferred instruction formats are:

- issue → plan → patch → tests
- bug report → reproduce steps → fix
- code review prompt → findings → recommendations
- architecture requirement → high-level design → implementation outline

Keep data grounded and minimally synthetic.

## Data splits

### Pretraining

A balanced mix of:

- technical web text (FineWeb-Edu / FineWeb)
- permissive code corpora
- math/reasoning text if useful for algorithmic reasoning

Do not overemphasize generic web text; Tech-Vidvan should stay technical.

### Instruction tuning

Use curated traces and workflow data such as:

- issue-to-patch examples
- bug-fix conversations with tests and logs
- PR review threads with reviewer comments
- migration plans and release note pairs

### Evaluation / validation

Hold out datasets for real engineering tasks:

- task-oriented code review
- bug repair from issue descriptions
- repository-level planning and migration
- CI/log-based diagnosis

## Root project data relevance

From OpenMythos, the following are especially useful to borrow:

- `training/3b_fine_web_edu.py`: dataset streaming and training hygiene patterns
- `docs/datasets.md`: token budget and dataset mix guidance
- `open_mythos/tokenizer.py`: tokenizer abstraction and reproducibility note

## Data quality rules

- verify licenses and provenance
- deduplicate at document, file, and repo level
- avoid contamination of evaluation benchmarks
- remove secrets, PII, and sensitive data
- prefer high-quality technical content over scale alone
