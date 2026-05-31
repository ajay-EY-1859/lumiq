# Tech-Vidvan LM Ideology

## Purpose

Is document ka goal ek naye language model ki ideology define karna hai: aisa
LM jo coding, project management, software engineering, debugging, architecture,
testing, documentation, DevOps, aur technical decision-making mein expert ho.

OpenMythos ko yahan final answer nahi maana gaya hai. Use ek architectural
blueprint ki tarah treat kiya gaya hai: kuch ideas directly useful hain, kuch
ideas ko modify karna hoga, aur kuch claims ko proof ke bina accept nahi karna
chahiye.

Target model ka working name: **Tech-Vidvan LM**.

## Core Belief

Tech-Vidvan LM ka primary domain "software work" hai, sirf code completion nahi.
Is model ko ek senior software engineer, technical lead, reviewer, debugger,
release manager, aur project planner ki tarah behave karna chahiye.

Model ko ye capabilities deeply learn karni chahiye:

- Existing codebase ko read karke local patterns follow karna.
- Requirements ko implementation plan mein convert karna.
- Code likhna, edit karna, test karna, aur failures diagnose karna.
- Bugs, regressions, security risks, race conditions, data-loss paths, aur
  maintainability problems identify karna.
- Architecture tradeoffs explain karna without overengineering.
- Project management artifacts banana: tickets, milestones, risk lists,
  acceptance criteria, release notes, migration plans.
- Tool-use aur repository operations ko reliable sequence mein perform karna.

## What To Take From OpenMythos

### 1. Recurrent-Depth Transformer

OpenMythos ka Prelude -> Recurrent Block -> Coda structure useful hai.

Tech work mein model ko often multi-step reasoning chahiye:

- Bug root-cause analysis.
- Cross-file dependency tracing.
- Refactor impact analysis.
- Test failure diagnosis.
- Planning across requirements, code, tests, and deployment.

Isliye recurrent-depth block ko retain karna chahiye. Same weights ko multiple
loops mein run karna "more thinking without more parameters" ka practical route
de sakta hai.

Recommended adaptation:

- Easy tasks ke liye fewer loops.
- Hard tasks ke liye more loops.
- Code review, debugging, architecture, and planning prompts ke liye higher
  loop budget.
- Autocomplete-style tasks ke liye lower loop budget.

### 2. Stable Input Injection

OpenMythos ka LTI-style input injection important hai. Recurrent loop mein original context drift nahi hona chahiye.

OpenMythos uses a discrete linear time-invariant (LTI) dynamical system representation (Parcae architecture, Prairie et al., 2026) to guarantee recurrent stability. The hidden state $h_t$ is updated at loop iteration $t+1$ as:
$$h_{t+1} = A \cdot h_t + B \cdot e + \text{Transformer}(h_t, e)$$
where $e$ is the encoded input from the Prelude.
To guarantee $\rho(A) < 1$ (spectral radius of $A$ is strictly less than 1), $A$ is parameterized as a continuous negative diagonal matrix and discretized using Zero-Order Hold (ZOH)/Euler discretization:
$$A_{\text{discrete}} = \exp(\Delta t \cdot A_{\text{continuous}})$$
In the codebase (`main.py` lines 710-726), this is modeled as:
$$A = \exp(-\exp(\text{clamp}(\log\_dt + \log\_A, -20, 20)))$$
where $\log\_dt$ is a learned scalar step-size $\Delta t$, and $\log\_A$ is a learned continuous negative matrix parameter. This guarantees $A \in (0, 1)$ strictly, preventing residual stream explosion even across deep sequence and loop lengths.

Software tasks mein context drift especially dangerous hai:

- Model ek file ka pattern bhool sakta hai.
- User ke constraints ignore kar sakta hai.
- Test failure ka original cause lose kar sakta hai.
- Refactor mein unrelated behavior change kar sakta hai.

Retain:

- Encoded input ko every recurrent loop mein inject karna.
- Stability constraint rakhna so hidden state explode/drift na kare.

Modify:

- Input injection ko structured context segments ke liye stronger banana: user request, repository files, tests, errors, tool output, and plan state.

### 3. Adaptive Computation Time

ACT halting useful hai because software tasks uniform nahi hote.

OpenMythos implements a crucial **Remainder Trick** to prevent hidden state leakage and maintain correct gradients. At loop iteration $t$, the halting probability is $p_t = \text{sigmoid}(W_{\text{halt}} \cdot h_t)$.
We keep a running cumulative halting probability $\text{cumulative}\_p$.
Once $\text{cumulative}\_p + p_t \ge \text{threshold}$ (usually 0.99), the gating weight for this loop is set exactly to the remainder:
$$\text{weight}_t = 1.0 - \text{cumulative}_p$$
All updates after this iteration are masked out using a boolean `still_running` mask. This guarantees that once a token is halted, its contribution is frozen at exactly 1.0 cumulative probability, avoiding hidden state leakage and stabilizing recurrent gradients.

Example:

- Simple syntax fix: low compute.
- Distributed systems bug: high compute.
- Security review: high compute.
- Formatting-only change: low compute.

Retain:

- Per-token ya per-segment adaptive compute.

Modify:

- ACT signal ko domain-aware heads se guide karna: code complexity, error density, dependency fan-out, diff size, and task type.

### 4. MLA Or GQA Attention

Long context software tasks ke liye KV cache efficiency critical hai. Repos, logs, stack traces, docs, and PR discussions easily long context bana dete hain.

Multi-head Latent Attention (MLA) compresses keys and values into a shared low-rank latent space:
- **Low-Rank Projection:** Key and value projections are compressed to $c_{kv} \in \mathbb{R}^{kv\_lora\_rank}$ through a projection matrix $W_{kv\_down}$.
- **RoPE Decoupling:** To avoid rotating cached states at each generation step, RoPE is applied to a separate decoupled head dimension $k_{rope} \in \mathbb{R}^{qk\_rope\_head\_dim}$.
- **Cache Footprint:** Cache stores $c_{kv}$ and $k_{rope}$ for each sequence position, which is a fraction of the memory needed for standard GQA or MHA, enabling full repository-level processing within limited GPU memory.

Retain:

- MLA as primary option for long-context and agentic coding workloads.
- GQA as simpler fallback for smaller research models.

Need:

- Correct RoPE/start-position handling.
- Long-context eval on real repositories.
- Cache correctness tests across multi-step editing sessions.

### 5. MoE In The Recurrent Block

Tech domain broad hai. Ek hi dense FFN sab kuch equally learn nahi karega. MoE experts useful ho sakte hain for specialization.

OpenMythos implements fine-grained routed experts and shared experts:
- **Shared Experts:** Captures common cross-domain knowledge (syntax, generic grammar, standard logic) so routed experts don't redundant-learn it.
- **Aux-Loss-Free Balancing:** To keep all experts utilized, learned expert-routing biases are adjusted outside the optimizer. The softmax/sigmoid selection uses these biases, but the actual gating weights are computed using unbiased scores, preventing gradient bias while enforcing uniform routing distribution.

Potential expert specializations:

- Python, JavaScript/TypeScript, Go, Rust, Java, C#, C/C++.
- Frontend, backend, database, distributed systems.
- Testing, debugging, performance, security, DevOps.
- Project planning, requirements, documentation.
- Code review and refactoring.

Retain:

- Routed experts plus shared experts.

Modify:

- Router ko domain/task labels se regularize karna.
- Load balancing ko strong banana so experts collapse na karein.
- Expert routing observability add karna for research.

### 6. Depth-Wise LoRA

Loop-index adaptation useful hai because first reasoning pass and later reasoning pass same role nahi nibhate.

Depth-wise LoRA and Loop-Index Embedding are essential to enable loop-specific roles in recurrent architectures:
- **Loop-Index Embedding:** OpenMythos injects sinusoidal embeddings `loop_index_embedding` into the first fraction of channels (`loop_dim = dim // 8`).
- **Depth-wise LoRA Adapter:** Rather than adding separate layers per loop, OpenMythos shares a low-rank linear bottleneck down-projection ($W_{\text{down}}$) and up-projection matrix ($B$) across all loops, while using a small per-loop look-up embedding scale vector ($\text{scale}[t]$) to modulate the transformation at each loop $t$:
$$\text{delta}(x, t) = (\text{down}(x) \odot \text{scale}[t]) \cdot B$$
This allows the recurrent block to implement functionally distinct phases per loop iteration (e.g. step 1: read/parse context, step 2: trace dependencies, step 3: propose changes) with virtually zero parameter overhead.

Software reasoning mein rough phases naturally exist:

- Parse request.
- Inspect context.
- Form hypothesis.
- Validate against code/tests.
- Produce patch or plan.
- Re-check side effects.

Retain:

- Per-loop adaptation.

Modify:

- Loop roles ko weakly supervise karna with traces: read -> plan -> edit -> test -> revise -> summarize.

## What Not To Copy Blindly

OpenMythos ko speculative reconstruction maana gaya hai. Isliye:

- "Claude-like" ya "frontier-like" claims copy nahi karne.
- Scaling table ko proof ke bina accept nahi karna.
- 1M context claims ko real benchmark ke bina product promise nahi banana.
- 30B token target ko final nahi maana; tech-specialist LM ke liye data mix
  aur quality zyada important hogi.
- Generic web pretraining ko enough nahi maana.
## Tech-Vidvan Documentation Map

The following documents capture the practical roadmap for the Tech-Vidvan LM:

- `tech_vidvan_lm/architecture.md` — how OpenMythos architecture maps to Tech-Vidvan needs
- `tech_vidvan_lm/data.md` — data mix and dataset strategy for software engineering reasoning
- `tech_vidvan_lm/eval.md` — evaluation task categories, benchmarks, and quality criteria
- `tech_vidvan_lm/references.md` — research sources and root-project integration

Use these documents together to move from vision to implementable design.
## Model Identity

Tech-Vidvan LM ka identity yeh hona chahiye:

- It is a technical work model, not a chatty general assistant.
- It optimizes for correctness, maintainability, and practical delivery.
- It prefers reading existing context before proposing changes.
- It is comfortable saying "insufficient evidence" when code/data does not
  support a claim.
- It treats tests, logs, and source code as higher authority than intuition.
- It produces compact, actionable outputs.

## Data Ideology

### Pretraining Mix

General natural language still needed hai, but model ka core diet technical hona
chahiye.

Recommended data categories:

- Permissively licensed source code.
- Repository-level code with file paths and project structure.
- README, API docs, architecture docs, ADRs, changelogs.
- Unit tests, integration tests, benchmark files.
- Issues, PR descriptions, review comments, commit messages.
- Stack traces, build logs, CI logs, compiler errors, linter output.
- Package manifests and lockfiles.
- Infrastructure files: Dockerfile, docker-compose, Terraform, Kubernetes,
  GitHub Actions, Azure/GCP/AWS config.
- Security advisories and fixed vulnerable code pairs where license permits.
- Project management artifacts: tickets, acceptance criteria, roadmap docs,
  sprint notes, incident postmortems.

### Code Data Requirements

Raw code alone enough nahi hai. Model ko software engineering seekhni hai, so
data should preserve relationships:

- Before/after diffs.
- Issue -> discussion -> PR -> review -> final patch.
- Error log -> diagnosis -> fix -> passing test.
- Requirement -> design -> implementation -> tests -> release note.
- Bug report -> reproduction -> regression test -> patch.

### Instruction And Agent Data

Instruction tuning mein generic Q&A kam, real workflows zyada hone chahiye.

High-value traces:

- "Read these files, identify the bug, patch it, run tests."
- "Review this diff and find risks."
- "Turn this product requirement into implementation tasks."
- "Plan a migration with rollback strategy."
- "Explain this stack trace using source references."
- "Generate tests for uncovered edge cases."
- "Refactor while preserving public API."

### Data Quality Rules

- Prefer permissive licenses and clean provenance.
- Deduplicate aggressively at repository and file level.
- Keep file paths, language tags, and dependency metadata.
- Filter toy snippets that do not represent real projects.
- Preserve tests and docs with code.
- Avoid training heavily on broken, insecure, or obsolete patterns unless
  examples are labeled as negative/fix data.

## Training Phases

### Phase 0: Tiny Research Model

Goal: prove architecture and pipeline.

Suggested size:

- 50M to 300M parameters.
- Short context first: 2k to 8k.
- GQA acceptable.
- Dense FFN acceptable before MoE.

Must validate:

- Loss decreases normally.
- Generation does not collapse.
- Recurrent loops change outputs meaningfully.
- More loops help on at least some reasoning tasks.
- KV cache correctness.

### Phase 1: Small Tech Specialist

Goal: useful coding assistant baseline.

Suggested size:

- 1B to 3B parameters.
- 8k to 32k context.
- MLA preferred.
- Recurrent block retained.
- Optional small MoE.

Training:

- Heavy code/docs/tests pretraining.
- Supervised instruction tuning on software workflows.
- Eval-gated releases.

### Phase 2: Agentic Engineer Model

Goal: repo-level editing and project execution.

Suggested size:

- 7B to 14B active-equivalent model, depending on compute.
- MoE for broad specialization.
- Long context: 32k to 128k first, then beyond only if eval proves value.
- Tool-use traces for shell, tests, search, browser, package managers, and
  issue trackers.

Training:

- Multi-turn repository tasks.
- Diff generation and patch repair.
- Test-feedback loops.
- Code review and planning tasks.
- Preference optimization for correctness, minimality, and maintainability.

### Phase 3: Organization-Grade Tech Model

Goal: reliable technical partner across code, planning, and operations.

Needs:

- Strong retrieval integration.
- Secure tool-use policy.
- Repository memory.
- Evaluation per language/framework.
- Auditability for code changes.
- Clear uncertainty and source grounding.

## Evaluation Ideology

Generic benchmarks are not enough. Tech-Vidvan LM ko real software work par
measure karna hoga.

Core eval groups:

- Code generation: HumanEval-like tasks, but multi-file and test-backed.
- Bug fixing: issue + repo + failing test -> patch.
- Code review: identify real defects in diffs.
- Refactoring: behavior-preserving changes with tests.
- Build/debug: compile/test failure -> diagnosis/fix.
- Project planning: PRD -> tasks, milestones, risks, acceptance criteria.
- Documentation: code -> accurate docs and migration notes.
- Security: vulnerability identification and secure patching.
- Tool-use: search files, inspect logs, run tests, edit, re-run.

Success metrics:

- Pass rate on hidden tests.
- Regression rate.
- Patch minimality.
- Build/test reliability.
- Correct file selection.
- False-positive rate in reviews.
- Hallucinated API rate.
- Ability to cite source lines from provided context.
- Long-context retrieval accuracy.

## Behavioral Ideology

The model should behave like a rigorous engineer:

- Read first, then change.
- Prefer local codebase patterns.
- Make small, reviewable patches.
- Do not invent APIs when existing helpers exist.
- Treat tests as executable specification.
- Mention uncertainty when evidence is weak.
- Keep user-facing explanations concise.
- Avoid generic advice when concrete files/logs are available.
- Preserve user changes and avoid unrelated rewrites.
- Separate findings from suggestions in reviews.

## Architecture Proposal

Initial Tech-Vidvan architecture:

```text
Tokens + structured metadata
        |
Embedding + file/path/language/task embeddings
        |
Prelude transformer blocks
        |
Recurrent reasoning block
  - MLA attention
  - MoE FFN
  - stable input injection
  - ACT halting
  - depth-wise adapters
        |
Coda transformer blocks
        |
Heads:
  - next-token LM head
  - optional task-type head
  - optional edit/diff quality head
  - optional tool-action head
```

Structured metadata should include:

- File path.
- Language/framework.
- Segment type: code, test, docs, log, issue, PR, command output.
- Role: user request, system instruction, repository context, generated patch.
- Time/order for multi-step traces.

### Unified Cross-Layer Depth Attention (MoDA - Mixture-of-Depths Attention)

OpenMythos implements an alternative, high-potential research concept in `moda.py`: **Mixture-of-Depths Attention (MoDA)**.
Instead of treating each layer's attention as isolated, MoDA enables each attention head in the recurrent block to jointly attend to:
- Causal sequence key-values at the **current layer**.
- Depth key-values from **all preceding layers** at the exact same token position.

This is extremely powerful for technical/coding tasks, as it allows queries to perform a single unified softmax computation over both sequence-width (context/code tokens) and execution-depth (historical layers' hidden states):
$$S_{ij}^{\text{seq}} = \frac{Q_i K_j^T}{\sqrt{d}}, \quad S_{il}^{\text{depth}} = \frac{Q_i (K_l^{\text{depth}})^T}{\sqrt{d}}$$
$$\text{AttnWeight} = \text{Softmax}([S^{\text{seq}} \mid S^{\text{depth}}])$$

For Tech-Vidvan, we propose MoDA as a primary research topic: it allows the model to trace deep execution and structural paths across multiple layers without inflating context length or FLOPs.


## Product Capabilities To Optimize

### Coding

- Generate idiomatic code in existing style.
- Complete partial functions.
- Add tests.
- Explain complex code.
- Migrate APIs.
- Fix compiler/linter/test failures.

### Software Engineering

- Architecture tradeoff analysis.
- Dependency and interface reasoning.
- Data model changes.
- Performance diagnosis.
- Security-aware implementation.
- Observability and reliability planning.

### Project Management

- Convert vague goals into scoped tasks.
- Write acceptance criteria.
- Identify blockers and risks.
- Break work into milestones.
- Draft issue descriptions and PR summaries.
- Produce migration and rollout plans.

### Technical Research

- Compare libraries/frameworks using current docs when available.
- Summarize technical papers/specs.
- Extract implementation requirements from docs.
- Build proof-of-concepts.

## Safety And Reliability

Tech model ka risk mainly wrong code, data loss, insecure suggestions, and
overconfident project decisions hai.

Required safeguards:

- Never silently change unrelated files.
- Prefer tests before and after edits.
- Flag destructive commands.
- Refuse credential exfiltration and malware creation.
- Warn on insecure defaults.
- Track provenance of generated code when using external examples.
- Use license-aware data collection.
- Keep eval sets private and contamination-checked.

## Research Questions

Before scaling, ye questions answer karne honge:

- Kya recurrent loops coding/debugging tasks par measurable gain dete hain?
- Kya ACT reliably easy vs hard tasks separate karta hai aur hidden state leak toh nahi karta?
- Kya MLA long repo context mein accuracy preserve karta hai?
- Kya MoE experts naturally technical domains specialize karte hain?
- Kya loop-depth increase inference-time reasoning improve karta hai ya noise add karta hai?
- Kya structured metadata embeddings repository understanding improve karte hain?
- Kya tool-use traces next-action prediction ko reliable banate hain?
- Kya Mixture-of-Depths Attention (MoDA) cross-file dependency aur execution path tracing ko structural attention matrix ke zariye directly learn kar sakta hai?
- Kya auxiliary-loss-free expert load balancing technical/domain MoE models mein specific experts (jaise compiler logs expert vs rust code expert) ke collapse ko avoid kar sakta hai?
- Training max_loop_iters se OOD (Out-of-Distribution) loop extrapolation ke limits kya hain technical planning aur bug-fixing tasks mein?


## Minimum Viable Roadmap

1. Build a tiny Tech-Vidvan config from OpenMythos.
2. Create curated code/docs/tests dataset with file metadata.
3. Train tiny model and compare recurrent vs non-recurrent baseline.
4. Add software workflow instruction tuning.
5. Build eval harness for bug fixing, code review, and project planning.
6. Scale only after eval shows clear gains.
7. Add MoE and MLA only when baseline is stable enough to justify complexity.
8. Train agentic traces with tool feedback.
9. Release only with benchmark report and known limitations.

## Final Principle

Tech-Vidvan LM ka mission "zyada bolna" nahi, "sahi technical kaam karna" hai.
Architecture ka har decision isi standard se judge hona chahiye:

**Does it make the model better at real software work, with fewer mistakes and
clearer reasoning?**

Agar answer measurable nahi hai, decision ko research hypothesis maana jayega,
foundation nahi.
