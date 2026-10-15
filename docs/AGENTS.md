# Inference Reliability Agent — constrained tool-using agent

This is a genuine, **bounded AI reasoning loop** powered by Cloudflare Workers AI and D1. It is **not** a long-lived background daemon or a fully autonomous production agent.

## Run lifecycle

1. Authenticated operator submits an objective (`POST /api/agents`, max 600 chars, budget 1–4 model calls).
2. D1 persists the session as `ready`; no model call occurs until explicit operator advancement.
3. `POST /api/agents/:id/advance` claims the session using an atomic state transition (`ready → running`). Concurrent calls receive `409`.
4. Workers AI selects an allowlisted read-only tool or a final answer using a strictly validated JSON decision. No generated SQL, arbitrary URLs, system commands, filesystem operations, or writes are allowed.
5. The Worker runs one database read and stores the observation in D1; the operator can advance again. The budget is enforced server-side.
6. The model must read at least one database observation before a final answer is accepted. The final event references the ordinal numbers of its evidence tool steps. The model may finalize based on observed records. If the budget is exhausted before finalizing, the run enters `needs_review`, not `completed`.

## Permitted tools

- provider_health: no argument
- recent_failures: no argument
- latency_samples: no argument

## Trust & cost boundaries

- Read-only, static queries; the model cannot change any database or external state.
- Structured model output validation denies unknown tool names and oversized arguments; content from documents and user-written records is untrusted.
- Root or operator credentials required to start or advance; authorized readers can inspect existing traces where their API route scope permits.
- Model calls run on Workers AI and count against Cloudflare's available allowance. No billable upgrades or paid services are enabled.
- Agent sessions can be left in `running` if the Worker is terminated mid-step. They are deliberately not auto-replayed, because another model call could have occurred. A five-minute stale-run recovery action marks the session failed without replaying the model.
- D1 query output is limited; the model cannot claim exhaustive coverage. There is no RAG embedding index, multi-tenant tenant isolation, multi-agent delegation, or independent factual verification yet.

## API

- `GET /api/agents/config` — trusted tool inventory and runtime policy
- `POST /api/agents` — create run
- `GET /api/agents` and `GET /api/agents/:id` — list and inspect event trace
- `POST /api/agents/:id/advance` — one operator-controlled model decision
- `POST /api/agents/:id/abandon` — explicitly archive nonrunning runs
- `POST /api/agents/:id/recover` — mark a running session older than five minutes failed **without replay**

- `GET /api/agents/metrics` — persisted run states, not invented model-usage analytics

Agent conclusions are **interpretations, not attestations**. This release does not provide independent factual verification, supervised policy execution or enterprise identity.
