# Atomic circuit accounting and transitions

Previously, KestrelMesh read a failure count and wrote an updated counter and audit event in separate database calls. Concurrent failures could overwrite counts; an audit failure could leave changed state without a corresponding event.

`recordCircuit` now uses one D1 SQLite upsert. The counter update is derived from the persisted row at the instant of update. `0014_atomic_circuit_events.sql` installs a same-transaction trigger for state transitions; if logging fails the circuit update rolls back. This applies to operator resets, too. The existing atomic half-open lease remains in place.

Tests verify concurrent failure calls, one opening event, a closed recovery event, and induced audit-write rollback. These are deterministic database tests rather than claims of provider-scale performance. Live GitHub deployment checks include authenticated API and Chromium browser verification.

Remaining: token budget and per-tenant permissions, sustained provider-failure load test, durable asynchronous trace delivery, SLO calibration. No paid inference requirement; remote AI is disabled by default.
