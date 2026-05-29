# Lumiq IDE - Comprehensive Test Suite

> Last Updated: 2026-05-21  
> Difficulty Level: **HARD** - Tests designed to validate edge cases, race conditions, security, and complex workflows

---

## Table of Contents

1. [Chat & Agent System Tests](#1-chat--agent-system-tests)
2. [Multi-Provider Tests](#2-multi-provider-tests)
3. [Tool Execution Tests](#3-tool-execution-tests)
4. [Permission & Security Tests](#4-permission--security-tests)
5. [MCP Integration Tests](#5-mcp-integration-tests)
6. [Database & Persistence Tests](#6-database--persistence-tests)
7. [Context Management Tests](#7-context-management-tests)
8. [File Operation Tests](#8-file-operation-tests)
9. [IPC Communication Tests](#9-ipc-communication-tests)
10. [Error Handling & Recovery Tests](#10-error-handling--recovery-tests)
11. [Performance & Stress Tests](#11-performance--stress-tests)
12. [Workspace & Session Tests](#12-workspace--session-tests)
13. [OAuth & Authentication Tests](#13-oauth--authentication-tests)

---

## 1. Chat & Agent System Tests

### TC-1.1: Streaming Response with Interrupted Connection
**Objective:** Verify chat streaming handles network interruption gracefully
**Preconditions:**
- Session active with valid provider configured
- Chat UI ready to receive messages
**Steps:**
1. Send a long-form user message requiring streaming response
2. After first 50 tokens received, simulate network disconnection
3. Observe UI behavior and socket handling
4. Resume connection after 5 seconds
5. Send new message to verify recovery
**Expected Result:** 
- Partial response saved to DB
- User notified of interruption
- New message succeeds without requiring session recreation
- No data corruption in message history

### TC-1.2: Multiple Tool Calls in Single Turn with Circular Dependencies
**Objective:** Test handling of malformed or circular tool call patterns
**Preconditions:**
- Agent loop initialized
- Tool definitions available
**Steps:**
1. Configure provider to return tool calls with circular references
   - Tool A calls Tool B
   - Tool B calls Tool A
   - Tool C depends on result of both
2. Send message triggering this pattern
3. Monitor executor for circular detection
4. Attempt recovery strategy
**Expected Result:**
- Circular dependency detected and blocked
- Clear error message to user
- Conversation continues without hanging
- Session remains clean for next message

### TC-1.3: Context Trimming with Mixed Role Messages
**Objective:** Verify context manager correctly trims history while preserving coherence
**Preconditions:**
- Session with 100+ messages of mixed roles (user, assistant, system, tool)
- Context limit set to 4000 tokens
**Steps:**
1. Add messages incrementally until approaching context limit
2. Send message requiring full context window
3. Observe trimming algorithm behavior
4. Verify preserved messages maintain conversation coherence
5. Send follow-up requiring trimmed context
**Expected Result:**
- Oldest messages trimmed first
- System messages never trimmed
- Tool result messages preserved longer than intermediate responses
- Coherence maintained in 90%+ of cases
- Token count never exceeds limit

### TC-1.4: Cancellation During Multi-Tool Execution
**Objective:** Verify cancellation properly aborts in-flight tools
**Preconditions:**
- Multiple long-running tools queued (e.g., Bash + FileWrite + WebFetch)
- Cancellation signal available
**Steps:**
1. Trigger message with 5 queued tools
2. After tool 2 completes, send cancellation signal
3. Monitor abort behavior for tools 3-5
4. Check database state
5. Attempt to resume with new message
**Expected Result:**
- Tools 3-5 receive abort signal within 100ms
- Partial results from tool 2 committed to DB
- Tool 3 partial execution rolled back (if applicable)
- Tools 4-5 never execute
- New message starts fresh without contamination

### TC-1.5: Message Persistence During Async Provider Failure
**Objective:** Verify message saves even when provider call fails mid-stream
**Preconditions:**
- Database transaction logging enabled
- Provider mock configured to fail mid-stream
**Steps:**
1. Send message with failing provider
2. Monitor savepoint before provider call
3. Simulate provider crash after 3 tokens streamed
4. Check database for message record
5. Query message history
**Expected Result:**
- User message saved before provider call
- Assistant message created with partial content
- Partial content marked as incomplete/error status
- Message ID consistent across saves
- Retry mechanism available

### TC-1.6: Rapid Sequential Messages (10 messages in 5 seconds)
**Objective:** Test handling of message queue under high throughput
**Preconditions:**
- Session initialized
- Provider configured with rate limiting
**Steps:**
1. Send 10 messages rapidly (one per 500ms)
2. Observe message ordering in DB
3. Monitor tool executor queue
4. Check response ordering
5. Verify final message history order
**Expected Result:**
- All messages processed in order
- No message loss
- Response order matches input order
- DB transaction log shows sequential IDs
- No out-of-order tool executions

---

## 2. Multi-Provider Tests

### TC-2.1: Provider Switching Mid-Session
**Objective:** Test switching between different providers in same session
**Preconditions:**
- 3+ providers configured (e.g., OpenAI, Anthropic, Ollama)
- Session created with Provider A
**Steps:**
1. Send message 1 with Provider A (GPT-4)
2. Mid-session, switch to Provider B (Claude)
3. Send message 2, verify using Claude
4. Add message from Provider C (Ollama local)
5. Query session history - verify provider per message
6. Re-render conversation - verify provider switching visual cues
**Expected Result:**
- Message 1 shows OpenAI provider/model
- Message 2 shows Anthropic provider/model
- Message 3 shows Ollama provider/model
- All messages in same session ID
- No credential leakage between providers
- Response formatting consistent per provider

### TC-2.2: Provider Failover Chain
**Objective:** Test automatic failover across multiple providers
**Preconditions:**
- Failover configuration: Primary (OpenAI), Secondary (Anthropic), Tertiary (Ollama)
- Primary provider API key invalid
**Steps:**
1. Send message expecting Primary provider failure
2. Observe automatic failover to Secondary
3. If Secondary also fails, verify Tertiary attempt
4. Log failover events
5. Verify message ultimately succeeds
6. Check provider selection in message record
**Expected Result:**
- Primary failure detected within 3 seconds
- Automatic switch to Secondary
- If Secondary fails, try Tertiary
- Message succeeds via at least one provider
- Failover chain logged with timestamps
- User notified of provider switch

### TC-2.3: Model Mismatch - Session Model vs. Chat Model
**Objective:** Verify handling of model selection inconsistencies
**Preconditions:**
- Session configured for GPT-4
- Chat request specifies GPT-3.5-Turbo
**Steps:**
1. Create session with model: gpt-4-turbo
2. Send chat message requesting: gpt-3.5-turbo
3. Check which model actually used
4. Send 3 more messages alternating models
5. Query DB for actual model per message
**Expected Result:**
- Chat request model overrides session default
- Actual model execution logged
- No silent fallback to different model
- User informed of model switch
- Billing/token counts accurate per model

### TC-2.4: Provider Rate Limit Handling
**Objective:** Test handling of provider rate limit responses
**Preconditions:**
- Provider mock configured with rate limit (5 req/min)
- 7 messages queued for rapid send
**Steps:**
1. Send 7 messages rapidly
2. Observe rate limit response on message 6
3. Monitor retry logic
4. Check exponential backoff implementation
5. Send message 7 - verify eventual success
6. Verify message ordering preserved
**Expected Result:**
- Messages 1-5 process immediately
- Message 6 triggers rate limit (HTTP 429)
- Automatic retry with exponential backoff
- Message 7 queued and processed after 6
- Retry-After header honored
- All messages eventually succeed

### TC-2.5: Custom OpenAI-Compatible Provider (Edge Case)
**Objective:** Test custom provider configuration with non-standard base URL
**Preconditions:**
- Custom endpoint configured: https://localhost:8000/v1
- SSL certificate self-signed
**Steps:**
1. Configure custom provider with localhost endpoint
2. Send message
3. Verify SSL warning handled (if applicable)
4. Check request format matches OpenAI standard
5. Verify response parsing
6. Test streaming works correctly
**Expected Result:**
- SSL verification can be bypassed for localhost
- Request format compatible with OpenAI API spec
- Response parsed correctly
- Streaming works without chunking issues
- Error responses handled per provider

### TC-2.6: Bedrock Provider with STS AssumeRole
**Objective:** Test AWS Bedrock with temporary credentials
**Preconditions:**
- AWS credentials configured with STS token
- Token has 15-minute expiration
**Steps:**
1. Send message at T+0:00 (fresh token)
2. Send message at T+10:00 (token still valid)
3. Mock token expiration at T+15:00
4. Send message at T+20:00 (token expired)
5. Verify token refresh or credential error
6. Verify message ultimately succeeds or fails gracefully
**Expected Result:**
- Messages at T+0 and T+10 succeed
- Token expiration detected at T+20
- Automatic refresh attempted (if configured)
- Clear error if refresh unavailable
- No crashes or hung processes

---

## 3. Tool Execution Tests

### TC-3.1: Bash Tool with Dangerous Commands
**Objective:** Verify security sandbox prevents harmful shell commands
**Preconditions:**
- Permission mode: LIMITED
- BashTool executable
**Steps:**
1. Attempt command: `rm -rf /`
2. Attempt command: `killall -9 node`
3. Attempt command: `cat /etc/passwd`
4. Attempt command with redirects to sensitive paths
5. Attempt symlink traversal attacks
**Expected Result:**
- All dangerous commands blocked or sandboxed
- No system files modified
- Error messages explain why command blocked
- User can request elevated mode if needed
- Security audit log updated

### TC-3.2: File Operation Race Conditions
**Objective:** Test concurrent file operations don't cause corruption
**Preconditions:**
- FileReadTool, FileWriteTool, FileEditTool initialized
- Test file: workspace/test.txt (initial: "content v1")
**Steps:**
1. Queue: FileRead (test.txt) - concurrent with Write
2. Queue: FileWrite (test.txt, "content v2") 
3. Queue: FileRead (test.txt) - should see v1 or v2 (not corrupted)
4. Queue: FileEdit (test.txt, add line) - concurrent with Read
5. Execute all 4 concurrently
6. Verify final file state consistency
**Expected Result:**
- Read operations see consistent snapshot
- Write operations complete atomically
- No partial writes visible
- File never in corrupted state
- Concurrency level up to MAX_CONCURRENCY (10)

### TC-3.3: Glob Pattern Edge Cases
**Objective:** Test glob tool with complex patterns
**Preconditions:**
- Workspace structure:
  ```
  workspace/
    src/
      app.ts
      app.test.ts
    build/
      out.js
    node_modules/
      pkg/
        src/
          index.ts
  ```
**Steps:**
1. Pattern: `**/*.ts` - should match all TypeScript files
2. Pattern: `src/**/*.test.ts` - should match only test files in src
3. Pattern: `**/*.ts` with exclude `node_modules` - verify exclusion
4. Pattern: `{src,build}/**` - alternation syntax
5. Pattern with `.` for hidden files
6. Pattern matching symlinks (if present)
**Expected Result:**
- Pattern 1 returns app.ts, app.test.ts, index.ts
- Pattern 2 returns only app.test.ts
- Pattern 3 excludes node_modules successfully
- Pattern 4 returns src and build contents
- Hidden files handled per configuration
- Symlinks handled correctly (no infinite loops)

### TC-3.4: Grep with Large Files (100MB+)
**Objective:** Test grep tool handles large files efficiently
**Preconditions:**
- Test file: 100MB log file with 2M lines
- Searching for specific pattern
**Steps:**
1. Grep for: "ERROR.*timeout"
2. Monitor memory usage during search
3. Set timeout to 5 seconds
4. Send regex with catastrophic backtracking potential
5. Attempt grep with 1000 results to show (pagination)
6. Grep with binary file (should handle gracefully)
**Expected Result:**
- Memory usage stays under 500MB
- Search completes in <3 seconds for patterns
- Regex with backtracking killed by timeout
- Results paginated correctly
- Binary files handled without crashing
- Line numbers accurate

### TC-3.5: MultiFileEditTool - Atomic Batch Operations
**Objective:** Test multi-file edit either all succeeds or all fails
**Preconditions:**
- 3 files to edit: file1.ts, file2.ts, file3.ts
- Edit file1 and file2 valid, edit file3 syntax invalid
**Steps:**
1. Prepare batch: [edit file1, edit file2, edit file3]
2. Execute batch
3. Check if all 3 succeeded or all 3 failed (atomicity)
4. If all failed, verify rollback
5. Send second batch with valid edits - should all succeed
**Expected Result:**
- If any edit fails, all rolled back (atomic)
- No partial edits applied
- Rollback doesn't affect other files
- Success case applies all edits
- Transaction log shows all-or-nothing semantics

### TC-3.6: Git Tool with Detached HEAD and Conflicts
**Objective:** Test git operations in complex repo states
**Preconditions:**
- Git repo with feature branch
- Merge conflict present
- Detached HEAD state
**Steps:**
1. Checkout to detached HEAD (e.g., git checkout commit-hash)
2. Attempt to run git operations
3. Verify state detection (detached HEAD warning)
4. Create branch from detached state
5. Switch to branch with unmerged changes
6. Execute git command - verify conflict detection
7. Attempt merge/rebase - verify conflict reporting
**Expected Result:**
- Detached HEAD state detected and reported
- Operations continue safely
- Branching from detached HEAD works
- Merge conflicts detected and reported clearly
- No auto-resolve of conflicts
- Merge state machine enforced

### TC-3.7: WebFetchTool with Redirects and Timeouts
**Objective:** Test HTTP request handling edge cases
**Preconditions:**
- Server with redirect chain: /a -> /b -> /c -> content
- Server with timeout after 2 seconds
- Server with large content (100MB)
**Steps:**
1. Fetch URL with 5-redirect chain - verify final content
2. Fetch URL that times out after 2s - expect timeout error
3. Fetch large content with streaming
4. Fetch with 301/302/303/307 redirect codes
5. Fetch with SSL certificate error (self-signed)
6. Fetch with invalid domain
**Expected Result:**
- Redirect chain followed up to limit (e.g., 10)
- Timeout enforced (default 30s, configurable)
- Large content streamed, not buffered fully
- All redirect codes handled per spec
- SSL errors reported (with bypass option)
- DNS/connection errors logged clearly

### TC-3.8: TerminalTool - Long Running Process Termination
**Objective:** Test termination of long-running terminal processes
**Preconditions:**
- TerminalTool initialized
- Process: `python3 -c "while True: print('x'); time.sleep(1)"`
**Steps:**
1. Start long-running process
2. Stream output for 3 seconds
3. Send termination signal (SIGTERM)
4. Wait 2 seconds
5. Send force kill (SIGKILL) if still running
6. Check exit code
7. Verify cleanup of any child processes
**Expected Result:**
- Process starts and streams output
- SIGTERM signal sent after 3s
- Process terminates within 2s of SIGTERM
- Exit code indicates termination
- No zombie processes remain
- New processes can start after cleanup

### TC-3.9: NotebookTool - Execute with Dependencies and Async
**Objective:** Test notebook execution with async cells
**Preconditions:**
- Jupyter notebook with cells:
  - Cell 1: import asyncio, define async func
  - Cell 2: await asyncio function
  - Cell 3: visualization with matplotlib
**Steps:**
1. Execute Cell 1 - should define async function
2. Execute Cell 2 - should await properly
3. Execute Cell 3 - capture image output
4. Check variable state preservation between cells
5. Inject code into running kernel
6. Clear kernel state and re-execute
**Expected Result:**
- Async cells execute correctly
- Variable state preserved across cells
- Image outputs captured as base64 or file
- Code injection works safely
- Kernel state can be reset
- Errors in one cell don't break kernel

### TC-3.10: ImageReadTool - Metadata Extraction and Format Handling
**Objective:** Test image reading with various formats and edge cases
**Preconditions:**
- Images: PNG, JPEG, GIF, WebP, SVG
- Image with EXIF data
- Corrupted/truncated image
- Large image (50MP)
**Steps:**
1. Read PNG image - verify dimensions, bit depth
2. Read JPEG with EXIF - extract metadata
3. Read animated GIF - detect animation
4. Read corrupt image - expect error or partial data
5. Read 50MP image - verify performance
6. Read SVG - handle vector format
**Expected Result:**
- Metadata extracted correctly
- Dimensions/format detected
- EXIF data readable
- Animated images detected
- Corrupt images error gracefully
- Large images don't crash or hang
- Vector formats handled differently

---

## 4. Permission & Security Tests

### TC-4.1: Permission Mode Transitions
**Objective:** Test switching permission modes and behavior changes
**Preconditions:**
- Session initialized
- Tool: FileWriteTool queued
**Steps:**
1. Start in MANUAL mode - BashTool requires approval
2. Send message with BashTool - approval request appears
3. Without approving, switch to AUTO mode
4. Send same message - tool executes without approval
5. Switch to DENIED mode - tool blocked
6. Verify each mode transition in audit log
**Expected Result:**
- MANUAL requires explicit approval (appears in approval queue)
- AUTO auto-executes without prompt
- DENIED blocks execution with reason
- Mode switch immediate (no cache delay)
- Audit log tracks all mode transitions
- Pending approvals cleared when switching modes

### TC-4.2: Per-Tool Allow/Deny Override
**Objective:** Test per-tool settings override global permission mode
**Preconditions:**
- Permission mode: AUTO (auto-approve most tools)
- Per-tool settings: FileWriteTool set to always-deny
**Steps:**
1. Send message with FileWriteTool
2. Verify tool blocked despite AUTO mode
3. Observe error message indicating per-tool override
4. Change FileWriteTool to always-allow
5. Send message again - tool executes
6. Verify audit trail shows per-tool override reason
**Expected Result:**
- Per-tool setting takes precedence over global mode
- always-deny blocks even in AUTO mode
- always-allow permits even in MANUAL mode
- Error messages explain why blocked/allowed
- Audit log shows precedence rule applied

### TC-4.3: API Key Encryption and Decryption
**Objective:** Test that API keys are encrypted at rest and decrypted safely
**Preconditions:**
- SQLite database accessible
- API key stored: "sk-1234567890abcdefghij"
**Steps:**
1. Add provider with API key
2. Query database directly (raw SQL)
3. Verify key is not stored in plain text
4. Retrieve provider config via API
5. Verify key is decrypted correctly
6. Send message using decrypted key
7. Verify key never logged or exposed
**Expected Result:**
- Key stored encrypted in DB (unreadable as plain text)
- Key decrypted in memory when needed
- Decrypted key never written to logs
- Message successfully sent with decrypted key
- Key removal/rotation updates DB correctly
- Encryption algorithm clearly specified (e.g., AES-256)

### TC-4.4: SQLi Protection - Malicious Input in Tool Arguments
**Objective:** Test parameterized queries protect against SQL injection
**Preconditions:**
- FileReadTool with file path input
- Malicious input: `../../../etc/passwd'; DROP TABLE sessions;--`
**Steps:**
1. Send tool call with SQL injection attempt in file path
2. Verify tool treats as literal path (escaped/parameterized)
3. Tool should fail to read injected path (doesn't exist)
4. Verify sessions table still exists
5. Check logs for injection attempt detection
6. Database schema unchanged
**Expected Result:**
- Input treated as literal string, not SQL
- No database tables dropped
- Tool returns "file not found" error
- Sessions table intact
- Security monitoring logs injection attempt
- No crashes or undefined behavior

### TC-4.5: XSS Prevention in Chat Rendering
**Objective:** Test chat messages with JavaScript/HTML injection
**Preconditions:**
- Malicious message: `<script>alert('xss')</script>user input`
- Renderer displaying chat
**Steps:**
1. Send message containing JavaScript
2. Observe rendering in chat UI
3. Verify script not executed (console should be clean)
4. Verify HTML markup rendered as escaped text
5. Send message with img tag onload event
6. Verify event not triggered
**Expected Result:**
- JavaScript not executed
- HTML tags escaped and shown as text
- Event handlers not triggered
- Message text displayed safely
- Markdown rendering sanitized (if supported)
- No console errors or security warnings

### TC-4.6: Workspace Boundary Enforcement
**Objective:** Test that file operations stay within workspace
**Preconditions:**
- Workspace set to `/home/user/myproject`
- FileReadTool, FileWriteTool active
**Steps:**
1. Attempt read: `/home/user/myproject/../../../etc/passwd`
2. Attempt write to `/tmp/escape.txt`
3. Attempt read with symlink pointing outside workspace
4. Attempt relative path: `../../sensitive_file`
5. Read file within workspace: `src/app.ts`
**Expected Result:**
- Path traversal detected and blocked
- Error message: "Path outside workspace"
- Symlink targets validated
- Relative paths resolved and validated
- Legitimate workspace files accessible
- Audit log tracks boundary violation attempts

### TC-4.7: Keytar Integration for Secure Storage
**Objective:** Test keychain/credential manager integration
**Preconditions:**
- System has keychain/credential manager available
- OAuth tokens or sensitive credentials
**Steps:**
1. Store OAuth token in keytar
2. Retrieve token from keytar
3. Verify encryption by native OS mechanism
4. Simulate keytar unavailability (mock failure)
5. Verify fallback behavior
6. Update token in keytar
**Expected Result:**
- Credentials stored in native keychain (not plain text in DB)
- Retrieval successful when keychain available
- Fallback to encrypted DB if keychain unavailable
- Token updates reflected in keychain
- No credentials logged
- Keychain errors handled gracefully

### TC-4.8: Session Isolation
**Objective:** Test that sessions don't leak data between each other
**Preconditions:**
- Session A: User A with private data
- Session B: User B (should not see User A data)
**Steps:**
1. Send message in Session A with file content
2. Query Session B's message history
3. Verify Session B cannot see Session A messages
4. Send message in Session B
5. Query Session A's message history - should not see Session B
6. Verify tool execution results isolated
**Expected Result:**
- Session A messages not visible in Session B
- Session B messages not visible in Session A
- Tool results don't leak between sessions
- Database queries filtered by sessionId
- No accidental data cross-contamination

---

## 5. MCP Integration Tests

### TC-5.1: MCP Server Lifecycle - Start, Fail, Restart
**Objective:** Test MCP server startup, failure recovery, and restart
**Preconditions:**
- MCP server definition configured: /path/to/mcp_server.py
- Server script has intentional failure on first run
**Steps:**
1. Attempt to start MCP server
2. Server fails (crashes immediately)
3. Monitor error capture and logging
4. Attempt restart (should show previous error)
5. Fix underlying issue (mock)
6. Restart server - should succeed
7. Verify tools available after restart
**Expected Result:**
- Initial start failure captured with stderr
- Error message displayed to user
- Restart attempts logged
- Successful restart refreshes tool list
- Tools from server available in tool registry
- Retry logic works without manual intervention

### TC-5.2: MCP Tool Invocation with Complex Input Schema
**Objective:** Test MCP tool calls with nested schemas
**Preconditions:**
- MCP server provides tool: `search_api` with complex schema:
  ```json
  {
    "parameters": {
      "type": "object",
      "properties": {
        "query": {"type": "string"},
        "filters": {
          "type": "object",
          "properties": {
            "date_range": {
              "type": "object",
              "properties": {
                "from": {"type": "string", "format": "date"},
                "to": {"type": "string", "format": "date"}
              }
            },
            "tags": {"type": "array", "items": {"type": "string"}}
          }
        }
      },
      "required": ["query"]
    }
  }
  ```
**Steps:**
1. Invoke tool with full nested input
2. Verify schema validation before execution
3. Test with missing required fields - expect validation error
4. Test with extra fields - verify ignored or flagged
5. Test with wrong data types in nested objects
6. Test with array items of wrong type
**Expected Result:**
- Complex schema properly validated
- Missing required fields caught before execution
- Extra fields handled per schema spec
- Type mismatches detected
- Clear validation error messages
- Tool not invoked with invalid input

### TC-5.3: MCP Server Stdio Handling with Deadlock Prevention
**Objective:** Test stdio communication doesn't deadlock
**Preconditions:**
- MCP server that sends large JSON responses (>64KB)
- Buffering limits smaller than message size
**Steps:**
1. Invoke tool that returns large response
2. Monitor stdin/stdout buffers
3. Verify non-blocking I/O or buffer management
4. Send multiple tool calls in quick succession
5. Monitor for deadlock (timeout after 10 seconds)
6. Verify all responses received
**Expected Result:**
- Large responses don't cause deadlock
- Non-blocking I/O properly implemented
- All tool calls processed in order
- No timeouts or hanging processes
- Buffer management prevents overflow
- Stdio communication remains responsive

### TC-5.4: MCP Tool Approval Workflow
**Objective:** Test tool approval specifically for MCP tools
**Preconditions:**
- MCP server provides tool: `write_database`
- Permission mode: MANUAL
**Steps:**
1. Send message requesting MCP tool execution
2. Approval request appears for MCP tool
3. Tool call ID and input visible in approval UI
4. User denies approval
5. Verify tool not executed
6. Send new message, approve this time
7. Verify tool executes with correct arguments
8. Check execution logged
**Expected Result:**
- MCP tool approval distinct from built-in tools
- Tool name and input visible in approval
- Denial blocks execution cleanly
- Approval flag persists for subsequent calls (if configured)
- Execution logged with MCP server name
- Tool results captured properly

### TC-5.5: MCP Server List and Refresh
**Objective:** Test managing multiple MCP servers and tool refresh
**Preconditions:**
- 3 MCP servers configured but not started
**Steps:**
1. Query available MCP servers - should list all 3
2. Start server 1
3. Refresh tool list - should see server 1 tools
4. Start servers 2 and 3
5. Refresh tool list again - should see all tools
6. Stop server 2
7. Refresh - server 2 tools should disappear
8. Verify no duplicate tools if server restarted
**Expected Result:**
- List shows all configured servers
- Tool list only includes running servers
- Refresh after start includes new tools
- Refresh after stop removes tools
- No duplicate tool names after restart
- Tool names prefixed with MCP_ for clarity

### TC-5.6: MCP Server Crash and Respawn
**Objective:** Test MCP server auto-recovery if crashes mid-execution
**Preconditions:**
- MCP server configured to crash after 5 invocations
- Auto-respawn enabled
**Steps:**
1. Invoke tool 4 times successfully
2. 5th invocation causes server to crash
3. Monitor detection of crash
4. Verify auto-respawn triggered
5. Invoke tool again - should succeed after respawn
6. Check invocation history
**Expected Result:**
- Server crash detected within 2 seconds
- Auto-respawn initiated
- Tool invocation queued and retried
- 6th invocation succeeds
- Crash logged with timestamp
- Tool results from before crash not lost

---

## 6. Database & Persistence Tests

### TC-6.1: SQLite Database Corruption Recovery
**Objective:** Test database corruption detection and recovery
**Preconditions:**
- Active Lumiq session with messages
- Database file accessible
**Steps:**
1. Create checkpoint with valid session and messages
2. Intentionally corrupt database file (flip bytes in middle)
3. Restart Lumiq
4. Attempt to load session
5. Verify corruption detected
6. Observe recovery strategy (backup restore or rebuild)
7. Verify data integrity post-recovery
**Expected Result:**
- Corruption detected on startup
- Clear error message to user
- Automatic backup restoration attempted
- Database accessible after recovery
- Session history intact or clearly marked as corrupted
- No data loss if backup available

### TC-6.2: Message Transaction Consistency
**Objective:** Test message save transaction atomicity
**Preconditions:**
- Session with partial message history
- Simulated transaction failure before commit
**Steps:**
1. Prepare message record with all fields
2. Simulate database failure before final commit
3. Verify message not half-saved in DB
4. Attempt to save again
5. Verify successful save
6. Query message history - no duplicates
**Expected Result:**
- Failed transaction leaves DB untouched
- No partial message records
- Retry succeeds without duplicates
- Transaction rollback complete
- Message ordering consistent

### TC-6.3: Provider Config Encryption/Decryption Cycle
**Objective:** Test provider configs survive encryption/decryption cycle
**Preconditions:**
- 5 providers with different auth methods
**Steps:**
1. Save provider 1 (API key)
2. Retrieve and verify decryption
3. Update provider 1 API key
4. Retrieve - verify new key
5. Save provider 2 (OAuth tokens with expiry)
6. Retrieve OAuth tokens - check expiry still valid
7. Perform upgrade scenario (change encryption algorithm)
**Expected Result:**
- API keys survive cycle identically
- OAuth tokens and expiry preserved
- Encryption algorithm upgrade successful
- No key loss or corruption
- Old encrypted records still readable
- New records use new encryption format

### TC-6.4: Concurrent Write Transactions
**Objective:** Test multiple writes don't cause lock contention
**Preconditions:**
- Session initialized
- Multiple tools queued for execution
**Steps:**
1. Execute 5 tools concurrently (read-only group)
2. Monitor database write locks
3. Tools commit results sequentially (by design)
4. Send new message during results commit
5. Verify message save queued (doesn't block tools)
6. Check all writes completed successfully
7. Verify no timeout or deadlock
**Expected Result:**
- Read operations don't block
- Write operations queue but don't deadlock
- Timeout on lock is configurable and hit rarely
- All writes eventually complete
- Message order preserved
- No transactions rolled back due to conflict

### TC-6.5: Database Migration Safety
**Objective:** Test database schema migrations are safe
**Preconditions:**
- Database with v1 schema (assume old version)
- Migration scripts v1→v2, v2→v3, v3→v4
**Steps:**
1. Load old schema database
2. Trigger migration on startup
3. Verify all migrations run in order
4. Check schema version matches current
5. Verify data integrity after migration
6. Attempt rollback to v1 (if supported)
7. Verify rollback preserves data
**Expected Result:**
- Migrations run automatically in order
- Schema version updated
- Data preserved through all migrations
- Rollback successful if implemented
- No message loss or corruption
- Performance acceptable after migration

### TC-6.6: Tool Settings CRUD Operations
**Objective:** Test create, read, update, delete of tool settings
**Preconditions:**
- Tool: BashTool
- Settings table initialized
**Steps:**
1. Create setting: BashTool -> always-allow
2. Read setting back - verify correct
3. Update setting: always-allow -> ask
4. Read again - verify update
5. Delete setting
6. Read - verify deleted (returns default)
7. Bulk update multiple tool settings
**Expected Result:**
- Create inserts record correctly
- Read retrieves exact record
- Update modifies in place (no duplicate)
- Delete removes record
- Default settings used when not configured
- Bulk operations atomic (all or nothing)

### TC-6.7: Session Cleanup and Archival
**Objective:** Test old session cleanup and archival
**Preconditions:**
- 50 sessions in database
- 30 older than 30 days
- 20 newer than 30 days
- Archival policy: move to archive_sessions table after 30 days
**Steps:**
1. Check active_sessions count (should be 50)
2. Trigger archival process
3. Check active_sessions count (should be 20)
4. Check archive_sessions count (should be 30)
5. Query archived sessions - data intact
6. Attempt to load archived session
7. Verify archived sessions read-only
**Expected Result:**
- Archival moves old sessions cleanly
- Active sessions count correct
- Archived sessions preserve data
- Archive accessible but read-only
- Archival process completes without errors
- Performance improved with smaller active set

### TC-6.8: Message History Compression
**Objective:** Test message history doesn't grow unbounded
**Preconditions:**
- Session with 1000 messages
- Message size: ~1KB average
- Total DB size: ~100MB
**Steps:**
1. Measure current DB size
2. Trigger compression/cleanup
3. Verify old messages removed or archived
4. Measure new DB size
5. Verify recent messages retained
6. Check queries still work on retained messages
7. Verify compression respects retention policy
**Expected Result:**
- Compression reduces DB size by 50%+
- Recent messages always retained
- Queries still work
- Compression doesn't corrupt remaining messages
- Old messages archivable (not deleted)
- Retention policy configurable

---

## 7. Context Management Tests

### TC-7.1: Context Window Overflow with Mixed Messages
**Objective:** Test context manager handles overflow correctly
**Preconditions:**
- Context limit: 4000 tokens
- Current message count: 20 messages averaging 250 tokens each (5000 total)
- Message types: user, assistant, tool, system
**Steps:**
1. Calculate token usage for all messages
2. Add new user message (+500 tokens)
3. Trigger context window validation
4. Observe trimming algorithm
5. Send final message to provider
6. Verify provider receives trimmed context
7. Check trimming respect system message priority
**Expected Result:**
- Trimming reduces total to ~3500 tokens
- System messages always included
- Oldest user messages trimmed first
- Tool messages near trimmed user kept
- Provider call succeeds with trimmed context
- Coherence maintained

### TC-7.2: Token Counting Accuracy
**Objective:** Test token counting matches actual provider usage
**Preconditions:**
- Test message with known token count (OpenAI)
- Provider: OpenAI GPT-4
**Steps:**
1. Estimate tokens locally using encoder
2. Send message to provider
3. Receive actual token usage from response
4. Compare estimated vs. actual
5. Test with multiple message types
6. Test with special characters and unicode
**Expected Result:**
- Estimated tokens within 5% of actual
- Unicode characters counted correctly
- Special tokens handled properly
- Token count consistent across formats
- No significant discrepancy

### TC-7.3: System Prompt Preservation During Trimming
**Objective:** Test system prompt never gets trimmed
**Preconditions:**
- System prompt: 100 tokens (custom system prompt)
- Context limit: 2000 tokens
- Current messages: 3000 tokens
**Steps:**
1. Load context with system prompt
2. Observe trimming algorithm
3. Verify system prompt in final context
4. Measure system prompt tokens in trimmed output
5. Verify system prompt unchanged (exact match)
**Expected Result:**
- System prompt always included
- System prompt never modified
- Token count accurately includes system prompt
- Trimming happens to message history only
- Final context includes unmodified system prompt

### TC-7.4: Context Manager with Skill Injection
**Objective:** Test skill injection doesn't corrupt context
**Preconditions:**
- Base context: 2000 tokens
- Skill injection: +300 tokens (new instructions)
- Context limit: 4000 tokens
**Steps:**
1. Build context with skill injection
2. Measure total tokens
3. Verify skill injection at correct position (after system, before messages)
4. Send to provider
5. Verify provider receives all injected content
6. Check skill instructions followed
**Expected Result:**
- Total context: ~2300 tokens (within limit)
- Skill injection properly positioned
- All instructions received by provider
- Skill behavior affects response appropriately
- No truncation of skill instructions

### TC-7.5: Context Trimming with Long Tool Results
**Objective:** Test handling of very long tool result messages
**Preconditions:**
- User message: "read large file"
- Tool result: 5000 tokens (FileReadTool returning file content)
- Context limit: 4000 tokens
**Steps:**
1. Execute FileReadTool returning large file
2. Tool result message saved with 5000 tokens
3. Next user message sent (+300 tokens)
4. Trigger context building with 5000+300 > 4000 limit
5. Observe trimming strategy for long tool results
6. Verify provider receives useful context
**Expected Result:**
- Long tool result truncated or summarized
- Recent user message included
- Context stays under limit
- Tool result not completely removed (partial is better)
- Provider can still answer user question

---

## 8. File Operation Tests

### TC-8.1: File Write with Atomic Operations
**Objective:** Test file writes are atomic
**Preconditions:**
- Target file: workspace/test.txt
- Write size: 10MB
- Monitor file during write
**Steps:**
1. Start writing 10MB file
2. Monitor file size during write
3. Mid-write, attempt to read file (should see old or new, not partial)
4. Complete write
5. Verify file size exactly 10MB
6. Verify content checksums
**Expected Result:**
- File either old or new, never partial
- No corruption during write
- File size exactly as expected
- Content verifiable with checksum
- Read during write returns consistent state

### TC-8.2: File Edit with Line Number Accuracy
**Objective:** Test FileEditTool applies edits to correct lines
**Preconditions:**
- File with 50 lines
- Edit: line 25, replace "old_content" with "new_content"
**Steps:**
1. Read line 25 - verify content is "old_content"
2. Apply edit via FileEditTool
3. Read line 25 again - verify is "new_content"
4. Verify line 24 and 26 unchanged
5. Apply multiple edits in sequence
6. Verify all edits applied correctly
**Expected Result:**
- Correct line edited
- Content exactly as specified
- Surrounding lines untouched
- Line numbers remain accurate
- Multiple sequential edits maintain accuracy

### TC-8.3: File Move/Rename with Symlink Handling
**Objective:** Test file move handles symlinks correctly
**Preconditions:**
- File: workspace/data/file.txt
- Symlink: workspace/link.txt -> data/file.txt
- Destination: workspace/archive/file.txt
**Steps:**
1. Move file from data/ to archive/
2. Check original path - file gone
3. Check destination - file present
4. Check symlink - should be broken or updated?
5. Try moving symlink itself
6. Try moving to symlink target
**Expected Result:**
- File successfully moved
- Original path empty
- Destination contains file
- Symlink behavior defined (broken or updated)
- Symlink move handled per policy
- No data corruption or loss

### TC-8.4: File Delete with Confirmation
**Objective:** Test delete operation with safety measures
**Preconditions:**
- File: workspace/important.txt
- Permission mode: MANUAL
**Steps:**
1. Send delete command for important.txt
2. Approval request should appear
3. Show file name and size in confirmation
4. Deny deletion - file should remain
5. Approve deletion - file should be deleted
6. Verify file gone from disk
**Expected Result:**
- Confirmation shows file details
- Denial preserves file
- Approval deletes file
- File not recoverable (no soft delete shown)
- Audit log tracks deletion
- Trash/recycle not used (permanent delete)

### TC-8.5: File Glob with Symlink Traversal
**Objective:** Test glob protection against symlink attacks
**Preconditions:**
- Workspace: /home/user/workspace
- Symlink: workspace/secret -> /etc
- Pattern: `**/*`
**Steps:**
1. Run glob with `**/*` pattern
2. Verify symlink traversal blocked
3. Only workspace files returned
4. /etc files not included
5. Run glob with explicit symlink path
6. Verify symbolic path not followed
**Expected Result:**
- Glob only returns workspace files
- Symlink traversal blocked
- /etc directory not accessible via symlink
- Clear boundary enforcement
- Symlink path shown but not followed

### TC-8.6: FileSearchTool - Regex DoS Prevention
**Objective:** Test search with catastrophic backtracking regex
**Preconditions:**
- Large file: 1MB text
- Regex with exponential backtracking: `(a+)+b`
- Timeout: 5 seconds
**Steps:**
1. Execute search with backtracking regex
2. Monitor execution time
3. Verify timeout enforced after 5 seconds
4. Verify partial results returned or error
5. Check system responsiveness post-timeout
**Expected Result:**
- Regex execution times out
- Clear timeout error message
- No system hang
- Other operations not blocked
- Partial results or error page shown

### TC-8.7: MultiFileEditTool - Dependency Preservation
**Objective:** Test multi-file edits preserve import/reference integrity
**Preconditions:**
- Files: fileA.ts (imports from fileB), fileB.ts, fileC.ts
- Edit fileA to use new import path, update fileB path accordingly
**Steps:**
1. Prepare batch edit: fileA (update import), fileB (move/rename)
2. Execute batch
3. Verify fileA imports still work
4. Verify fileB accessible at new location
5. Verify fileC unchanged
6. Run validation (e.g., TypeScript check)
**Expected Result:**
- Imports correctly updated
- All files at new/updated locations
- No broken references
- Batch maintains consistency
- Validation passes after edits

---

## 9. IPC Communication Tests

### TC-9.1: IPC Message Size Limits
**Objective:** Test handling of large IPC payloads
**Preconditions:**
- Sending large message through IPC (e.g., 50MB file content)
- IPC size limit (if enforced)
**Steps:**
1. Send small message (1KB) - should succeed
2. Send medium message (1MB) - should succeed
3. Send large message (10MB) - observe behavior
4. Send very large message (100MB) - observe behavior
5. Check for chunking or error
**Expected Result:**
- Small/medium messages work
- Large messages either chunked or error with clear message
- No IPC crashes
- Memory usage reasonable
- Partial transfers recovered or reported

### TC-9.2: IPC Channel Validation
**Objective:** Test IPC only accepts valid channel names
**Preconditions:**
- Known valid channels: `chat:send`, `session:create`
- Invalid channel: `malicious:command`
**Steps:**
1. Send message via valid channel - succeeds
2. Attempt to send via invalid channel - blocked
3. Verify error message
4. Attempt common attack patterns:
   - Command injection in channel name
   - Function invocation
   - Process spawning
**Expected Result:**
- Valid channels accepted
- Invalid channels rejected with error
- Attack patterns blocked
- No security bypass possible
- Whitelist of allowed channels enforced

### TC-9.3: IPC Handler Timeout
**Objective:** Test IPC handlers don't hang indefinitely
**Preconditions:**
- Handler configured with 30s timeout
- Simulated slow operation (mock handler delays 60s)
**Steps:**
1. Trigger slow operation via IPC
2. Monitor for timeout
3. After 30s, verify error returned
4. Verify UI responsive after timeout
5. Attempt next operation - should succeed
**Expected Result:**
- Handler times out after 30 seconds
- Error message returned to renderer
- UI remains responsive
- Next operation succeeds
- No process hangs or zombies

### TC-9.4: IPC Event Listener Memory Leaks
**Objective:** Test IPC listeners properly cleaned up
**Preconditions:**
- Listener count: start at 5 (baseline)
- Add 100 listeners dynamically
**Steps:**
1. Check initial listener count (5)
2. Add 100 listeners in loop
3. Check listener count (105)
4. Remove all 100 listeners
5. Check listener count (should return to 5)
6. Verify memory freed
**Expected Result:**
- Listener count increases with additions
- All listeners removed cleanly
- Memory returned after cleanup
- No leaked listeners
- Baseline count restored

### TC-9.5: IPC with Renderer Crash Recovery
**Objective:** Test IPC resilience when renderer crashes
**Preconditions:**
- Renderer window open
- Pending IPC request in flight
**Steps:**
1. Send IPC request from renderer
2. Request processing started in main
3. Simulate renderer crash (close window)
4. Observe main process behavior
5. Verify main process doesn't hang
6. Check database for uncommitted work
7. Restart renderer - send new request
**Expected Result:**
- Main process detects renderer death
- Pending operation completes or rolls back
- Main process remains stable
- New renderer instance works normally
- No orphaned processes

### TC-9.6: IPC Event Ordering
**Objective:** Test multiple IPC events processed in order
**Preconditions:**
- Queue of 5 IPC events
- Event 1: create session
- Events 2-5: add messages to session
**Steps:**
1. Fire all 5 events rapidly (within milliseconds)
2. Observe processing order
3. Verify session created first
4. Verify messages added after session exists
5. Check database for correct order
**Expected Result:**
- Events processed in order
- Session exists before messages added
- No "session not found" errors
- Database shows correct creation order
- Idempotency if events replay

---

## 10. Error Handling & Recovery Tests

### TC-10.1: Graceful Degradation on Provider Timeout
**Objective:** Test chat continues despite provider timeout
**Preconditions:**
- Provider timeout: 30s
- Tool that calls provider internally
- Tool result timeout: 5s
**Steps:**
1. Send message expecting provider timeout
2. Monitor for timeout after 30s
3. Observe error message and UI state
4. Attempt retry with different provider
5. Verify conversation continues
6. Send new message post-failure
**Expected Result:**
- Provider timeout caught after 30s
- User notified with clear error
- Suggestion to retry or switch provider
- Conversation state preserved
- New messages can be sent
- No cascading failures

### TC-10.2: Tool Execution Error with User Recovery
**Objective:** Test tool errors provide recovery options
**Preconditions:**
- FileReadTool attempting to read non-existent file
- Agent requests file read
**Steps:**
1. Agent sends message requesting file read
2. FileReadTool executes, file not found
3. Tool returns error
4. Observe error message quality
5. Verify agent receives error
6. Agent attempts recovery (checks correct path or lists dir)
**Expected Result:**
- Error message is clear and actionable
- File path shown in error
- Suggestions for next steps
- Agent can recover from error
- Error doesn't crash chat

### TC-10.3: Database Connection Failure Recovery
**Objective:** Test system survives temporary DB disconnection
**Preconditions:**
- Mock database connection failure
- Connection failure lasts 3 seconds, then recovers
**Steps:**
1. Send message (DB succeeds)
2. Simulate DB connection loss
3. Attempt to save tool result (fails)
4. Observe retry logic
5. After 3 seconds, connection recovers (mock)
6. Verify retry succeeds
7. Send new message (should work)
**Expected Result:**
- Initial connection failure caught
- Clear error to user
- Automatic retry attempted
- Recovery succeeds after connection restored
- Conversation continues normally

### TC-10.4: Provider API Rate Limit with Exponential Backoff
**Objective:** Test rate limit recovery with proper backoff
**Preconditions:**
- Provider rate limit: 60 requests/minute
- Queue: 65 requests rapidly
**Steps:**
1. Send 60 requests rapidly
2. Observe requests 1-60 succeed
3. Request 61+ trigger rate limit (HTTP 429)
4. Monitor backoff strategy: retry 1 at 1s, retry 2 at 2s, retry 3 at 4s
5. Allow backoff to complete
6. Verify requests eventually succeed
**Expected Result:**
- First 60 requests succeed
- Requests 61+ rate limited
- Exponential backoff implemented
- All requests eventually succeed
- Backoff respects Retry-After header
- No request loss

### TC-10.5: Corrupted Message Recovery
**Objective:** Test recovery from corrupted message in history
**Preconditions:**
- Message in DB with corrupted data (e.g., missing required field)
- Load session history
**Steps:**
1. Attempt to load session
2. Parser encounters corrupted message
3. Observe error handling strategy
4. Option 1: Skip corrupted message with warning
5. Option 2: Restore from backup
6. Continue using remaining messages
7. New message succeeds
**Expected Result:**
- Corrupted message detected
- Clear error logged
- Option to skip or restore
- Session partially usable or recovered
- New messages not affected
- Admin notified of data issue

### TC-10.6: MCP Server Hang Detection and Recovery
**Objective:** Test hung MCP server is detected and recovered
**Preconditions:**
- MCP server configured
- Server hangs after responding to first tool call
**Steps:**
1. Invoke tool 1 (succeeds)
2. Invoke tool 2 (server hangs, no response)
3. Wait for timeout (10 seconds)
4. Observe timeout and recovery
5. Verify server process killed
6. Attempt tool 3 (should restart server or fail gracefully)
**Expected Result:**
- Tool 2 timeout detected after 10s
- User notified of server hang
- Server process terminated
- Option to restart or switch to different server
- Tool 3 either succeeds (if restarted) or fails gracefully
- No zombie processes

### TC-10.7: Session Lock Contention and Timeout
**Objective:** Test session lock prevents corruption but doesn't deadlock
**Preconditions:**
- Session with active read lock
- Writer attempts to get exclusive lock
- Lock timeout: 5 seconds
**Steps:**
1. Reader acquires lock, holds for 3 seconds
2. Writer attempts exclusive lock
3. Writer waits for lock availability
4. After 3s, reader releases lock
5. Writer acquires lock and proceeds
6. Verify write succeeds
7. If writer waits >5s, verify timeout
**Expected Result:**
- Reader holds lock for 3s
- Writer waits 3s for lock
- Write succeeds after release
- No deadlock occurs
- If timeout enforced, writer gets error after 5s
- Lock timeout configurable

---

## 11. Performance & Stress Tests

### TC-11.1: Streaming Performance with 1M Token Response
**Objective:** Test streaming efficiency with very large responses
**Preconditions:**
- Provider configured
- Token limit: 1M tokens (largest possible)
**Steps:**
1. Send message requesting large response
2. Monitor chunk arrival rate
3. Measure memory usage during streaming
4. Monitor UI responsiveness during streaming
5. Measure total time to complete
6. Verify all tokens received
**Expected Result:**
- Chunks arrive at ~1KB per 100ms (streaming)
- Memory usage stays below 500MB
- UI remains responsive (no freezing)
- Total time: reasonable (under 2 minutes)
- All 1M tokens received
- No data loss or corruption

### TC-11.2: Concurrent Tool Execution - 10 Read-Only Tools
**Objective:** Test 10 concurrent read-only tools execute efficiently
**Preconditions:**
- 10 read-only tools queued (e.g., GlobTool, GrepTool, FileReadTool)
- Each tool takes ~1 second
**Steps:**
1. Execute 10 tools concurrently
2. Measure wall-clock time
3. Monitor CPU and memory usage
4. Verify all results returned
5. Check result accuracy
**Expected Result:**
- All 10 tools complete in ~1 second (parallel execution)
- Not 10 seconds (serial)
- CPU usage reasonable (not spiked)
- Memory usage reasonable
- All results accurate

### TC-11.3: Database Query Performance with 100k Messages
**Objective:** Test query performance on large message history
**Preconditions:**
- Session with 100,000 messages
- Indexes on sessionId, createdAt
**Steps:**
1. Query messages for session (should use index)
2. Measure query time (target: <100ms)
3. Query with filter: role='assistant'
4. Measure filtered query time
5. Query with pagination (offset/limit)
6. Measure paginated query time
**Expected Result:**
- Indexed query: <100ms
- Filtered query: <200ms
- Paginated query: <100ms
- All queries use indexes (explain plan confirms)
- No full table scans

### TC-11.4: Memory Leak Test - 1000 Sessions Created and Destroyed
**Objective:** Test memory is released when sessions cleaned up
**Preconditions:**
- Baseline memory: measure at start
- Create and destroy loop
**Steps:**
1. Measure baseline memory usage
2. Loop 1000 times:
   - Create session
   - Add 10 messages
   - Close session
   - Verify cleanup
3. Measure final memory usage
4. Difference should be minimal
**Expected Result:**
- Baseline: 150MB
- After 1000 create/destroy: 160MB (minimal growth)
- Not 500MB+ (memory leak)
- Garbage collection working
- Memory reused for new sessions

### TC-11.5: CPU Usage Under Load - 100 Concurrent Chats
**Objective:** Test CPU usage doesn't spike excessively
**Preconditions:**
- 100 sessions initialized
- Each sends message concurrently
**Steps:**
1. Measure CPU baseline
2. Send 100 messages concurrently
3. Monitor CPU usage during execution
4. Peak CPU usage recorded
5. After completion, CPU should return to baseline
**Expected Result:**
- Baseline CPU: ~5%
- Peak CPU: <80% (not max)
- CPU returns to ~5% after completion
- No runaway processes
- System responsive throughout

### TC-11.6: Large File Processing - 1GB File Read
**Objective:** Test handling of very large files
**Preconditions:**
- File: workspace/data/large_file.bin (1GB)
- FileReadTool configured
**Steps:**
1. Attempt to read full 1GB file
2. Observe behavior (streaming vs. buffering)
3. Monitor memory usage
4. Measure read time
5. Verify content integrity (sample checksums)
**Expected Result:**
- Streaming implemented (not buffering full file)
- Memory usage <100MB
- Read time reasonable (<5 seconds)
- Partial read possible (chunk-based)
- Content verifiable

### TC-11.7: Message History Navigation - 50k Messages
**Objective:** Test pagination and search performance
**Preconditions:**
- Session with 50,000 messages
- Searching for specific pattern
**Steps:**
1. Paginate through first 100 pages (page size: 20)
2. Time page load
3. Search for specific term (appears in 100 messages)
4. Time search
5. Attempt jump to middle of history (message 25k)
6. Time random access
**Expected Result:**
- Page load: <100ms
- Search: <500ms
- Random access: <200ms
- All queries indexed
- Pagination smooth (no lag)

### TC-11.8: Tool Result Streaming - 100MB Tool Output
**Objective:** Test streaming of large tool outputs (e.g., grep results)
**Preconditions:**
- Tool: GrepTool returning 100MB of results
- Streaming configured
**Steps:**
1. Execute grep returning large results
2. Monitor chunk delivery
3. Measure memory usage
4. Verify all results streamed
5. Test UI responsiveness during streaming
**Expected Result:**
- Results streamed in chunks
- Memory stays below 200MB
- UI responsive (can cancel)
- All results eventually available
- Cancellation works during streaming

---

## 12. Workspace & Session Tests

### TC-12.1: Workspace Binding - Multi-Project Isolation
**Objective:** Test workspace paths keep projects isolated
**Preconditions:**
- Workspace A: /home/user/projectA
- Workspace B: /home/user/projectB
- Session 1 bound to Workspace A
- Session 2 bound to Workspace B
**Steps:**
1. Create file in Session 1: projectA/test.txt
2. List files in Session 1 workspace
3. Attempt to access Session 2 workspace from Session 1
4. Create file in Session 2: projectB/test.txt
5. Verify Session 1 cannot see projectB files
6. Verify Session 2 cannot see projectA files
**Expected Result:**
- Each session isolated to bound workspace
- File operations scoped correctly
- Cross-workspace access blocked
- Each session's tools use correct workspace
- No accidental file access outside bound workspace

### TC-12.2: Session Recreation with Same ID
**Objective:** Test session recovery by ID
**Preconditions:**
- Session created with ID: `abc123`
- 10 messages in session
- Close and restart app
**Steps:**
1. Create session with ID abc123
2. Add 10 messages
3. Close Lumiq app
4. Restart Lumiq
5. Attempt to load session abc123
6. Verify all 10 messages present
7. Verify session metadata (title, provider, model)
**Expected Result:**
- Session restored from database
- All messages intact
- Metadata unchanged
- Session usable as if never closed
- No data loss

### TC-12.3: Session Title Auto-Generation
**Objective:** Test session title generated from first message
**Preconditions:**
- New session
- First user message: "Please write a Python script to scrape weather data"
**Steps:**
1. Create session
2. Send first message
3. Observe auto-generated title
4. Verify title reflects message content
5. Allow user to edit title
6. Verify edited title persists
**Expected Result:**
- Title auto-generated from first message
- Title concise (50-100 chars)
- Title saved to database
- User can edit title anytime
- Edited title persists across reopens

### TC-12.4: Agent Binding to Session
**Objective:** Test agent configuration applied to session
**Preconditions:**
- Agent: "CodeReviewer" with:
  - System prompt: specific code review instructions
  - Tools: FileReadTool, GrepTool, DiffTool
  - Model: gpt-4
- Session without agent
**Steps:**
1. Create session
2. Bind agent "CodeReviewer" to session
3. Send message
4. Verify system prompt applied
5. Verify only allowed tools available
6. Verify model matches agent config
7. Unbind agent
8. Verify defaults restored
**Expected Result:**
- Agent system prompt applied
- Tool set restricted to agent's tools
- Model matches agent config
- Agent change affects behavior
- Unbind restores default behavior

### TC-12.5: Workspace Path Change Mid-Session
**Objective:** Test changing workspace path affects future operations
**Preconditions:**
- Session bound to Workspace A
- Switch workspace to B
- File operations sent
**Steps:**
1. Bound to Workspace A: /projectA
2. File operation: read src/main.ts (resolves to /projectA/src/main.ts)
3. Change workspace to B: /projectB
4. File operation: read src/main.ts (should resolve to /projectB/src/main.ts)
5. Verify file from Workspace B read (not A)
**Expected Result:**
- File paths resolve relative to current workspace
- Workspace change immediate (no caching delay)
- Previous operations unaffected
- Future operations use new workspace
- Clear indication of workspace in UI

### TC-12.6: Multiple Sessions with Shared Workspace
**Objective:** Test multiple sessions can share workspace
**Preconditions:**
- Workspace: /home/user/shared_project
- Session A and Session B both bound to shared workspace
**Steps:**
1. Session A: create file session_a.txt in workspace
2. Session B: list files - should see session_a.txt
3. Session B: read session_a.txt
4. Session A: verify no write conflicts
5. Session A and B simultaneously try to edit same file
6. Observe conflict handling
**Expected Result:**
- Both sessions can access shared workspace
- Changes visible to both sessions
- File locking prevents simultaneous writes
- Conflict resolution strategy applied
- No data corruption

---

## 13. OAuth & Authentication Tests

### TC-13.1: Google OAuth Flow
**Objective:** Test complete Google OAuth setup and token refresh
**Preconditions:**
- Google OAuth client ID and secret configured
**Steps:**
1. Trigger Google OAuth flow
2. User directed to Google login page (mock)
3. User approves access
4. Redirect back to Lumiq with auth code
5. Lumiq exchanges code for access token
6. Token stored securely
7. Use token to call Google API (if applicable)
8. Token refresh before expiry
**Expected Result:**
- OAuth flow completes successfully
- Access token and refresh token stored
- Tokens stored in secure keychain (not plain text)
- Token refresh triggered before expiry
- API calls authenticated with valid token
- No token leaks in logs

### TC-13.2: GitHub OAuth Flow
**Objective:** Test GitHub OAuth setup
**Preconditions:**
- GitHub OAuth app configured
**Steps:**
1. Trigger GitHub OAuth
2. User directed to GitHub
3. User grants permissions
4. Code exchanged for token
5. Store token securely
6. Use token for GitHub API calls (if applicable)
**Expected Result:**
- Flow succeeds as Google OAuth
- Token stored securely
- GitHub API calls authenticated
- Scopes honored per configuration

### TC-13.3: Token Expiry and Refresh
**Objective:** Test automatic token refresh before expiry
**Preconditions:**
- OAuth token with 1-hour expiry
- Refresh token available
- Current time: T+50 minutes (token still valid but near expiry)
**Steps:**
1. Attempt API call at T+50min
2. Token still valid, call succeeds
3. System detects token near expiry
4. Automatic refresh triggered
5. New token obtained
6. API call at T+1 hour uses new token
**Expected Result:**
- Token refresh triggered before expiry
- Refresh succeeds silently (no user interaction)
- Existing requests not interrupted
- New token valid for new requests
- Refresh token also updated if rotated by provider

### TC-13.4: API Key Rotation
**Objective:** Test API key rotation without downtime
**Preconditions:**
- Provider (e.g., OpenAI) with active API key
- New key available
**Steps:**
1. Update provider config with new key
2. Ongoing chat continues
3. Tool executions succeed
4. Verify new key used for new requests
5. Remove/revoke old key
6. Verify system still works
**Expected Result:**
- In-flight requests complete with old key
- New requests use new key
- No errors or interruptions
- Key rotation seamless
- Old key cleanup possible

### TC-13.5: Bedrock STS Token Refresh
**Objective:** Test AWS STS token refresh for Bedrock
**Preconditions:**
- AWS credentials with STS
- STS token expiring soon (mock: expiry in 5 minutes)
**Steps:**
1. Send request at T+0 (token valid)
2. Monitor token expiry
3. At T+4min, attempt new request
4. Observe token refresh trigger
5. Verify new STS token obtained
6. Verify request succeeds with new token
**Expected Result:**
- Token refresh triggered before expiry
- Refresh uses configured AWS credentials
- New token obtained from STS
- Request succeeds with new token
- Seamless refresh (no user interaction)

### TC-13.6: OAuth Token Revocation
**Objective:** Test revoking OAuth token
**Preconditions:**
- Active OAuth token
- User logs out or revokes access
**Steps:**
1. User initiates token revocation
2. Token sent to provider's revocation endpoint
3. Verify token marked as revoked
4. Attempt to use token - should fail
5. User must re-authenticate
6. New token obtained
**Expected Result:**
- Revocation endpoint called
- Token no longer valid
- Subsequent API calls fail with auth error
- User prompted to re-authenticate
- New token obtained upon re-auth

### TC-13.7: Multiple Credentials for Same Provider
**Objective:** Test switching between multiple OAuth credentials
**Preconditions:**
- Provider: GitHub
- 2 GitHub OAuth tokens (different users)
- Token 1: john@example.com
- Token 2: jane@example.com
**Steps:**
1. Configure Token 1
2. Make API call - uses john's account
3. Switch to Token 2
4. Make API call - uses jane's account
5. Switch back to Token 1
6. Verify behavior matches john's account
**Expected Result:**
- Switching tokens works smoothly
- API calls use correct token
- No token mixing or crossover
- Behavior changes based on active token
- Token switching doesn't require restart

---

## Test Execution Strategy

### Phase 1: Critical Path (P0)
- TC-1.1 through TC-1.6 (Chat & Agent System)
- TC-3.1 through TC-3.3 (Tool Execution - critical tools)
- TC-4.1, TC-4.3 (Permission & Security - critical)
- TC-6.1 through TC-6.2 (Database - critical)

### Phase 2: Core Features (P1)
- TC-2.1 through TC-2.6 (Multi-Provider)
- TC-3.4 through TC-3.10 (Tool Execution - all tools)
- TC-5.1 through TC-5.6 (MCP Integration)
- TC-8.1 through TC-8.7 (File Operations)

### Phase 3: Infrastructure (P2)
- TC-7.1 through TC-7.5 (Context Management)
- TC-9.1 through TC-9.6 (IPC Communication)
- TC-10.1 through TC-10.7 (Error Handling)
- TC-12.1 through TC-12.6 (Workspace & Sessions)

### Phase 4: Advanced (P3)
- TC-11.1 through TC-11.8 (Performance & Stress)
- TC-4.4 through TC-4.8 (Security - advanced)
- TC-13.1 through TC-13.7 (OAuth & Auth)

---

## Test Success Criteria

- **P0 Tests**: 100% pass rate (blocking release)
- **P1 Tests**: 95%+ pass rate (can defer 1-2 edge cases)
- **P2 Tests**: 90%+ pass rate (lower priority)
- **P3 Tests**: 80%+ pass rate (nice to have)

---

## Notes for QA Team

1. **Security Testing**: Employ static analysis tools (SonarQube, Bandit) alongside manual tests.
2. **Performance Testing**: Use load testing tools (k6, JMeter) for TC-11.
3. **Regression Testing**: Create automated test suite for P0 and P1 tests.
4. **Documentation**: Each test should have clear steps and expected results.
5. **Defect Reporting**: Use structured defect reports with reproduction steps and logs.

