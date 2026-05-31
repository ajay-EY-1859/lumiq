# Tech-Vidvan LM References

This file tracks the references that should guide Tech-Vidvan LM research. The
goal is not to copy any one model, but to build a grounded view of what to
borrow, what to test, and what to avoid.

## Architecture

### Recurrent / Looped Transformers

- **Loop, Think, & Generalize: Implicit Reasoning in Recurrent-Depth Transformers**
  - Link: https://huggingface.co/papers/2604.07822
  - Why it matters: supports the idea that repeated application of shared
    transformer blocks can improve implicit multi-hop reasoning and depth
    extrapolation.
  - Use for: validating OpenMythos-style recurrent-depth blocks.
  - Caution: reported gains may not transfer directly from synthetic reasoning
    tasks to real software engineering workloads.

- **Thinking Deeper, Not Longer: Depth-Recurrent Transformers for Compositional Generalization**
  - Link: https://huggingface.co/papers/2603.21676
  - Why it matters: explores variable-depth reasoning using latent recurrence.
  - Use for: training/eval designs where hard tasks get more recurrent depth.
  - Caution: treat as a hypothesis until tested on code and repo-level tasks.

## Root Project Integration

The current OpenMythos repository provides concrete architecture and training guidance that should be referenced directly when building Tech-Vidvan.

- **`open_mythos/main.py`**
  - Recurrent Depth Transformer pipeline: Prelude → Recurrent Block → Coda
  - Stable input injection with preserved encoded input
  - ACT halting and loop-index adaptation
  - Attention modes: MLA for long-context compression, GQA for fallback mode
  - MoE-based recurrent FFN and depth-wise LoRA adaptation

- **`open_mythos/moda.py`**
  - Mixture-of-Depths Attention (MoDA) research reference
  - DeepSeek MoE and expert routing patterns
  - Rotary embedding cache / attention efficiency primitives

- **`training/3b_fine_web_edu.py`**
  - FSDP training lifecycle and checkpointing best practices
  - streaming dataset sharding for large corpora
  - mixed precision and optimizer setup
  - dataset / schedule discipline for long-running pretraining

- **`docs/open_mythos.md`**
  - detailed model API and architecture reference style
  - useful example of how to document complex LM internals clearly

- **`docs/datasets.md`**
  - dataset mix guidance and token budget rationale
  - useful starting point for Tech-Vidvan data strategy

## Additional root references to consider

- `open_mythos/tokenizer.py`: tokenizer abstraction and reproducibility note
- `open_mythos/variants.py`: parameter scaling templates for model variants
- `README.md`: high-level architecture explanation and positioning language

- **Memory-Efficient Looped Transformer (MELT)**
  - Link: https://huggingface.co/papers/2605.07721
  - Why it matters: focuses on reducing memory cost in looped language models.
  - Use for: improving KV-cache strategy if recurrent loops become expensive.
  - Caution: implementation complexity should be justified by measured gains.

- **Hyperloop Transformers**
  - Link: https://arxiv.org/abs/2604.21254
  - Why it matters: explores highly optimized recurrent structures that accelerate routing and execution paths.
  - Use for: high-performance training loop mechanics.

- **The Recurrent Transformer: Greater Effective Depth and Efficient Decoding**
  - Link: https://arxiv.org/abs/2604.21215
  - Why it matters: analyzes decoding latency improvements in recurrent models.
  - Use for: continuous depth-wise batching evaluation.

- **LT2: Linear-Time Looped Transformers**
  - Link: https://arxiv.org/pdf/2605.20670
  - Why it matters: discusses linear time complexity in recurrent loop models.
  - Use for: scaling context length to ultra-long repo scenarios.

### Community & Theoretical Analysis (Twitter)

- **Claude Mythos Looped Transformer Theory (Sigrid Jin)**
  - Link: https://x.com/realsigridjin/status/2044620031410266276
  - Why it matters: discusses why recurrent-depth models excel at compositional logic and implicit reasoning.

- **Looped Transformer Cyclic Trajectories and Input Injection (rosinality)**
  - Link: https://x.com/rosinality/status/2043953033428541853
  - Why it matters: analyzes hidden-state trajectories in recurrent transformers with continuous input injection.

- **Parcae Scaling Laws for Stable Looped Models (Hayden Prairie)**
  - Link: https://x.com/hayden_prairie/status/2044453231913537927
  - Why it matters: empirical scaling laws showing that stable input injection makes looping FLOP-efficient.

- **Looped Transformers Controversy and Theoretical Limits (ChrisHayduk)**
  - Link: https://x.com/ChrisHayduk/status/2045947623572688943
  - Why it matters: meta-discussion summarizing the limits and guarantees of recurrent depth architectures.

## Attention And MoE

### DeepSeek-V2

- **DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model**
  - Link: https://arxiv.org/abs/2405.04434
  - Why it matters: public reference for combining Multi-head Latent Attention
    and DeepSeekMoE in a large language model.
  - Use for: MLA design, MoE scaling, cache-efficiency ideas, and training
    system comparisons.
  - Caution: DeepSeek-V2 is a general-purpose LM; Tech-Vidvan needs software
    engineering specific data and evals.

### DeepSeekMoE

- **DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models**
  - Link: https://arxiv.org/abs/2401.06066
  - Why it matters: introduces fine-grained expert segmentation and shared
    experts, both relevant to technical-domain specialization.
  - Use for: MoE routing design and expert specialization experiments.
  - Caution: expert specialization must be measured; do not assume language or
    task experts emerge cleanly without routing pressure.

- **DeepSeekMoE ACL Anthology PDF**
  - Link: https://aclanthology.org/2024.acl-long.70.pdf
  - Why it matters: stable conference version/reference for DeepSeekMoE.
  - Use for: exact definitions, ablations, and citation-quality details.

### MLA Analysis

- **Hardware-Centric Analysis of DeepSeek's Multi-Head Latent Attention**
  - Link: https://arxiv.org/abs/2506.02523
  - Why it matters: analyzes MLA from an efficiency and hardware perspective.
  - Use for: deciding whether MLA is worth the complexity at our target scale.
  - Caution: hardware bottlenecks depend on implementation and deployment stack.

## Code-Specialist Language Models

### Code Llama

- **Code Llama: Open Foundation Models for Code**
  - Link: https://arxiv.org/abs/2308.12950
  - Why it matters: strong reference for code-specialized pretraining,
    Python-focused specialization, instruction tuning, and code benchmarks.
  - Use for: data mix, training phases, and evaluation baseline design.
  - Caution: benchmark performance on HumanEval/MBPP is not enough for
    repo-level software engineering.

### StarCoder / BigCode

- **BigCode / StarCoder model and dataset family**
  - Link: https://huggingface.co/bigcode
  - Why it matters: important open code-model effort with focus on code data,
    licensing, deduplication, and responsible release practices.
  - Use for: data governance, permissive code collection, and model-card
    practices.
  - Caution: raw code pretraining should be paired with repository-level and
    workflow-level data.

## Dataset Sources

Dataset sources should be separated from research papers. A dataset source is a
place we may use for training, instruction tuning, evaluation, or data-pipeline
design. Every dataset must pass license, provenance, deduplication, and
contamination checks before use.

### Primary Code Pretraining

- **The Stack v2**
  - Link: https://huggingface.co/datasets/bigcode/the-stack-v2
  - Type: large code corpus.
  - Use for: permissive-code pretraining, language coverage, repository-scale
    code distribution.
  - Need to verify: license filters, opt-out handling, duplicate repositories,
    generated/vendor code, and benchmark contamination.

- **StarCoderData / BigCode data family**
  - Link: https://huggingface.co/bigcode
  - Type: code-model training data family and related BigCode resources.
  - Use for: studying open code data governance, filtering, and model-card
    practice.
  - Need to verify: exact dataset version and license mix before training.

- **Software Heritage**
  - Link: https://www.softwareheritage.org/
  - Type: source-code archive, not a ready-to-train dataset by itself.
  - Use for: possible long-term source discovery and repository provenance.
  - Need to verify: license extraction, deduplication, and project metadata.

### General Technical Knowledge

- **FineWeb-Edu**
  - Link: https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu
  - Type: educational web text.
  - Use for: general technical language, documentation-style explanations, and
    broad knowledge pretraining.
  - Need to verify: domain mix and whether technical content is sufficient for
    our target.

- **FineWeb**
  - Link: https://huggingface.co/datasets/HuggingFaceFW/fineweb
  - Type: large cleaned web corpus.
  - Use for: general language balance if the model becomes too code-only.
  - Need to verify: whether the added scale is worth lower technical density.

- **OpenWebMath**
  - Link: https://huggingface.co/datasets/open-web-math/open-web-math
  - Type: math-focused web text.
  - Use for: symbolic reasoning, algorithmic explanations, and quantitative
    reasoning.
  - Need to verify: license compatibility and token budget.

### Instruction And Workflow Data

- **OpenHermes 2.5**
  - Link: https://huggingface.co/datasets/teknium/OpenHermes-2.5
  - Type: instruction-following dataset.
  - Use for: generic instruction-following baseline.
  - Need to verify: synthetic data quality and whether responses match our
    concise engineering style.

- **SWE-bench datasets**
  - Link: https://www.swebench.com/SWE-bench/guides/datasets/
  - Type: real GitHub issue-to-patch tasks.
  - Use for: evaluation and possibly workflow-format inspiration.
  - Need to verify: avoid training on public eval splits; use for eval design
    more than direct training unless split hygiene is strict.

- **SWE-rebench / updated SWE variants**
  - Link: https://papers.cool/arxiv/2505.20411
  - Type: contamination-aware SWE task generation direction.
  - Use for: private eval generation and benchmark mutation ideas.
  - Need to verify: dataset availability, license, and construction pipeline.

### Project Management And Engineering Process Data

These sources are more likely to require custom collection than direct download:

- Public issue trackers with permissive project licenses.
- Pull requests with review comments and final merged patches.
- Commit messages linked to diffs and tests.
- Architecture Decision Records.
- Changelogs, release notes, migration guides, and incident postmortems.
- CI logs, compiler errors, linter reports, and test failure outputs.

Use for:

- Requirement -> plan -> implementation -> tests training.
- Issue -> PR -> review -> final patch training.
- Failure -> diagnosis -> fix training.
- Release/migration/project-management behavior.

Need to verify:

- Terms of service.
- License compatibility.
- PII and secret removal.
- Duplicate issue/PR templates.
- Contamination against eval repositories.

## Repository-Level Coding

### SWE-bench

- **SWE-bench: Can Language Models Resolve Real-World GitHub Issues?**
  - Link: https://arxiv.org/abs/2310.06770
  - Why it matters: evaluates models on real GitHub issue resolution, closer to
    practical software engineering than snippet benchmarks.
  - Use for: bug-fixing eval harness and issue-to-patch training format.
  - Caution: public benchmark contamination and test-quality issues require
    private/internal evals too.

- **SWE-bench OpenReview / ICLR version**
  - Link: https://openreview.net/pdf?id=VTF8yNQM66
  - Why it matters: peer-reviewed version with task construction details.
  - Use for: understanding benchmark design and limitations.

### SWE-bench Criticism And Decontamination

- **Saving SWE-Bench: A Benchmark Mutation Approach for Realistic Agent Evaluation**
  - Link: https://www.microsoft.com/en-us/research/publication/saving-swe-bench-a-benchmark-mutation-approach-for-realistic-agent-evaluation/
  - Why it matters: discusses realism, benchmark mutation, and evaluation issues
    for chat-based coding assistants.
  - Use for: building harder and less-contaminated internal benchmarks.
  - Caution: do not optimize only for public benchmark leaderboards.

- **SWE-rebench: Automated Pipeline for Decontaminated Evaluation**
  - Link: https://papers.cool/arxiv/2505.20411
  - Why it matters: focuses on continuously updated and contamination-aware SWE
    tasks.
  - Use for: internal benchmark generation strategy.

### RepoBench

- **RepoBench: Benchmarking Repository-Level Code Auto-Completion Systems**
  - Link: https://arxiv.org/abs/2306.03091
  - Why it matters: evaluates repository-level completion with cross-file
    context.
  - Use for: measuring context retrieval and repo-aware code completion.
  - Caution: completion is only one part of software engineering; also evaluate
    debugging, reviewing, and planning.

### Newer Repo-Level Benchmarks

- **RepoMod-Bench: Repository Modernization via Implementation-Agnostic Testing**
  - Link: https://arxiv.org/abs/2602.22518
  - Why it matters: targets modernization tasks, which are closer to real
    software maintenance than isolated coding puzzles.
  - Use for: migration/refactor eval design.

- **RACE-bench: Repository-Level Feature Addition With Intermediate Reasoning**
  - Link: https://arxiv.org/abs/2603.26337
  - Why it matters: evaluates feature addition and intermediate reasoning.
  - Use for: testing whether recurrent-depth helps multi-step implementation.

- **RealBench: Repo-Level Code Generation Aligned With Real-World Development**
  - Link: https://papers.cool/arxiv/2604.22659
  - Why it matters: focuses on real-world software development practices.
  - Use for: designing practical eval suites beyond public coding puzzles.

## Training Data And Workflow References

Useful data relationships for Tech-Vidvan LM:

- Issue -> discussion -> PR -> review -> final patch.
- Failing test/log -> diagnosis -> patch -> passing test.
- Requirement -> plan -> implementation -> tests -> release notes.
- Refactor request -> dependency analysis -> behavior-preserving patch.
- Security advisory -> vulnerable code -> fixed code -> regression test.

Reference families to study:

- Code Llama for code-specialist continuation and instruction tuning.
- BigCode/StarCoder for open code data and licensing practices.
- SWE-bench/SWE-rebench for issue-to-patch construction.
- RepoBench and newer repo-level benchmarks for cross-file context.

## Evaluation Principles

Tech-Vidvan LM should not be judged by a single benchmark.

Required eval groups:

- Snippet coding: HumanEval-like tasks for quick smoke tests.
- Repository completion: RepoBench-style cross-file completion.
- Bug fixing: SWE-bench-style issue resolution.
- Test repair: failing tests/logs to patch.
- Code review: hidden bug finding in diffs.
- Refactoring: behavior-preserving changes.
- Migration: API/framework upgrade tasks.
- Project management: PRD to implementation plan, risks, and milestones.
- Tool-use: search, read, edit, test, diagnose, retry.

Internal evals should be:

- Private or freshly generated.
- License-clean.
- Decontaminated against training data.
- Test-backed where possible.
- Reviewed for false negatives and flaky tests.

## Open Questions

- Do recurrent loops improve real code tasks, or only synthetic reasoning?
- How many loops are useful before returns diminish?
- Does ACT select more compute for genuinely harder software tasks?
- Does MLA preserve accuracy on long repository contexts?
- Do MoE experts specialize by language, framework, or task type?
- Is repository metadata more valuable than simply increasing context length?
- Which training signal best teaches planning: issues, PRs, agent traces, or
  human-written project plans?

## Current Priority

Read and summarize in this order:

1. DeepSeek-V2 and DeepSeekMoE for architecture.
2. Code Llama and BigCode/StarCoder for code LM training/data.
3. SWE-bench and RepoBench for evaluation design.
4. SWE-rebench and benchmark mutation work for contamination-resistant evals.
5. Looped transformer papers for deciding whether recurrence deserves scale.
