---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 17, 23 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# AI in tests: mocked by default, opt-in live runs

## Context and problem statement

Every in-app AI feature calls models through a provider that the customer configures with its own credentials ([ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md)). The project itself holds no model key for the product. Tests still need to cover the assistant, agent proposals, usage metering, budgets and the data-leak guards, and some behaviour (tool calling and prompt injection on a real model) shows only against a real model.

Krister Johansson decided that AI is mocked by default in tests, and that real-model tests are opt-in only through `pnpm test:ai`, `pnpm test:e2e:ai` or `NORTHMES_AI_LIVE=1`, budget-capped and never run on pull requests. The stress test found that a cap kept only in test code fails open when that code has a bug, and asked for the cap to sit at the provider (internal research note 32).

This ADR decides how AI is mocked in unit, integration and end-to-end tests, how a live run is started and capped, and where the live key lives. It covers the `ai` Vitest project, the AI helpers in `@northmes/testing`, the stub provider server for end-to-end tests and the live AI workflow. The general harness is in [ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md).

## Decision drivers

* Krister Johansson's decision: mocked by default, opt-in live runs, budget-capped, never on pull requests.
* Default runs are deterministic, free and send no data anywhere.
* No pull request workflow, from a fork or not, can reach a model key.
* A bug in test code must not be able to spend more than a fixed amount.
* Live runs use the same configuration path a customer uses, so they test the product, not a shortcut.
* A test that forgets its mock fails instead of calling out.

## Considered options

* A mocked provider by default, and opt-in live runs on a manual or scheduled workflow with a provider-side credit cap
* Live model calls in the default CI run on pull requests
* A deterministic stub adapter inside the product, used when no key is configured
* Opt-in live runs capped only by a call counter in the test code

## Decision outcome

Chosen option: "A mocked provider by default, and opt-in live runs on a manual or scheduled workflow with a provider-side credit cap", because it is the only option where the default run needs no key, no pull request can reach one, and the spend limit holds even if the test code is wrong.

### Mocked by default

* Unit and integration tests use `MockLanguageModelV4` and `simulateReadableStream` from the AI SDK's test helpers, wrapped by helpers in `@northmes/testing`. Abort, telemetry, tool-error and budget cases are reproducible.
* End-to-end tests run against a stub OpenAI-compatible server that a Playwright fixture starts and configures as the test company's provider.
* The default-provider guard is set at module load of `modules/ai/server/model-call.ts` and in the Vitest `setupFiles`: no string model ids, no gateway default, no credential or base-URL fallback from environment variables ([ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md)).
* The product has no stub adapter. With no provider configured, every AI feature is off and the chat panel is hidden.

### Live runs

* Live tests live in `*.ai.test.ts` files, which only the `ai` Vitest project collects, and in live end-to-end specs. They run only through `pnpm test:ai`, `pnpm test:e2e:ai` or with `NORTHMES_AI_LIVE=1` set. They never run in `pnpm check`, in `ci / gate` or on any pull request.
* The cap is provider-side: a dedicated OpenRouter key with a credit limit and a monthly `limit_reset`. It is a GitHub environment secret of the live AI workflow, whose only triggers are `workflow_dispatch` and `schedule`.
* The live suite runs with one worker and a per-run call counter in `globalSetup` as a soft cap.
* A fixture injects the key into the test company's provider configuration, so a live run uses the same provider configuration and model-call path as a customer installation.
* The live suite holds the prompt-injection fixture: a synthetic order whose CustomData holds an instruction; asked "which orders are late", the real model makes no propose call and no item touches unrelated orders ([ADR 0036](0036-agent-proposals-as-planning-records-a-person-commits.md)).
* Each provider kind added to the port gets one live check ([ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md)).
* Each release also gets one manual smoke test with Claude Code against `/mcp` ([ADR 0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md)).

The Pyramid connector follows the same pattern with `NORTHMES_PYRAMID_LIVE=1` against a test company, never on pull requests ([ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)).

### Consequences

* Good, because `pnpm check` and every pull request run offline with respect to model providers and cost nothing.
* Good, because the most the live suite can spend is the key's credit limit per month, whatever the test code does.
* Good, because live runs use the customer's configuration path, not a test-only shortcut.
* Bad, because mocks cannot show how a real model chooses tools, so regressions in prompts or tool descriptions surface only on the scheduled live run.
* Bad, because the live suite depends on OpenRouter for its key and cap; other provider kinds get only their single live check.
* Neutral, because live results vary between runs, so live tests assert behaviour (no propose call, no unrelated item), not exact text.

### Confirmation

* A workflow lint fails when the live AI workflow has a `pull_request` or `pull_request_target` trigger.
* `test/meta/collection.test.ts` asserts that `*.ai.test.ts` files belong only to the `ai` project, so `pnpm check` never collects them.
* Guard test in the default run: with a provider API key set in the environment and no provider configured for the test company, no fetch leaves the process and the feature reports off; a string model id passed to the model-call file throws.
* Live soft cap test: with the counter limit set to N, call N+1 fails the run with a message naming the cap.
* Mocked cases from [10-ai-and-agents.md](../plan/10-ai-and-agents.md#tests-to-write) run in `pnpm check`, for example: a stream aborted after 150 ms leaves an `aborted-estimated` usage row; with a budget of 1.00 and steps costing 0.40, the third step never starts.
* The live injection fixture asserts zero calls to `planning_propose_changes`.

## Pros and cons of the options

### Mocked by default, opt-in live runs with a provider-side cap

* Good, because the key never reaches a pull request workflow, and the cap does not depend on test code.
* Bad, because a person or the schedule must start live runs, so live coverage lags behind changes.

### Live calls on every pull request

* Good, because real-model behaviour is checked on every change.
* Bad, because pull requests from forks would need a key, every run would cost money, and flaky model output would block merges.

### A stub adapter inside the product

* Good, because the end-to-end suite runs offline without a stub server.
* Bad, because the product would contain a fake model path that a misconfiguration could reach in production; with no provider, the feature should be off.

### A call counter in test code as the only cap

* Good, because it needs no provider account settings.
* Bad, because a bug in the counter or a test that bypasses it spends without limit.

## More information

* Related ADRs: [0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md), [0035](0035-ai-provider-port-with-customer-configured-providers.md), [0036](0036-agent-proposals-as-planning-records-a-person-commits.md), [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md), [0047](0047-secrets-and-the-installation-key.md) secrets, [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) workflows and environments.
* Plan: [10-ai-and-agents.md](../plan/10-ai-and-agents.md#testing), [11-quality-and-testing.md](../plan/11-quality-and-testing.md#ai-test-modes), [13-delivery-and-github.md](../plan/13-delivery-and-github.md#workflows-and-jobs).
* AI SDK testing: https://ai-sdk.dev/docs/ai-sdk-core/testing. OpenRouter API keys and limits: https://openrouter.ai/docs.
* Revisit when a second provider kind needs regular live coverage, and when the live suite's monthly credit runs out before the month ends.
