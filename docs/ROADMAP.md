# KestrelMesh | Production-readiness backlog

These are outstanding engineering requirements, not completed capabilities.

1. Atomic half-open leasing and bounded concurrency.
2. Token-level cost budgets, weighted policy routing and tenant quotas.
3. Tail-latency SLOs with circuit thresholds tuned from sustained traffic.
4. Prometheus/OpenTelemetry-compatible traces and durable asynchronous delivery.

5. External security assessment, threat-model review and scoped tenant identities.
6. Load testing on realistic datasets at stated quotas; baseline p95/p99 and error budgets.
7. Backup/restore drills, deletion/data retention policies, GDPR-related controls where applicable.
8. Accessibility audit, keyboard-only testing, browser E2E and cross-device coverage.
9. SBOM, dependency review, branch protection and deployment provenance/rollback.
10. Production observability and alerting with measured owner response times.
