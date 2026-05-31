# Tech-Vidvan LM Evaluation Strategy

## Purpose

Evaluation must measure the model on real software engineering abilities, not generic language metrics.

The goal is to verify that Tech-Vidvan can:

- reason across files and repo context
- diagnose bugs from code + logs
- review patches and identify risks
- generate implementation plans and migration steps
- preserve evidence and avoid unsupported assertions

## Evaluation task categories

### 1. Repository-level reasoning

Tasks should require multi-file or multi-step understanding:

- infer behavior from a project layout and selected files
- identify where a bug originates across source/test files
- summarize a repo change and its impact

### 2. Bug repair and debugging

Evaluation should include:

- bug reports + failing test outputs
- stack traces + code snippets
- developer questions like “Why does this fail?”
- patch generation that fixes the issue and preserves existing behavior

### 3. Code review and risk analysis

Use prompts like:

- review this diff for correctness, performance, and security issues
- identify missing tests or edge cases
- suggest safer refactor strategies

### 4. Planning and project management

Tasks should exercise non-code reasoning:

- turn requirements into implementation milestones
- propose rollback-safe deployment plans
- draft acceptance criteria and test plans

### 5. Tool and environment awareness

Include evidence of environment-sensitive reasoning:

- container/CI workflow diagnosis
- dependency upgrade risk assessment
- build and deployment failure troubleshooting

## Benchmark guidance

### Use strong open-source baselines

- Code Llama / StarCoder for code tasks
- SWE-bench, RepoBench, or other software-engineering benchmarks for workflow reasoning

### Prefer task variants that minimize contamination risk

- mutated versions of public benchmarks
- private repo-style tasks derived from open patterns
- synthetic tasks only when grounded in real-world engineering workflow

## Quality criteria

### Correctness

- model output must be consistent with the provided repository state
- suggested fixes must not contradict code semantics
- planning outputs should reflect actual limitations of the codebase

### Evidence

- answer should cite relevant files, logs, or tests when possible
- if the model cannot answer from the context, it should say so explicitly

### Precision

- avoid broad, generic statements
- prefer concrete recommendations and explicit follow-up steps

## Root project evaluation guidance

Borrow from OpenMythos documentation patterns:

- `docs/open_mythos.md` for architecture-level explanation style
- `docs/datasets.md` for split and dataset rationale
- `training/3b_fine_web_edu.py` for disciplined training/eval lifecycle practices

Tech-Vidvan evaluation should be documented with the same clarity and boundary discipline.
