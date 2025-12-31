AUTONOMOUS AGENTS SYSTEM - COMPREHENSIVE SUMMARY
====================================================

1. AGENT TYPES AND CAPABILITIES
- Router (temp: 0.3): Routes messages to specialists
- Researcher (temp: 0.5): Gathers and analyzes information
- Writer (temp: 0.7): Transforms info into content
- Analyzer (temp: 0.3): Extracts insights from data
- Custom agents with any role, prompt, model combination

Properties: id, user_id, name, role, system_prompt, model, temperature, max_tokens, capabilities[], tools[], is_active, total_tasks, successful_tasks, failed_tasks, success_rate

2. TASK EXECUTION FLOW
5-Phase Model:
1. THINK - Analyze task and plan approach
2. PLAN - Create step-by-step execution plan
3. EXECUTE - Run each step with tools and error recovery
4. VERIFY - Check intermediate results
5. COMPLETE - Compile final results and summary

Configuration:
- AGENT_MAX_STEPS: 20
- AGENT_MAX_RETRIES: 3
- AGENT_RETRY_DELAY_MS: 1000
- AGENT_CONTEXT_WINDOW: 10
- AGENT_MEMORY_PERSISTENCE: true

3. AVAILABLE TOOLS
Built-in: web_search, analyze_text, format_data, calculate, generate_list, save_note, get_note

Browser Tool:
- Actions: scrape, click, type, screenshot, navigate, scroll, wait, evaluate, form_fill
- Features: Dual mode (fetch + puppeteer), retry, extract (text/html/links/images/meta)
- Security: Blocks localhost/internal URLs

HTTP Tool:
- Methods: GET, POST, PUT, DELETE, PATCH
- Features: Auto JSON parsing, timeout, headers, response metadata
- Security: Blocks internal URLs

File Tool:
- Operations: read, write, append, list, exists, delete
- Features: Workspace isolation, size limits, blocked extensions
- Security: No path traversal, blocks system files

Email Tool:
- SMTP configuration via environment variables
- HTML/plain text, CC/BCC, attachments
- Email validation, fallback simulation

Integrations: Slack, Google Calendar, Gmail, CRM (HubSpot/Pipedrive)

4. MULTI-AGENT ORCHESTRATION
Workflow Types:
- Sequential: N → N+1, output becomes input
- Parallel: Groups run concurrently
- Conditional: Route based on conditions
- Fan-out/Fan-in: Expand, process, aggregate

Agent Communication:
- message_type: data, request, response, error, control
- Content, metadata, timestamp tracked

Default Workflow: Router → Researcher → Writer → Analyzer (sequential)

5. API ENDPOINTS
Agent Management:
- POST /api/autonomous/agents (create)
- GET /api/autonomous/agents (list)
- GET /api/autonomous/agents/{id} (get)
- PUT /api/autonomous/agents/{id} (update)
- DELETE /api/autonomous/agents/{id} (delete)

Task Management:
- POST /api/autonomous/agents/{id}/tasks (create/execute)
- GET /api/autonomous/agents/{id}/tasks (list)
- GET /api/autonomous/tasks/{id} (get details)
- GET /api/autonomous/tasks/{id}/steps (get steps)
- POST /api/autonomous/tasks/{id}/execute (execute)

Tools:
- GET /api/autonomous/tools (list available)

Bot Agents:
- POST /api/agents (create for bot)
- GET /api/agents (list)
- POST /api/agents/{id}/test (test with input)

6. CONFIGURATION OPTIONS
Task Planning:
- AGENT_MAX_STEPS=20
- AGENT_MAX_RETRIES=3
- AGENT_RETRY_DELAY_MS=1000
- AGENT_CONTEXT_WINDOW=10
- AGENT_MEMORY_PERSISTENCE=true
- AGENT_WORKSPACE_DIR=/path/to/workspace

Models:
- OPENAI_API_KEY=sk-...
- OPENAI_MODEL_DEFAULT=gpt-4o-mini
- AGENT_TEMPERATURE_DEFAULT=0.7
- AGENT_MAX_TOKENS_DEFAULT=2048

Temperature Selection:
- 0.0-0.3: Routing, Classification (deterministic)
- 0.4-0.6: Analysis, Research (balanced)
- 0.7-0.9: Writing, Creative (varied)
- 1.0+: Brainstorming (random)

Email (SMTP):
- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM

Integrations:
- SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- HUBSPOT_API_KEY, PIPEDRIVE_API_KEY

7. ADVANCED FEATURES
Task Planning:
- Adaptive planning with step dependencies
- Parallelization of independent steps
- Plan revision on failure
- Estimated duration calculation

Memory System:
- Short-term: Recent interactions (configurable window)
- Long-term: Persistent key-value store
- Working: Task-specific state (cleared per task)
- Tool logs: Execution logs with duration

Error Recovery:
- NETWORK_ERROR: Wait 2s, retry
- RATE_LIMIT: Extract wait time, retry
- NOT_FOUND: Skip step
- AUTH_ERROR: Abort task
- GENERIC: Retry with delay

Execution Statistics:
- total_tasks, successful_tasks, failed_tasks
- success_rate, average_duration_ms, total_tokens_used

8. ERROR HANDLING AND RECOVERY
Error Classification:
- NETWORK_ERROR: Connection issues
- RATE_LIMIT: API rate limiting
- NOT_FOUND: Resource missing (404)
- AUTH_ERROR: Authentication issues (401/403)
- GENERIC: Unknown error type

Retry Policy:
- Maximum retries: AGENT_MAX_RETRIES
- Exponential backoff: delay * retryCount
- Default delay: 1000ms
- Tracked per step in error_history

9. MEMORY MANAGEMENT
Operations:
- storeLongTermMemory(key, value) - Persistent
- retrieveLongTermMemory(key) - With access tracking
- addToShortTermMemory(item) - Recent interactions
- updateWorkingMemory(key, value) - Current task state
- clearWorkingMemory() - Between tasks
- getRelevantContext(query) - Matching memories
- persistMemory() - Save to database
- loadMemory() - Load from database

Memory Limits:
- Short-term: 10 items (AGENT_CONTEXT_WINDOW)
- Long-term: Database size
- Working: Task-specific, cleared per task
- Tool logs: 100 entries (auto-prune)

10. MODELS AND DATABASE
Agent Model: create, findById, findByBotId, findByTenant, findActiveByBotId, findByRole, update, delete

AgentWorkflow Model: create, findById, findByBotId, findActiveByBotId, findDefaultByBotId, update, setAsDefault, delete

AgentExecutionStep Model: create, findById, findByExecutionId, findByAgentId, update, complete, fail, delete, deleteByExecutionId

AgentTool Model: create, findById, findByAgentId, findEnabledByAgentId, findByToolId, exists, update, delete, bulkAssign

AgentMessage Model: create, findById, findByExecutionId, findByFromAgentId, findByToAgentId, findByType, delete, countByExecutionId

SECURITY FEATURES
URL Blocking:
- Prevents localhost access
- Blocks internal IP ranges (10.x, 172.16-31.x, 192.168.x, 127.0.1)
- Validates HTTP/HTTPS only

File Operations:
- Workspace isolation (no path traversal)
- Blocked extensions (.exe, .dll, .sh, .bat, .env, .pem, .key)
- File size limits (1MB default)
- Auto directory creation restrictions

Data Sanitization:
- Passwords and tokens redacted in logs
- Sensitive keys filtered before storage
- API key masking

Input Validation:
- Email format validation
- URL validation
- Path traversal prevention
- Expression evaluation sandboxing
