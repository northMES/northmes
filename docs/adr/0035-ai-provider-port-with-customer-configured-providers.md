---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 04, 21, 22, 23, 24 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: "lawyer (AI Act Article 50); maintainer (Google in release 1)"
---

# AI provider port with customer-configured providers

## Context and problem statement

Krister Johansson decided that every in-app agentic feature calls models through a provider the customer configures with its own credentials, so neither the NorthMES project nor Flexmatic, the company behind it, touches the data or pays for usage. The default is OpenRouter with the customer's own key; Azure (the customer's own models, by key or Entra ID), Google (Vertex, Gemini) and others (Bedrock, Anthropic, OpenAI, local OpenAI-compatible servers) are alternatives. Release 1 contains the provider port with provider settings and usage metering, and a read-only planning assistant. AI stays in scope, and the pilot is not asked to opt out.

The AI libraries carry defaults that leak or bill silently. Tested with the Vercel AI SDK 7: a plain string model id goes to Vercel's AI Gateway when `AI_GATEWAY_API_KEY` is set; provider factories fall back to environment credentials; a diagnostics channel received prompts with no integration registered; the default error handler logged whole prompts; a host-checking fetch followed a redirect to a second host (internal research notes 23 and 32).

This ADR covers the AI port in `@northmes/sdk/ai`, the AGPL core `ai` module, provider configuration, model-call safety, usage metering and budgets, the read-only planning assistant, prompt-injection defences, the chat panel's disclosure and the rule that AI never evaluates people. MCP is in [ADR 0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md), proposals in [ADR 0036](0036-agent-proposals-as-planning-records-a-person-commits.md), AI in tests in [ADR 0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md), stored secrets and outbound URLs in [ADR 0047](0047-secrets-and-the-installation-key.md).

## Decision drivers

* The customer holds the provider account, accepts its terms and pays it directly. NorthMES ships no key, runs no proxy and has no fallback provider.
* First-party support for the providers Krister Johansson named, including Azure with Entra ID.
* A license-clean tree in AGPL core: no source-available code, no telemetry that is on by default.
* Every library default that can leak a prompt or reach another host gets a guard and a test.
* Cost control per company: metering per step, budgets, and aborted calls that still bill.
* Plant isolation and permissions on every tool call.
* ERP free text reaches tool results, and release 1 has a write path (proposals), so prompt injection is a real path.
* WCAG 2.2 AA for the chat panel, transparency under Article 50 of the EU AI Act, and no AI feature that falls under Annex III point 4(b).
* AI SDK majors arrive about every six months; the churn must stay inside one module.

## Considered options

* A types-only port in the MIT SDK, implemented by an AGPL core `ai` module on the Vercel AI SDK 7 with first-party provider packages
* TanStack AI
* LangChain.js
* Mastra
* An own thin port over OpenAI-compatible HTTP

## Decision outcome

Chosen option: "A types-only port in the MIT SDK, implemented by an AGPL core `ai` module on the Vercel AI SDK 7", because the AI SDK has first-party packages for every provider Krister Johansson named, test helpers for test-first work (`MockLanguageModelV4`, `simulateReadableStream`), and a license tree with no finding against the dependency policy, while the port keeps its types and its majors out of every other package. Krister decided the provider principle, the default and the release 1 features; the library, the guards, the metering and the assistant details come from internal research note 23 and the stress test. TanStack AI is the recorded fallback.

### Port, module and providers

* `@northmes/sdk/ai` holds the types-only port: model aliases, capabilities, run context, requests, results, usage and availability. No AI SDK type crosses it. The AGPL module `modules/ai` implements it with `ai`, `@ai-sdk/azure`, `@ai-sdk/openai-compatible` and `@openrouter/ai-sdk-provider`.
* Release 1 provider kinds: `openrouter` (default; every request sends `provider: { data_collection: "deny", zdr: true }`, which only the customer loosens; customers on an OpenRouter plan with EU in-region routing can use `https://eu.openrouter.ai/api/v1`), `azure-openai` (API key, Entra client secret or certificate; managed identity only when NorthMES itself runs in Azure) and `openai-compatible` (local Ollama, vLLM and similar, with the admin declaring tools, tool choice, structured output and embeddings).
* The `azure-openai` kind calls the customer's own deployment by its deployment name, so every model the customer deploys in its Azure OpenAI resource works with an API key or Entra ID. Whether models the customer deploys in Azure outside Azure OpenAI are reached through `azure-openai`, through `openai-compatible`, or need their own kind is not verified.
* The port and the config schema already hold `vertex`, `gemini-api`, `bedrock`, `anthropic`, `openai` and `mistral`. Each adds about 1 to 2 days and ships in a 0.x release. Whether Google Vertex and the Gemini API must ship in release 1 waits for Krister's answer. NorthMES never uses a default credential chain.
* Providers are configured per company on the Integrations page as integration cards: a Zod config schema rendered as a form, write-only secrets encrypted with the installation key, Test connection, health (last success, last error, calls today, cost this month) and a fixed privacy checklist per kind. The table carries `scope_id` from its first migration; release 1 shows company level only, and no host-level provider exists.
* Modules ask for aliases (`fast`, `reasoning`, `embedding`), never models. Each company binds an alias to a provider config and a model. Features are declared in the manifest under `ai.features` ([ADR 0003](0003-module-package-shape-and-the-definemodule-manifest.md)), are off by default and are enabled by a company admin. With no provider configured, every feature is off and the chat panel is hidden.
* Permissions: `ai.assistant:use`, `ai.provider:manage`, `ai.usage:read`. Writes to provider configs, alias bindings, prices, budgets, feature enablement and the privacy acknowledgement are audited commands with secret columns redacted.
* Embeddings and pgvector wait until a feature measures that Postgres full-text search is not enough.

### Model calls go through one file

* `modules/ai/server/model-call.ts` is the only caller of `streamText`, `generateText` and `embed`. A lint rule forbids importing them, or `registerTelemetry`, from `ai` anywhere else.
* Every call passes `telemetry: { isEnabled: false }` and an `onError` handler; `generateText` errors are caught. The log line holds only provider kind, status code, error code, `isRetryable` and correlation id. A pino serializer for AI SDK error classes drops request bodies, response bodies, data and cause text.
* `providerOptionsFor(kind)` writes `store: false` under the key the model reads. Release 1 uses `azure.chat(deployment)`, which avoids Responses API storage.
* The egress `fetch` compares scheme, host and port with the configured base URL, sets `redirect: 'error'` and rejects `http:` when the config says `https:`. `experimental_download` throws.
* Timeouts per alias: first chunk 30 s, between chunks 30 s, step 120 s, `maxRetries` 1, mapped to a typed stop reason and `provider_timeout`. Entra credentials get an explicit `authorityHost` from an allowlist and an explicit regional setting.
* The default-provider guard (no string model ids, no AI Gateway default, no environment credential or base-URL fallback) is set at module load of `model-call.ts` and in the Vitest `setupFiles`.

### Test connection, metering and budgets

* Test connection runs per alias binding: one minimal chat call with the exact provider options the feature sends (for OpenRouter `data_collection`, `zdr` and `require_parameters: true`) plus a fixed tool-call probe. It sends no plant data. Capabilities and failure codes go on `ai.provider_health`, and a feature cannot be enabled until its alias's probe has passed. The admin's acknowledgement of the privacy checklist (plan, region, data path) is stored in the audited config.
* One `ai.ai_call` row per model call step: company, plant, user, principal, feature, run id, correlation id, provider config and kind, requested and reported model, input, cached, output and reasoning tokens, provider-reported cost or an estimate from the admin's price table, latency, finish reason, error code, tool names and the provider's request or generation id. Never prompt or completion text. Rows are written on finish, error and abort; an abort writes an estimate with status `aborted-estimated`. OpenRouter costs are reconciled through `GET /api/v1/generation` in a pg-boss job.
* Each company has one budget currency; under a cost budget a model binding needs a price in that currency, and other currencies convert with an admin-entered rate saved on the row. Budgets: a monthly cost or token limit with a warning threshold and a hard stop, a per-user daily cap, and per-alias `maxOutputTokens` and `maxSteps`, checked before each step. A stop ends the stream with `data-ai-stop budget-exhausted`, and `ai.budget_state` feeds an admin banner. Concurrent runs per user are capped at 1 or 2.
* `ai.ai_call` has monthly partitions with a 13-month default. Per-user totals show only to `ai.usage:read` holders at company scope, never sorted by spend. `ai.ai_call` and `ai.provider_health` are usage logs on the audit lint allowlist, written with an explicit company write scope ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)).

### The read-only planning assistant

* `POST /api/ai/chat` in the `api` role: a Nest controller using `pipeUIMessageStreamToResponse` with `keepAliveMs`, `useChat` in the browser, session cookie auth and the same-origin check ([ADR 0011](0011-principals-credentials-and-same-origin-rules.md)). The body is parsed with a strict Zod schema: roles `user` or `assistant`, part types `text` and `step-start`, at most 40 messages and 40 000 characters; client-supplied tool parts and system messages are dropped.
* The request carries the route plant; the server fills a missing plant argument with it and names it in the instructions. The runner checks `ai.assistant:use` together with each tool's permission at the plant the call names, and a refusal writes one `permission.denied` event with surface `assistant`.
* The instructions are identical between runs, so provider prompt caching survives; one line of time context (plant, now with offset, production day) goes in the turn after the cached prefix.
* The assistant uses the SDK tool definitions of [ADR 0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md) in process through `toAgentTool`, which sends only structured JSON. Results to the model are capped at 50 rows and 20 000 characters with `truncated`, `total` and a cursor; results older than the last two turns are pruned to a one-line summary. Read tools default to the caller's draft view.
* Chat history stays in the browser for the session. Chat runs register an `AbortController` in an `AiRunRegistry`; at shutdown they abort with reason `server-restarting` and get up to 5 s to settle their `ai.ai_call` rows.

### Prompt injection, disclosure and the people rule

* ERP text in tool results (CustomData, notes, customer names) is wrapped as `{ untrusted: true, text }`, capped at 500 characters per value and 50 values per call, and appears only in named data fields. Proposals hold only structured moves for one plant, and the review shows engine-computed consequences next to the AI-written rationale.
* The Markdown renderer prints links as plain text with the full URL; only same-origin paths stay clickable. The page CSP keeps `img-src` and `connect-src` to self.
* The chat panel mounts through one shell aside slot and survives route changes; below about 640 px it opens as a modal sheet. Opening moves focus to the input, Escape returns it to the trigger, and a Stop button shows while streaming. The streaming message renders outside any live region with `aria-busy`, and the finished message is appended once to a `role=log` list. Model headings map to h3 to h6, and tool results render as tables with caption and `th`. The request carries `answerLanguage`, and messages get `lang`.
* Each assistant message carries a visible "AI-generated" label in its accessible name. The chat header and the proposal review show the fixed text "Written by an AI assistant. Check before you commit." No setting removes it.
* AI never commits a change: agent writes are proposals that a person commits ([ADR 0036](0036-agent-proposals-as-planning-records-a-person-commits.md)). AI features never score, rank or assign people, because the AI Act's Annex III point 4(b) draws its high-risk line there. Whether Article 50(1) exempts an assistant whose AI nature is obvious, and what Article 50(2) machine-readable marking needs, waits for legal confirmation. The installation policy can hide AI per module in a regulated profile later ([ADR 0051](0051-regulated-readiness-no-regret-rules.md)).
* If velocity forces cuts, the assistant is the last of the three AI features to go (item 7 in [ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md)); the port, provider settings and metering stay.

### Consequences

* Good, because the customer's data path runs from its own NorthMES server to the endpoint it configured, and nothing passes through the project.
* Good, because each known leak has one guard in one file and a test that fails if a later SDK moves the leak.
* Good, because AI SDK churn stays inside `modules/ai`, and modules depend only on aliases.
* Good, because usage, cost and budgets are visible per company without storing any prompt text.
* Bad, because the assistant with its panel and accessibility work is about 21 days of release 1.
* Bad, because providers beyond the release 1 set wait for 0.x releases.
* Bad, because the quality of small local models for tool calling is unknown until measured on plant hardware.

### Confirmation

* Lint: a file outside `model-call.ts` that imports `streamText`, `generateText`, `embed` or `registerTelemetry` from `ai` fails.
* Guard tests in `modules/ai` ([10-ai-and-agents.md](../plan/10-ai-and-agents.md), "Model calls and data-leak guards"): no provider gives zero outbound requests; a string model id throws with `AI_GATEWAY_API_KEY` set; a config missing its key fails while `AZURE_API_KEY` is set; a 307 or 308 to another host reaches it zero times with `provider_redirect`; `store: false` per provider kind; a telemetry subscriber sees zero messages and no `PROMPT-SECRET` marker, while a raw `streamText` control call is captured; no prompt marker reaches the logs; a Postgres error in a tool reaches the model as `internal` with a correlation id; a silent server ends with `provider_timeout`; `AZURE_AUTHORITY_HOST=https://evil.test` is ignored; a file part is rejected without a download.
* Metering and budgets: an abort after 150 ms leaves an `aborted-estimated` row with cost above zero; USD 0.10 at a rate of 10.5 counts as 1.05; with a budget of 1.00 and steps of 0.40 the third step never starts.
* Audit: a three-step read-only run writes three `ai.ai_call` rows and no audit rows; a run that calls `planning_propose_changes` writes exactly one `audit.command` with principal type `agent` and surface `assistant`; a read handler that attempts an INSERT fails.
* Assistant: 41 messages return 400; a call with no plant from a chat on plant B runs at plant B; a user with `ai.assistant:use` at plant A only gets not-permitted at plant B and the recorded provider request holds no plant B order numbers; 500 late orders return 50 rows with `total` 500 in under 20 000 characters; the instructions string is identical for two runs at different clocks.
* Test connection: a stub OpenRouter that answers the probe with a no-matching-endpoint 404 marks the binding unusable with reason `routing`, and enabling the feature fails.
* Panel: a Vitest browser test streaming 40 chunks records exactly one announcement with the whole answer; `# Late orders` renders an h3; `answerLanguage` `sv` gives `lang="sv"`; a Markdown link to an outside host renders no anchor; axe with `wcag22aa` passes with the panel open.
* The live injection fixture of [ADR 0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md): asked which orders are late, the model makes no propose call.
* The dependency license gate ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)) scans installed packages for `ee/` folders and "Enterprise" license files.

## Pros and cons of the options

### Vercel AI SDK 7 behind a types-only port

* Good, because it has first-party packages for Azure with an Entra token provider, Vertex, Bedrock, Anthropic, OpenAI and Mistral, plus OpenRouter's own provider, all Apache-2.0.
* Good, because it reports usage per step and OpenRouter cost in provider metadata.
* Bad, because a major arrives about every six months, each with a matching OpenRouter provider major, and its defaults need the guards above.

### TanStack AI

* Good, because it fits the TanStack frontend and its OpenRouter adapter reports cost.
* Bad, because it is 0.x with about two minor releases a week and has no Azure adapter.

### LangChain.js

* Good, because it covers the providers and has agent graphs.
* Bad, because `@langchain/core` depends on `langsmith`, and one environment variable can start sending traces to LangSmith.

### Mastra

* Good, because it offers agents and workflows on AI SDK provider specs.
* Bad, because its published package contains source-available Enterprise Edition code that may not be redistributed, and it sends usage telemetry unless an environment variable turns it off.

### An own thin port over OpenAI-compatible HTTP

* Good, because it has the fewest dependencies.
* Bad, because Vertex, Bedrock and Anthropic's native API need their own code, which means weeks of work to reach the providers Krister Johansson named.

LlamaIndex.TS was also checked and is out, because its repository is archived.

## More information

* Related ADRs: [0003](0003-module-package-shape-and-the-definemodule-manifest.md) manifest `ai.features`, [0011](0011-principals-credentials-and-same-origin-rules.md) same-origin rules, [0013](0013-audit-trail-written-in-the-command-transaction.md) the agent principal and usage logs, [0021](0021-accessibility-target-wcag-2-2-aa.md) accessibility, [0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md) tools and the shared runner, [0036](0036-agent-proposals-as-planning-records-a-person-commits.md) proposals, [0040](0040-dependency-license-policy-ci-gate-and-sbom.md) license gate, [0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md) AI in tests, [0047](0047-secrets-and-the-installation-key.md) secrets and outbound URLs, [0051](0051-regulated-readiness-no-regret-rules.md) regulated profile, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) cut order.
* Plan: [10-ai-and-agents.md](../plan/10-ai-and-agents.md) (the port's starting shape, provider table, guard tests, on-prem reachability); [06-web-and-ux.md](../plan/06-web-and-ux.md), section "AI chat panel"; [17-risks.md](../plan/17-risks.md), R-07; [16-open-questions.md](../plan/16-open-questions.md).
* Revisit at each AI SDK major, when Krister answers whether Google ships in release 1, when legal confirmation on Article 50 arrives, and when a feature needs embeddings or server-side chat history.
